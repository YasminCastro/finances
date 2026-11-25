import { Check, HandCoins } from 'lucide-react'
import { fmt, mesCurto, receberPendente } from '../../lib/finance'
import type { Model, Receber } from '../../lib/model'
import { Card, CardTitle, Empty, Money } from '../kit'

export function ReceberCard({ model, onToggle, busy }: { model: Model; onToggle: (r: Receber) => void; busy: boolean }) {
  const { total, pessoas } = receberPendente(model)
  return (
    <Card>
      <CardTitle icon={<HandCoins size={18} />}>A receber</CardTitle>
      <div className="text-xs text-muted">Te devem no total</div>
      <Money value={total} className="mt-1 text-4xl" tone={total > 0 ? 'good' : 'default'} />
      <div className="scroll-thin mt-4 max-h-72 space-y-4 overflow-y-auto pr-1">
        {pessoas.length === 0 && <Empty>Ninguém te deve nada 🎉</Empty>}
        {pessoas.map((p) => (
          <div key={p.pessoa}>
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                  {p.pessoa.slice(0, 1).toUpperCase()}
                </span>
                <span className="text-sm font-semibold">{p.pessoa}</span>
              </div>
              <span className="text-sm font-bold">R$ {fmt(p.total)}</span>
            </div>
            <ul className="ml-9 space-y-0.5">
              {p.itens.map((r) => (
                <li key={r.id} className="group flex items-center justify-between gap-2 text-xs text-muted">
                  <span className="truncate">
                    {r.descricao} · {mesCurto(r.mes_ref)}
                  </span>
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    {fmt(r.valor)}
                    <button
                      disabled={busy}
                      onClick={() => onToggle(r)}
                      title="Marcar como recebido"
                      className="flex size-5 items-center justify-center rounded-full border border-line text-transparent transition group-hover:text-good hover:border-good hover:bg-good-soft"
                    >
                      <Check size={12} strokeWidth={3} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  )
}
