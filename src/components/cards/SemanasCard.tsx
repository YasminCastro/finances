import { CalendarRange } from 'lucide-react'
import { brl, dataCurta, fmt, hoje } from '../../lib/finance'
import type { FaixaSemana, SemanaResumo } from '../../lib/finance'
import { Card, CardTitle, Empty, Money, cx } from '../kit'

export const faixaCurta = (s: FaixaSemana) => `${s.inicio.slice(8)}–${dataCurta(s.fim)}`

/** Saídas do mês semana a semana; clicar numa semana filtra o painel por ela. */
export function SemanasCard({
  semanas,
  selecionada,
  onSelecionar,
  filtrando,
}: {
  semanas: SemanaResumo[]
  selecionada: string | null
  onSelecionar: (inicio: string | null) => void
  filtrando: boolean
}) {
  const h = hoje()
  const idxAtual = semanas.findIndex((s) => s.inicio <= h && h <= s.fim)
  const idxSel = semanas.findIndex((s) => s.inicio === selecionada)
  // em destaque: a semana escolhida; sem escolha, a semana atual
  const idx = idxSel >= 0 ? idxSel : idxAtual
  const destaque = idx >= 0 ? semanas[idx] : null
  const anterior = idx > 0 ? semanas[idx - 1] : null
  // a média só considera semanas que já terminaram (a atual ainda está em andamento)
  const fechadas = semanas.filter((s) => s.fim < h)
  const media = fechadas.length ? fechadas.reduce((a, s) => a + s.total, 0) / fechadas.length : 0
  const total = semanas.reduce((a, s) => a + s.total, 0)
  const max = Math.max(...semanas.map((s) => s.total), media, 1)

  return (
    <Card className="flex flex-col">
      <CardTitle icon={<CalendarRange size={18} />} extra={filtrando && <span className="text-xs text-muted">filtradas</span>}>
        Saídas por semana
      </CardTitle>

      {destaque ? (
        <>
          <div className="text-xs text-muted">
            {idx === idxAtual ? 'Esta semana' : `Semana ${idx + 1}`} · {faixaCurta(destaque)}
          </div>
          <Money value={destaque.total} className="mt-1 text-4xl" />
          {anterior && (
            <div className="mt-1 text-xs text-muted">
              {destaque.total === anterior.total ? (
                'igual à semana anterior'
              ) : (
                <>
                  <b className={cx('font-semibold', destaque.total > anterior.total ? 'text-bad' : 'text-good')}>
                    {brl(Math.abs(destaque.total - anterior.total))} {destaque.total > anterior.total ? 'a mais' : 'a menos'}
                  </b>{' '}
                  que a semana anterior
                </>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="text-xs text-muted">{fechadas.length ? 'Média por semana' : 'Total do mês'}</div>
          <Money value={fechadas.length ? media : total} className="mt-1 text-4xl" />
        </>
      )}

      {total === 0 ? (
        <div className="mt-4">
          <Empty>Sem saídas neste mês.</Empty>
        </div>
      ) : (
        <ul className="mt-4 space-y-1 border-t border-line pt-3">
          {semanas.map((s, k) => {
            const ehAtual = k === idxAtual
            const sel = s.inicio === selecionada
            const futura = s.inicio > h
            const acima = fechadas.length > 1 && s.fim < h && s.total > media * 1.25
            return (
              <li key={s.inicio}>
                <button
                  type="button"
                  aria-pressed={sel}
                  onClick={() => onSelecionar(sel ? null : s.inicio)}
                  title={sel ? 'Voltar para o mês inteiro' : `Filtrar o painel pela semana ${k + 1}`}
                  className={cx(
                    'w-full rounded-xl px-2 py-1.5 text-left transition-colors',
                    sel ? 'bg-primary-soft ring-2 ring-primary' : ehAtual ? 'bg-primary-soft/50 hover:bg-primary-soft' : 'hover:bg-soft',
                    futura && !sel && 'opacity-50',
                  )}
                >
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className={cx('font-semibold', (sel || ehAtual) && 'text-primary')}>Semana {k + 1}</span>
                      <span className="truncate text-xs text-muted">{faixaCurta(s)}</span>
                    </span>
                    <span className={cx('font-semibold whitespace-nowrap tabular-nums', acima && 'text-bad', s.total === 0 && 'text-muted')}>
                      R$ {fmt(s.total)}
                    </span>
                  </div>
                  {/* barra comparável entre semanas; o tracinho marca a média das semanas fechadas */}
                  <div className="relative h-2 rounded-full bg-soft">
                    <div className={cx('h-full rounded-full', acima ? 'bg-bad' : 'bg-seg-3')} style={{ width: `${(s.total / max) * 100}%` }} />
                    {media > 0 && (
                      <div
                        className="absolute -top-0.5 h-3 w-0.5 rounded bg-ink/60"
                        style={{ left: `calc(${(media / max) * 100}% - 1px)` }}
                        title={`Média: ${brl(media)}`}
                      />
                    )}
                  </div>
                  <div className="mt-1 flex justify-between gap-2 text-[11px] text-muted tabular-nums">
                    <span>
                      {futura ? 'previsão' : s.itens.length ? `${s.itens.length} ${s.itens.length === 1 ? 'lançamento' : 'lançamentos'}` : 'nada gasto'}
                      {s.dias !== 7 && ` · ${s.dias} dias`}
                    </span>
                    {acima ? (
                      <span className="font-semibold text-bad">acima da média</span>
                    ) : (
                      ehAtual && <span className="font-semibold text-primary">em andamento</span>
                    )}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-auto pt-3 text-[11px] text-muted">
        Clique numa semana para filtrar o painel.
        {media > 0 && ` O tracinho marca a média (${brl(media)}).`}
      </p>
    </Card>
  )
}
