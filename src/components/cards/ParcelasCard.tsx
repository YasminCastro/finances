import { Layers } from 'lucide-react'
import { addMeses, brl, fmt, mesCurto, parcelasPorMes, salarioFixo } from '../../lib/finance'
import type { Lancamento, Model } from '../../lib/model'
import { Card, Empty, Money, cx } from '../kit'

export function ParcelasCard({ model, mes, itens }: { model: Model; mes: string; itens: Lancamento[] }) {
  const serie = parcelasPorMes(model, mes, 12)
  const total = serie[0].valor
  const comprometido = serie.slice(1).reduce((a, s) => a + s.valor, 0)
  const limite = salarioFixo(model, mes) * (model.limites.parcela || 0)
  const max = Math.max(...serie.map((s) => s.valor), limite, 1)
  const doMes = itens.filter((l) => l.tipo === 'parcela').sort((a, b) => (b.parcelas_restantes ?? 0) - (a.parcelas_restantes ?? 0) || b.valor - a.valor)
  // o que deixa de pesar no mês seguinte
  const terminam = doMes.filter((l) => l.parcelas_restantes === 1)
  const alivio = terminam.reduce((a, l) => a + l.valor, 0)
  // último mês com parcela no horizonte do gráfico
  const ultimo = [...serie].reverse().find((s) => s.valor > 0)
  const acima = limite > 0 && total > limite
  const pctSalario = limite > 0 ? total / (limite / (model.limites.parcela || 1)) : 0

  return (
    <Card className="lg:col-span-2">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <Layers size={18} className="text-muted" />
          Parcelamentos
          <span className="text-xs font-medium text-muted">· {mesCurto(mes)}</span>
        </h2>
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <div className="text-xs text-muted">Parcelas deste mês</div>
              <Money value={total} className="mt-1 text-4xl" tone={acima ? 'bad' : 'default'} />
            </div>
            <div className="pb-1">
              <div className="text-xs text-muted">Próximos 11 meses</div>
              <div className="mt-0.5 text-lg font-bold tabular-nums">{brl(comprometido)}</div>
            </div>
          </div>

          {/* situação em relação ao limite e o que alivia */}
          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold">
            {limite > 0 && (
              <span className={cx('rounded-full px-2.5 py-1', acima ? 'bg-bad-soft text-bad' : 'bg-good-soft text-good')}>
                {Math.round(pctSalario * 100)}% do salário · limite {Math.round((model.limites.parcela || 0) * 100)}%
                {acima && ` · ${brl(total - limite)} acima`}
              </span>
            )}
            {alivio > 0 && (
              <span className="rounded-full bg-soft px-2.5 py-1 text-muted">
                {brl(alivio)} {terminam.length === 1 ? 'termina' : 'terminam'} este mês
              </span>
            )}
          </div>

          <Grafico serie={serie} max={max} limite={limite} mes={mes} />
          {ultimo && ultimo.mes !== serie[serie.length - 1].mes && (
            <div className="mt-1 text-[11px] text-muted">Sem parcelas a partir de {mesCurto(addMeses(ultimo.mes, 1))}.</div>
          )}
        </div>

        <div className="flex min-w-0 flex-col">
          <div className="mb-1 text-xs font-semibold text-muted">
            {doMes.length} {doMes.length === 1 ? 'parcela' : 'parcelas'} neste mês
          </div>
          {doMes.length === 0 ? (
            <Empty>Nenhuma parcela neste mês.</Empty>
          ) : (
            <ul className="scroll-thin max-h-72 divide-y divide-line overflow-y-auto pr-2">
              {doMes.map((l) => {
                const rest = l.parcelas_restantes
                const fim = rest ? addMeses(mes, rest - 1) : null
                return (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{l.descricao}</div>
                      <div className="truncate text-xs text-muted">
                        {l.forma_pagamento}
                        {rest ? (rest === 1 ? '' : ` · faltam ${rest} · até ${mesCurto(fim!)}`) : ''}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {rest === 1 && <span className="rounded-full bg-good-soft px-2 py-0.5 text-[10px] font-semibold text-good">última</span>}
                      <span className="text-sm font-bold whitespace-nowrap tabular-nums">R$ {fmt(l.valor)}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </Card>
  )
}

function Grafico({ serie, max, limite, mes }: { serie: { mes: string; valor: number }[]; max: number; limite: number; mes: string }) {
  const y = (v: number) => (v / max) * 100
  return (
    <div className="relative mt-5 flex min-h-40 flex-1 gap-1">
      {/* linha de base */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 h-px bg-line" aria-hidden />
      {/* limite mensal (tracejado) */}
      {limite > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-5 bottom-6" aria-hidden>
          <div className="absolute inset-x-0 border-t border-dashed border-bad/50" style={{ bottom: `${y(limite)}%` }}>
            <span className="absolute -top-4 right-0 bg-card pl-1 text-[10px] font-semibold text-bad/80">limite</span>
          </div>
        </div>
      )}
      {serie.map((s) => {
        const atual = s.mes === mes
        const h = Math.max(s.valor > 0 ? 2 : 0, y(s.valor))
        return (
          <div key={s.mes} className="group flex flex-1 flex-col" title={`${mesCurto(s.mes)}: ${brl(s.valor)}`}>
            <div className="relative mt-5 flex flex-1 items-end justify-center">
              <span
                className={cx(
                  'absolute inset-x-[-8px] text-center text-[10px] font-semibold whitespace-nowrap tabular-nums transition-opacity',
                  atual ? 'text-ink opacity-100' : 'text-muted opacity-0 group-hover:opacity-100',
                )}
                style={{ bottom: `calc(${h}% + 3px)` }}
              >
                {Math.round(s.valor).toLocaleString('pt-BR')}
              </span>
              <div
                className={cx('w-full max-w-7 rounded-t transition-colors', atual ? 'bg-primary' : 'bg-primary/35 group-hover:bg-primary/60')}
                style={{ height: `${h}%` }}
              />
            </div>
            <div className={cx('flex h-6 items-center justify-center text-[10px]', atual ? 'font-bold text-primary' : 'text-muted')}>
              {mesCurto(s.mes, false)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
