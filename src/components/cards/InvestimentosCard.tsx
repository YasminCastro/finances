import { PiggyBank } from 'lucide-react'
import { brl, corDoDestino, fmt, investimentosResumo, mesCurto, metaDoDestino, salarioFixo } from '../../lib/finance'
import type { Model } from '../../lib/model'
import { Card, Money, cx } from '../kit'

export function InvestimentosCard({ model, mes }: { model: Model; mes: string }) {
  const { total, destinos } = investimentosResumo(model, mes)
  // destinos com meta aparecem mesmo zerados, como na página de Investimentos
  const lista = [
    ...destinos,
    ...model.destinos.filter((d) => model.metas[d] && !destinos.some((x) => x.nome === d)).map((nome) => ({ nome, valor: 0 })),
  ]

  const doMes = model.investimentos.filter((i) => i.mes_ref === mes)
  const investido = doMes.reduce((a, i) => a + i.valor, 0)
  const metaMes = salarioFixo(model, mes) * model.limites.investimento
  const pctMes = metaMes > 0 ? Math.max(0, investido / metaMes) : 0

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold">
            Reserva e investimentos
          </h2>
          <Money value={total} className="mt-3 text-4xl" />
          <div className="mt-1 text-xs text-muted">guardado até {mesCurto(mes)}</div>
        </div>
        <div className="hidden size-14 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary sm:flex">
          <PiggyBank size={28} strokeWidth={1.7} />
        </div>
      </div>

      {/* aporte do mês contra a meta mensal */}
      <div className="mt-5 rounded-2xl bg-soft/70 p-3">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="font-semibold text-muted">Investido em {mesCurto(mes)}</span>
          <span className="tabular-nums">
            <b className={cx('text-sm font-bold', investido < 0 ? 'text-bad' : 'text-ink')}>
              {investido < 0 ? '−' : ''}
              {brl(Math.abs(investido))}
            </b>
            {metaMes > 0 && <span className="text-muted"> / {fmt(metaMes)}</span>}
          </span>
        </div>
        {metaMes > 0 && (
          <>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-card"
              role="progressbar"
              aria-valuenow={Math.round(Math.min(1, pctMes) * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Investido no mês em relação à meta"
            >
              <div className={cx('h-full rounded-full', pctMes >= 1 ? 'bg-good' : 'bg-primary')} style={{ width: `${Math.min(1, pctMes) * 100}%` }} />
            </div>
            <div className={cx('mt-1 text-[11px] tabular-nums', pctMes >= 1 ? 'font-semibold text-good' : 'text-muted')}>
              {pctMes >= 1 ? 'Meta do mês atingida' : investido <= 0 ? 'Nada investido ainda' : `${Math.round(pctMes * 100)}% da meta do mês · faltam ${brl(metaMes - investido)}`}
            </div>
          </>
        )}
      </div>

      {/* onde está o dinheiro, com o progresso de cada meta */}
      {lista.length > 0 && (
        <ul className="mt-4 space-y-3.5">
          {lista.map((d) => {
            const cor = corDoDestino(model, d.nome)
            const meta = metaDoDestino(model, d.nome, mes)
            const p = meta ? Math.min(1, d.valor / meta) : 0
            return (
              <li key={d.nome}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: cor }} aria-hidden />
                    <span className="truncate font-medium">{d.nome}</span>
                  </span>
                  <span className="whitespace-nowrap tabular-nums">
                    <b className="font-semibold">R$ {fmt(d.valor)}</b>
                    {meta !== null && <span className="text-xs text-muted"> / {fmt(meta)}</span>}
                  </span>
                </div>
                {meta !== null ? (
                  <>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-soft"
                      role="progressbar"
                      aria-valuenow={Math.round(p * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${d.nome}: ${Math.round(p * 100)}% da meta`}
                    >
                      <div className="h-full rounded-full" style={{ width: `${p * 100}%`, background: cor }} />
                    </div>
                    <div className={cx('mt-1 text-[11px] tabular-nums', p >= 1 ? 'font-semibold text-good' : 'text-muted')}>
                      {p >= 1 ? 'Meta atingida' : `${Math.round(p * 100)}% da meta · faltam ${brl(meta - d.valor)}`}
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-muted">Sem meta</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
