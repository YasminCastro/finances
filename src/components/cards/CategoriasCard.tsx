import { Tags } from 'lucide-react'
import { useState } from 'react'
import { brl, fmt } from '../../lib/finance'
import type { CategoriaResumo } from '../../lib/finance'
import { Card, CardTitle, Empty, Money, cx } from '../kit'

type Ordem = 'maior' | 'menor' | 'az'
const ORDENS: { id: Ordem; label: string; titulo: string }[] = [
  { id: 'maior', label: 'Maior', titulo: 'Maior gasto primeiro' },
  { id: 'menor', label: 'Menor', titulo: 'Menor gasto primeiro' },
  { id: 'az', label: 'A–Z', titulo: 'Ordem alfabética' },
]
const CHAVE = 'categorias.ordem'

function ordemSalva(): Ordem {
  try {
    const v = localStorage.getItem(CHAVE)
    return v === 'menor' || v === 'az' ? v : 'maior'
  } catch {
    return 'maior'
  }
}

export function CategoriasCard({ cats }: { cats: CategoriaResumo[] }) {
  const [ordem, setOrdemState] = useState<Ordem>(ordemSalva)
  const setOrdem = (o: Ordem) => {
    setOrdemState(o)
    try {
      localStorage.setItem(CHAVE, o)
    } catch {
      /* sem armazenamento: só não lembra a escolha */
    }
  }

  const total = cats.reduce((a, c) => a + c.gasto, 0)
  const max = Math.max(...cats.map((c) => Math.max(c.gasto, c.orcamento)), 1)
  const estouradas = cats.filter((c) => c.orcamento > 0 && c.gasto > c.orcamento).length
  // cats já vem em ordem alfabética; os empates de valor mantêm essa ordem
  const lista = ordem === 'az' ? cats : [...cats].sort((a, b) => (ordem === 'maior' ? b.gasto - a.gasto : a.gasto - b.gasto))

  return (
    <Card className="flex flex-col">
      <CardTitle icon={<Tags size={18} />}>Gastos por categoria</CardTitle>
      <div className="text-xs text-muted">Total do mês</div>
      <Money value={total} className="mt-1 text-4xl" />
      {estouradas > 0 && (
        <div className="mt-2 self-start rounded-full bg-bad-soft px-2.5 py-1 text-xs font-semibold text-bad">
          {estouradas} {estouradas === 1 ? 'categoria passou' : 'categorias passaram'} do esperado
        </div>
      )}

      {cats.length > 0 && (
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
          <span className="text-xs font-semibold text-muted">
            {cats.length} {cats.length === 1 ? 'categoria' : 'categorias'}
          </span>
          <div className="flex gap-0.5 rounded-full bg-soft p-0.5 text-[11px]" role="group" aria-label="Ordenar categorias">
            {ORDENS.map((o) => (
              <button
                key={o.id}
                type="button"
                title={o.titulo}
                aria-pressed={ordem === o.id}
                onClick={() => setOrdem(o.id)}
                className={cx(
                  'rounded-full px-2.5 py-1 font-semibold transition-colors',
                  ordem === o.id ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <ul className="scroll-thin mt-3 space-y-3.5 lg:max-h-88 lg:overflow-y-auto lg:pr-2">
        {cats.length === 0 && <Empty>Sem gastos neste mês.</Empty>}
        {lista.map((c) => {
          const temMeta = c.orcamento > 0
          const over = temMeta && c.gasto > c.orcamento
          const pctTotal = total > 0 ? (c.gasto / total) * 100 : 0
          return (
            <li key={c.nome}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.cor }} aria-hidden />
                  <span className={cx('truncate font-medium', c.gasto === 0 && 'text-muted')}>{c.nome}</span>
                </span>
                <span className="font-semibold whitespace-nowrap tabular-nums">
                  <span className={cx(over && 'text-bad', c.gasto === 0 && 'text-muted')}>R$ {fmt(c.gasto)}</span>
                  {temMeta && <span className="text-xs font-normal text-muted"> / {fmt(c.orcamento)}</span>}
                </span>
              </div>
              {/* barra comparável entre categorias; o tracinho marca o esperado */}
              <div className="relative h-2 rounded-full bg-soft">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (c.gasto / max) * 100)}%`, background: c.cor }} />
                {temMeta && (
                  <div
                    className="absolute -top-0.5 h-3 w-0.5 rounded bg-ink/60"
                    style={{ left: `calc(${Math.min(100, (c.orcamento / max) * 100)}% - 1px)` }}
                    title={`Esperado: ${brl(c.orcamento)}`}
                  />
                )}
              </div>
              <div className="mt-1 flex justify-between gap-2 text-[11px] text-muted tabular-nums">
                <span>{c.gasto > 0 ? `${pctTotal < 1 ? '<1' : Math.round(pctTotal)}% do total` : 'nada gasto'}</span>
                {temMeta &&
                  (over ? (
                    <span className="font-semibold text-bad">{brl(c.gasto - c.orcamento)} acima</span>
                  ) : (
                    <span>sobram {brl(c.orcamento - c.gasto)}</span>
                  ))}
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
