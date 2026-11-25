import { CalendarCheck, Check } from 'lucide-react'
import { useState } from 'react'
import { dataCurta, fmt } from '../../lib/finance'
import type { Conta } from '../../lib/finance'
import { Card, Empty, Money, cx } from '../kit'

export function ContasCard({
  contas,
  onToggle,
  busy,
}: {
  contas: Conta[]
  onToggle: (c: Conta) => void
  busy: boolean
}) {
  const [dia, setDia] = useState<string | null>(null)
  const pendentes = contas.filter((c) => !c.pagamento)
  const totalPendente = pendentes.reduce((a, c) => a + c.valor, 0)
  const proximo = pendentes.find((c) => c.vencimento)?.vencimento
  const dias = [...new Set(contas.map((c) => c.vencimento ?? 'sem'))]
  const visiveis = dia ? contas.filter((c) => (c.vencimento ?? 'sem') === dia) : contas

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">
            Contas a pagar
            {proximo && <span className="ml-1.5 text-xs font-medium text-muted">· próxima {dataCurta(proximo)}</span>}
          </h2>
          <Money value={totalPendente} className="mt-3 text-4xl" />
          <div className="mt-1 text-xs text-muted">
            {contas.length - pendentes.length} de {contas.length} pagas
          </div>
        </div>
        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <CalendarCheck size={28} strokeWidth={1.7} />
        </div>
      </div>

      {dias.length > 1 && (
        <div className="scroll-thin mt-4 flex gap-2 overflow-x-auto pb-1">
          {dias.map((d) => {
            const n = contas.filter((c) => (c.vencimento ?? 'sem') === d).length
            const ativo = dia === d
            return (
              <button
                key={d}
                onClick={() => setDia(ativo ? null : d)}
                className={cx(
                  'min-w-14 shrink-0 rounded-2xl border px-3 py-2 text-center transition',
                  ativo ? 'border-primary bg-primary text-white' : 'border-line bg-card hover:bg-soft',
                )}
              >
                <div className="text-sm font-bold">{d === 'sem' ? '—' : d.slice(8)}</div>
                <div className={cx('text-[10px] tracking-widest', ativo ? 'text-white/80' : 'text-faint')}>{'•'.repeat(Math.min(n, 5))}</div>
              </button>
            )
          })}
        </div>
      )}

      <ul className="scroll-thin mt-3 max-h-80 divide-y divide-line overflow-y-auto pr-1">
        {visiveis.length === 0 && <Empty>Nada para pagar neste mês.</Empty>}
        {visiveis.map((c) => {
          const pago = !!c.pagamento
          return (
            <li key={c.ref} className="flex items-center gap-3 py-2.5">
              <button
                disabled={busy}
                onClick={() => onToggle(c)}
                title={pago ? 'Desmarcar' : 'Marcar como pago'}
                className={cx(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition',
                  pago ? 'border-good bg-good text-white' : 'border-line hover:border-primary',
                )}
              >
                {pago && <Check size={14} strokeWidth={3} />}
              </button>
              {c.cor && <span className="h-6 w-1 shrink-0 rounded-full" style={{ background: c.cor }} />}
              <div className="min-w-0 flex-1">
                <div className={cx('truncate text-sm font-semibold', pago && 'text-muted line-through')}>{c.titulo}</div>
                <div className="truncate text-xs text-muted">
                  {c.vencimento ? `vence ${dataCurta(c.vencimento)}` : 'sem vencimento'} · {c.subtitulo}
                </div>
              </div>
              <div className={cx('text-sm font-bold whitespace-nowrap', pago && 'text-muted')}>R$ {fmt(c.valor)}</div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
