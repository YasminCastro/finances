import { CalendarCheck, Check } from 'lucide-react'
import { useState } from 'react'
import { brl, dataCurta, fmt, hoje } from '../../lib/finance'
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
  const total = contas.reduce((a, c) => a + c.valor, 0)
  const pago = total - totalPendente
  const proximo = pendentes.find((c) => c.vencimento)?.vencimento
  const dias = [...new Set(contas.map((c) => c.vencimento ?? 'sem'))]
  const visiveis = dia ? contas.filter((c) => (c.vencimento ?? 'sem') === dia) : contas
  const h = hoje()

  return (
    // no desktop não define a altura da linha (quem define é o card de saldo); a lista rola por dentro
    <Card className="flex flex-col lg:h-0 lg:min-h-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">
            Contas a pagar
            {proximo && <span className="ml-1.5 text-xs font-medium text-muted">· próxima {dataCurta(proximo)}</span>}
          </h2>
          <Money value={totalPendente} className="mt-3 text-4xl" />
          <div className="mt-1 text-xs text-muted">falta pagar</div>
        </div>
        <div className="hidden size-14 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary sm:flex">
          <CalendarCheck size={28} strokeWidth={1.7} />
        </div>
      </div>

      {contas.length > 0 && (
        <>
          {/* progresso do que já foi pago */}
          <div
            className="mt-5 flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-soft"
            role="progressbar"
            aria-valuenow={Math.round(total ? (pago / total) * 100 : 0)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Contas pagas"
          >
            {pago > 0 && <div className="bg-good" style={{ width: `${(pago / total) * 100}%` }} title={`Pago: ${brl(pago)}`} />}
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted tabular-nums">
            <span>
              <b className="font-semibold text-ink">{contas.length - pendentes.length}</b> de {contas.length} pagas
            </span>
            <span>{pago > 0 ? `${brl(pago)} pago` : `${brl(total)} no mês`}</span>
          </div>
        </>
      )}

      {dias.length > 1 && (
        <div className="scroll-thin -mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4 pb-1 text-xs sm:mx-0 sm:px-0" role="group" aria-label="Filtrar por vencimento">
          <Filtro ativo={dia === null} onClick={() => setDia(null)}>
            Todas
          </Filtro>
          {dias.map((d) => {
            const n = contas.filter((c) => (c.vencimento ?? 'sem') === d).length
            return (
              <Filtro key={d} ativo={dia === d} onClick={() => setDia(dia === d ? null : d)}>
                {d === 'sem' ? 'Sem data' : dataCurta(d)}
                <span className="ml-1 font-medium opacity-60">{n}</span>
              </Filtro>
            )
          })}
        </div>
      )}

      <ul className="scroll-thin mt-2 divide-y divide-line lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
        {visiveis.length === 0 && <Empty>Nada para pagar neste mês.</Empty>}
        {visiveis.map((c) => {
          const pago = !!c.pagamento
          const atrasada = !pago && !!c.vencimento && c.vencimento < h
          const venceHoje = !pago && c.vencimento === h
          return (
            <li key={c.ref} className="flex items-center gap-3 py-2.5">
              <button
                disabled={busy}
                onClick={() => onToggle(c)}
                title={pago ? 'Desmarcar' : 'Marcar como pago'}
                aria-label={pago ? `Desmarcar ${c.titulo}` : `Marcar ${c.titulo} como pago`}
                aria-pressed={pago}
                className={cx(
                  'relative flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition after:absolute after:-inset-2.5',
                  pago ? 'border-good bg-good text-white' : 'border-line hover:border-primary',
                )}
              >
                {pago && <Check size={14} strokeWidth={3} />}
              </button>
              <span className="h-7 w-1 shrink-0 rounded-full" style={{ background: c.cor || 'var(--color-line)' }} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className={cx('truncate text-sm font-semibold', pago && 'text-muted line-through')}>{c.titulo}</div>
                <div className="truncate text-xs text-muted">
                  {pago ? (
                    'pago'
                  ) : atrasada ? (
                    <span className="font-semibold text-bad">venceu {dataCurta(c.vencimento!)}</span>
                  ) : venceHoje ? (
                    <span className="font-semibold text-warn">vence hoje</span>
                  ) : c.vencimento ? (
                    `vence ${dataCurta(c.vencimento)}`
                  ) : (
                    'sem vencimento'
                  )}
                  {c.subtitulo && ` · ${c.subtitulo}`}
                </div>
              </div>
              <div className={cx('text-sm font-bold whitespace-nowrap tabular-nums', pago && 'text-muted')}>R$ {fmt(c.valor)}</div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function Filtro({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cx(
        'shrink-0 rounded-full px-3 py-1.5 font-semibold whitespace-nowrap tabular-nums transition-colors sm:px-2.5 sm:py-1',
        ativo ? 'bg-primary-soft text-primary' : 'bg-soft text-muted hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}
