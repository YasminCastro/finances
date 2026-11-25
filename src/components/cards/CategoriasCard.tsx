import { Tags } from 'lucide-react'
import { useState } from 'react'
import { fmt } from '../../lib/finance'
import type { CategoriaResumo } from '../../lib/finance'
import { Bar, Card, CardTitle, Empty, Money, cx } from '../kit'

export function CategoriasCard({ cats }: { cats: CategoriaResumo[] }) {
  const [todas, setTodas] = useState(false)
  const total = cats.reduce((a, c) => a + c.gasto, 0)
  const max = Math.max(...cats.map((c) => Math.max(c.gasto, c.orcamento)), 1)
  const lista = todas ? cats : cats.slice(0, 7)
  const estouradas = cats.filter((c) => c.orcamento > 0 && c.gasto > c.orcamento).length

  return (
    <Card>
      <CardTitle icon={<Tags size={18} />}>Gastos por categoria</CardTitle>
      <div className="text-xs text-muted">Total do mês</div>
      <Money value={total} className="mt-1 text-4xl" />
      {estouradas > 0 && (
        <div className="mt-2 inline-block rounded-full bg-bad-soft px-2.5 py-1 text-xs font-semibold text-bad">
          {estouradas} {estouradas === 1 ? 'categoria passou' : 'categorias passaram'} do esperado
        </div>
      )}
      <ul className="mt-4 space-y-3">
        {cats.length === 0 && <Empty>Sem gastos neste mês.</Empty>}
        {lista.map((c) => {
          const over = c.orcamento > 0 && c.gasto > c.orcamento
          return (
            <li key={c.nome}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.cor }} />
                  <span className="truncate font-medium">{c.nome}</span>
                </span>
                <span className="whitespace-nowrap">
                  <b className={cx(over && 'text-bad')}>R$ {fmt(c.gasto)}</b>
                  {c.orcamento > 0 && <span className="text-xs text-muted"> / {fmt(c.orcamento)}</span>}
                </span>
              </div>
              <div className="relative">
                <Bar value={c.gasto} max={max} color={c.cor} />
                {c.orcamento > 0 && (
                  <div className="absolute -top-0.5 h-3 w-0.5 rounded bg-ink/60" style={{ left: `${Math.min(100, (c.orcamento / max) * 100)}%` }} />
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {cats.length > 7 && (
        <button onClick={() => setTodas(!todas)} className="mt-3 text-xs font-semibold text-primary hover:underline">
          {todas ? 'Mostrar menos' : `Ver todas (${cats.length})`}
        </button>
      )}
    </Card>
  )
}
