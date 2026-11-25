import { Layers } from 'lucide-react'
import { addMeses, fmt, mesCurto, parcelasPorMes } from '../../lib/finance'
import type { Lancamento, Model } from '../../lib/model'
import { Card, CardTitle, Empty, Money, cx } from '../kit'

export function ParcelasCard({ model, mes, itens }: { model: Model; mes: string; itens: Lancamento[] }) {
  const serie = parcelasPorMes(model, mes, 12)
  const max = Math.max(...serie.map((s) => s.valor), 1)
  const doMes = itens.filter((l) => l.tipo === 'parcela').sort((a, b) => (b.parcelas_restantes ?? 0) - (a.parcelas_restantes ?? 0))
  const total = serie[0].valor
  const comprometido = serie.slice(1).reduce((a, s) => a + s.valor, 0)

  return (
    <Card className="lg:col-span-2">
      <CardTitle icon={<Layers size={18} />}>Parcelamentos</CardTitle>
      <div className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
        <div>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <div className="text-xs text-muted">Parcelas deste mês</div>
              <Money value={total} className="mt-1 text-4xl" />
            </div>
            <div>
              <div className="text-xs text-muted">Já comprometido nos próximos 11 meses</div>
              <div className="mt-2 text-lg font-bold">R$ {fmt(comprometido)}</div>
            </div>
          </div>
          <div className="mt-6 flex h-36 items-end gap-1.5">
            {serie.map((s, k) => (
              <div key={s.mes} className="group flex h-full flex-1 flex-col items-center justify-end gap-1">
                <div className="text-[9px] font-semibold text-muted opacity-0 transition group-hover:opacity-100">{Math.round(s.valor)}</div>
                <div
                  title={`${mesCurto(s.mes)}: R$ ${fmt(s.valor)}`}
                  className={cx('w-full max-w-7 rounded-t-md', k === 0 ? 'bg-primary' : 'bg-primary/35')}
                  style={{ height: `${Math.max(2, (s.valor / max) * 100)}%` }}
                />
                <div className={cx('text-[10px]', k === 0 ? 'font-bold text-ink' : 'text-muted')}>{mesCurto(s.mes, false)}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[11px] font-semibold tracking-wider text-muted uppercase">Neste mês ({doMes.length})</div>
          {doMes.length === 0 ? (
            <Empty>Nenhuma parcela neste mês.</Empty>
          ) : (
            <ul className="scroll-thin max-h-64 divide-y divide-line overflow-y-auto pr-1">
              {doMes.map((l) => {
                const fim = l.parcelas_restantes ? addMeses(mes, l.parcelas_restantes - 1) : null
                return (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{l.descricao}</div>
                      <div className="text-xs text-muted">
                        {l.forma_pagamento}
                        {l.parcelas_restantes
                          ? l.parcelas_restantes === 1
                            ? ' · última parcela'
                            : ` · faltam ${l.parcelas_restantes} · até ${mesCurto(fim!)}`
                          : ''}
                      </div>
                    </div>
                    <div className="text-sm font-bold whitespace-nowrap">R$ {fmt(l.valor)}</div>
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
