import { Check, HandCoins } from 'lucide-react'
import { addMeses, brl, fmt, mesCurto, receberItens } from '../../lib/finance'
import type { Model, Receber } from '../../lib/model'
import { Card, Money, cx } from '../kit'

const soma = (xs: Receber[]) => xs.reduce((a, r) => a + r.valor, 0)

export function ReceberCard({ model, mes, onToggle, busy }: { model: Model; mes: string; onToggle: (r: Receber) => void; busy: boolean }) {
  const todos = receberItens(model)
  const doMes = todos.filter((r) => r.mes_ref === mes)
  const pendentes = doMes.filter((r) => !r.recebido)
  const falta = soma(pendentes)
  const totalMes = soma(doMes)
  const recebido = totalMes - falta
  const atrasado = soma(todos.filter((r) => !r.recebido && r.mes_ref < mes))

  // por pessoa: quem ainda deve vem primeiro, depois quem já pagou tudo
  const porPessoa = new Map<string, Receber[]>()
  for (const r of doMes) porPessoa.set(r.pessoa, [...(porPessoa.get(r.pessoa) ?? []), r])
  const pessoas = [...porPessoa.entries()]
    .map(([pessoa, itens]) => ({
      pessoa,
      itens: [...itens].sort((a, b) => Number(a.recebido) - Number(b.recebido) || b.valor - a.valor),
      falta: soma(itens.filter((r) => !r.recebido)),
    }))
    .sort((a, b) => b.falta - a.falta || a.pessoa.localeCompare(b.pessoa))

  // o que vem nos próximos meses (para o card não ficar vazio e dar visão do que está por vir)
  const proximos = [1, 2, 3]
    .map((k) => addMeses(mes, k))
    .map((m) => {
      const itens = todos.filter((r) => r.mes_ref === m && !r.recebido)
      return { mes: m, valor: soma(itens), pessoas: new Set(itens.map((r) => r.pessoa)).size }
    })
  const temProximos = proximos.some((p) => p.valor !== 0)

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold">
            A receber
            <span className="ml-1.5 text-xs font-medium text-muted">· {mesCurto(mes)}</span>
          </h2>
          <Money value={falta} className="mt-3 text-4xl" tone={falta > 0 ? 'good' : 'default'} />
          <div className="mt-1 text-xs text-muted">{falta > 0 ? 'falta receber' : totalMes > 0 ? 'tudo recebido 🎉' : 'nada previsto para este mês'}</div>
        </div>
        <div className="hidden size-14 shrink-0 items-center justify-center rounded-2xl bg-good-soft text-good sm:flex">
          <HandCoins size={28} strokeWidth={1.7} />
        </div>
      </div>

      {totalMes > 0 && (
        <>
          <div
            className="mt-5 h-2.5 overflow-hidden rounded-full bg-soft"
            role="progressbar"
            aria-valuenow={Math.round((recebido / totalMes) * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Recebido no mês"
          >
            {recebido > 0 && <div className="h-full rounded-full bg-good" style={{ width: `${Math.min(100, (recebido / totalMes) * 100)}%` }} />}
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted tabular-nums">
            <span>
              <b className="font-semibold text-ink">{brl(recebido)}</b> recebido
            </span>
            <span>de {brl(totalMes)}</span>
          </div>
        </>
      )}

      {atrasado > 0 && (
        <div className="mt-3 rounded-xl bg-warn-soft/60 px-3 py-2 text-xs text-warn">
          <b className="font-semibold">{brl(atrasado)}</b> ainda pendente de meses anteriores
        </div>
      )}

      {pessoas.length > 0 && (
        <div className="scroll-thin mt-4 max-h-72 space-y-4 overflow-y-auto border-t border-line pt-4 pr-1">
          {pessoas.map((p) => (
            <div key={p.pessoa}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary" aria-hidden>
                    {p.pessoa.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="truncate text-sm font-semibold">{p.pessoa}</span>
                </div>
                <span className={cx('text-sm font-bold whitespace-nowrap tabular-nums', p.falta === 0 && 'text-good')}>
                  {p.falta === 0 ? 'pago' : `R$ ${fmt(p.falta)}`}
                </span>
              </div>
              <ul className="ml-9 space-y-1">
                {p.itens.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className={cx('min-w-0 truncate', r.recebido ? 'text-faint line-through' : 'text-muted')}>
                      {r.descricao}
                      {r.valor < 0 && <span className="ml-1 text-faint">(abatimento)</span>}
                    </span>
                    <span className="flex items-center gap-2 whitespace-nowrap tabular-nums">
                      <span className={cx(r.recebido ? 'text-faint' : 'text-muted')}>
                        {r.valor < 0 ? '−' : ''}
                        {fmt(Math.abs(r.valor))}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onToggle(r)}
                        title={r.recebido ? 'Desmarcar' : 'Marcar como recebido'}
                        aria-label={r.recebido ? `Desmarcar ${r.descricao}` : `Marcar ${r.descricao} como recebido`}
                        aria-pressed={r.recebido}
                        className={cx(
                          'flex size-5 items-center justify-center rounded-full border transition',
                          r.recebido ? 'border-good bg-good text-white' : 'border-line text-faint hover:border-good hover:bg-good-soft hover:text-good',
                        )}
                      >
                        <Check size={11} strokeWidth={3} />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {temProximos && (
        <div className="mt-auto pt-4">
          <div className="border-t border-line pt-4">
            <div className="mb-2 text-xs font-semibold text-muted">Próximos meses</div>
            <ul className="space-y-1.5">
              {proximos.map((p) => (
                <li key={p.mes} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted">
                    {mesCurto(p.mes)}
                    {p.pessoas > 0 && (
                      <span className="ml-1.5 text-xs text-faint">
                        · {p.pessoas} {p.pessoas === 1 ? 'pessoa' : 'pessoas'}
                      </span>
                    )}
                  </span>
                  <span className={cx('font-semibold tabular-nums', p.valor === 0 && 'text-faint')}>{p.valor === 0 ? '—' : brl(p.valor)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  )
}
