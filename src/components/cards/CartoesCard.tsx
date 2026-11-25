import { Check, CreditCard, Wifi } from 'lucide-react'
import { useState } from 'react'
import { addMeses, brl, dataCurta, faturaCartao, fechamentoFatura, fmt, hoje, limiteCartao, mesCurto, vencimentoFatura } from '../../lib/finance'
import type { Model } from '../../lib/model'
import { Card, CardTitle, Empty, Money, cx } from '../kit'

export function CartoesCard({ model, mes }: { model: Model; mes: string }) {
  const cartoes = model.formas.filter((f) => f.cartao)
  // ordem fixa por fatura do mês; a seleção é pelo nome, para não pular ao trocar de mês
  const ordenados = [...cartoes].sort((a, b) => faturaCartao(model, mes, b.nome) - faturaCartao(model, mes, a.nome))
  const [sel, setSel] = useState<string | null>(null)
  if (!cartoes.length)
    return (
      <Card>
        <CardTitle icon={<CreditCard size={18} />}>Cartões</CardTitle>
        <Empty>Cadastre cartões em Configurações → Formas de pagamento.</Empty>
      </Card>
    )
  const c = ordenados.find((x) => x.nome === sel) ?? ordenados[0]
  const atual = faturaCartao(model, mes, c.nome)
  const proximas = [0, 1, 2].map((k) => {
    const m = addMeses(mes, k)
    return { mes: m, valor: faturaCartao(model, m, c.nome) }
  })
  const venc = vencimentoFatura(c, mes)
  const fech = fechamentoFatura(c, mes)
  const lim = limiteCartao(model, c)
  const cor = c.cor || '#334155'
  const paga = model.pagamentos.some((p) => p.mes_ref === mes && p.referencia.toLowerCase() === `fatura:${c.nome.toLowerCase()}`)
  const h = hoje()
  const status = paga
    ? { texto: 'Paga', tom: 'bg-good-soft text-good' }
    : venc && venc < h
      ? { texto: `Venceu ${dataCurta(venc)}`, tom: 'bg-bad-soft text-bad' }
      : fech && fech < h
        ? { texto: `Fechada · vence ${venc ? dataCurta(venc) : '—'}`, tom: 'bg-warn-soft text-warn' }
        : { texto: `Aberta${fech ? ` · fecha ${dataCurta(fech)}` : ''}`, tom: 'bg-soft text-muted' }

  return (
    <Card className="flex flex-col">
      <CardTitle icon={<CreditCard size={18} />}>Cartões</CardTitle>

      {/* seletor: nomes à vista em vez de setas e bolinhas */}
      {ordenados.length > 1 && (
        <div className="-mt-1 mb-4 flex flex-wrap gap-1.5 text-xs" role="tablist" aria-label="Cartão">
          {ordenados.map((x) => {
            const ativo = x.nome === c.nome
            return (
              <button
                key={x.nome}
                type="button"
                role="tab"
                aria-selected={ativo}
                onClick={() => setSel(x.nome)}
                className={cx(
                  'flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold whitespace-nowrap transition-colors',
                  ativo ? 'bg-primary-soft text-primary' : 'bg-soft text-muted hover:text-ink',
                )}
              >
                <span className="size-2 rounded-full" style={{ background: x.cor || '#334155' }} aria-hidden />
                {x.nome}
              </button>
            )
          })}
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xs text-muted">
            Fatura {c.nome} · {mesCurto(mes)}
          </div>
          <Money value={atual} className="mt-1 text-4xl" />
        </div>
        <span className={cx('mt-1 flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap', status.tom)}>
          {paga && <Check size={12} strokeWidth={3} />}
          {status.texto}
        </span>
      </div>

      {/* cartão visual */}
      <div
        className="relative mt-4 h-36 overflow-hidden rounded-2xl p-4 text-white shadow-md"
        style={{ background: `linear-gradient(135deg, ${cor}, color-mix(in srgb, ${cor} 55%, #000))` }}
      >
        <div className="absolute -top-10 -right-10 size-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-16 -left-6 size-44 rounded-full bg-white/5" />
        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold tracking-tight">{c.nome}</span>
            <Wifi size={18} className="rotate-90 opacity-80" />
          </div>
          <div className="h-6 w-9 rounded-md bg-gradient-to-br from-yellow-200 to-yellow-500 opacity-90" />
          <div className="flex gap-5 text-xs">
            {fech && (
              <div>
                <div className="text-[10px] tracking-wider uppercase opacity-70">Fecha</div>
                <div className="font-semibold">{dataCurta(fech)}</div>
              </div>
            )}
            <div>
              <div className="text-[10px] tracking-wider uppercase opacity-70">Vence</div>
              <div className="font-semibold">{venc ? dataCurta(venc) : '—'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* limite */}
      {lim && <Limite usado={lim.usado} limite={lim.limite} livre={lim.livre} />}

      <ProximasFaturas pontos={proximas} mes={mes} />
    </Card>
  )
}

function Limite({ usado, limite, livre }: { usado: number; limite: number; livre: number }) {
  const p = limite > 0 ? Math.min(1, Math.max(0, usado / limite)) : 0
  const tom = p >= 0.9 ? 'bg-bad' : p >= 0.7 ? 'bg-warn' : 'bg-primary'
  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold text-muted">Limite</span>
        <span className="text-muted tabular-nums">
          <b className={cx('font-semibold', livre < 0 ? 'text-bad' : 'text-ink')}>{brl(livre)}</b> livre
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-soft"
        role="progressbar"
        aria-valuenow={Math.round(p * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Limite usado"
      >
        <div className={cx('h-full rounded-full', tom)} style={{ width: `${p * 100}%` }} />
      </div>
      <div className="mt-1 text-[11px] text-muted tabular-nums">
        {brl(usado)} usados de {brl(limite)} · {Math.round(p * 100)}%
      </div>
    </div>
  )
}

function ProximasFaturas({ pontos, mes }: { pontos: { mes: string; valor: number }[]; mes: string }) {
  const max = Math.max(...pontos.map((p) => p.valor), 1)
  return (
    <div className="mt-5 flex flex-1 flex-col border-t border-line pt-4">
      <div className="mb-2 text-xs font-semibold text-muted">Próximas faturas</div>
      <div className="relative flex min-h-28 flex-1 gap-2">
        <div className="pointer-events-none absolute inset-x-0 bottom-7 h-px bg-line" aria-hidden />
        {pontos.map((p) => {
          const atual = p.mes === mes
          const alt = Math.max(2, (p.valor / max) * 100)
          return (
            <div
              key={p.mes}
              className={cx('flex flex-1 flex-col rounded-2xl px-1 pt-1', atual ? 'bg-primary-soft/70' : '')}
              title={`Fatura de ${mesCurto(p.mes)}: ${brl(p.valor)}`}
            >
              <div className={cx('relative mt-5 flex flex-1 items-end justify-center', !atual && 'opacity-60')}>
                <span
                  className={cx('absolute inset-x-0 text-center whitespace-nowrap tabular-nums', atual ? 'text-xs font-bold text-ink' : 'text-[11px] font-semibold text-muted')}
                  style={{ bottom: `calc(${alt}% + 4px)` }}
                >
                  {fmt(p.valor)}
                </span>
                <div className="w-full max-w-8 rounded-t bg-primary" style={{ height: `${alt}%` }} />
              </div>
              <div className={cx('flex h-7 items-center justify-center text-[11px] whitespace-nowrap', atual ? 'font-bold text-primary' : 'text-muted')}>
                {mesCurto(p.mes)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
