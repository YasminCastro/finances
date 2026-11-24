import { ArrowDownRight, ArrowUpRight, Wallet } from 'lucide-react'
import { brl, mesCurto, pct } from '../../lib/finance'
import type { ResumoMes } from '../../lib/finance'
import { Button, Card, Money, cx } from '../ui'

export interface PontoHistorico {
  mes: string
  entradas: number
  saidas: number
}

export function SaldoCard({
  r,
  historico,
  onLancarFixos,
  busy,
}: {
  r: ResumoMes
  historico: PontoHistorico[]
  onLancarFixos: () => void
  busy: boolean
}) {
  const base = Math.max(r.entradas, r.saidas, 1)
  const sobra = Math.max(r.saldo, 0)
  const segs = [
    { label: 'Fixos', valor: r.fixos, cor: 'var(--color-seg-1)' },
    { label: 'Parcelas', valor: r.parcelas, cor: 'var(--color-seg-2)' },
    { label: 'Gastos do mês', valor: r.gastos, cor: 'var(--color-seg-3)' },
  ]
  const livre = r.entradas > 0 ? r.saldo / r.entradas : 0
  const positivo = r.saldo >= 0

  return (
    <Card className="flex flex-col lg:col-span-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-semibold">Saldo previsto</h2>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
            <Money value={r.saldo} className="text-5xl sm:text-6xl" tone={positivo ? 'default' : 'bad'} />
            <div className="border-line sm:border-l sm:pl-5">
              <div className={cx('flex items-center gap-1 text-sm font-semibold', positivo ? 'text-good' : 'text-bad')}>
                {positivo ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                {r.entradas > 0 ? `${pct(Math.abs(livre))} das entradas ${positivo ? 'livre' : 'acima'}` : 'sem entradas no mês'}
              </div>
              <div className="text-sm text-muted">valor estimado após pagar todas as contas</div>
            </div>
          </div>
        </div>
        <div className="hidden size-20 shrink-0 items-center justify-center rounded-3xl bg-primary-soft text-primary sm:flex">
          <Wallet size={40} strokeWidth={1.6} />
        </div>
      </div>

      <div className="mt-7 flex h-3 gap-1 overflow-hidden rounded-full bg-soft">
        {segs.map((s) =>
          s.valor > 0 ? (
            <div key={s.label} title={`${s.label}: ${brl(s.valor)}`} style={{ width: `${(s.valor / base) * 100}%`, background: s.cor }} />
          ) : null,
        )}
        {sobra > 0 && <div title={`Sobra: ${brl(sobra)}`} className="bg-good" style={{ width: `${(sobra / base) * 100}%` }} />}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5">
        <Legend label="Entradas" valor={brl(r.entradas)} />
        {segs.map((s) => (
          <Legend
            key={s.label}
            label={s.label}
            dot={s.cor}
            valor={`− ${brl(s.valor)}`}
            extra={r.entradas > 0 ? pct(s.valor / r.entradas) : undefined}
          />
        ))}
        <Legend
          label="= Sobra"
          dot="var(--color-good)"
          valor={brl(r.saldo)}
          strong
          tone={positivo ? 'text-good' : 'text-bad'}
          extra={r.entradas > 0 ? pct(livre) : undefined}
        />
      </div>

      <Historico pontos={historico} />

      {(r.fixosProjetados || r.investido !== 0) && (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4 text-sm">
          {r.fixosProjetados && (
            <>
              <span className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn">fixos estimados</span>
              <span className="text-muted">Os fixos deste mês vêm do modelo da aba “fixos”.</span>
              <Button onClick={onLancarFixos} disabled={busy} className="py-1.5 text-xs">
                Lançar fixos no mês
              </Button>
            </>
          )}
          {r.investido !== 0 && (
            <span className="text-muted sm:ml-auto">
              Investido no mês: <b className="text-ink">{brl(r.investido)}</b>
            </span>
          )}
        </div>
      )}
    </Card>
  )
}

function Historico({ pontos }: { pontos: PontoHistorico[] }) {
  const max = Math.max(...pontos.flatMap((p) => [p.entradas, p.saidas]), 1)
  return (
    <div className="mt-6 flex min-h-40 flex-1 flex-col border-t border-line pt-4">
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="font-semibold text-muted">Últimos 6 meses</span>
        <span className="flex gap-3 text-muted">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-good" /> Entradas
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-seg-2" /> Saídas
          </span>
        </span>
      </div>
      <div className="flex flex-1 items-end gap-3 sm:gap-6">
        {pontos.map((p, k) => {
          const atual = k === pontos.length - 1
          const saldo = p.entradas - p.saidas
          return (
            <div key={p.mes} className="flex h-full flex-1 flex-col items-center gap-1.5" title={`Entradas ${brl(p.entradas)} · Saídas ${brl(p.saidas)}`}>
              <div className={cx('text-[10px] font-semibold whitespace-nowrap', saldo >= 0 ? 'text-good' : 'text-bad')}>
                {saldo >= 0 ? '+' : '−'}
                {Math.abs(Math.round(saldo)).toLocaleString('pt-BR')}
              </div>
              <div className="flex w-full flex-1 items-end justify-center gap-1">
                <div className="w-full max-w-5 rounded-t-md bg-good/80" style={{ height: `${Math.max(2, (p.entradas / max) * 100)}%` }} />
                <div className="w-full max-w-5 rounded-t-md bg-seg-2" style={{ height: `${Math.max(2, (p.saidas / max) * 100)}%` }} />
              </div>
              <div className={cx('text-[11px]', atual ? 'font-bold text-ink' : 'text-muted')}>{mesCurto(p.mes)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Legend({
  label,
  valor,
  dot,
  extra,
  strong,
  tone,
}: {
  label: string
  valor: string
  dot?: string
  extra?: string
  strong?: boolean
  tone?: string
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        {dot && <span className="size-2 shrink-0 rounded-full" style={{ background: dot }} />}
        <span className={cx('truncate', strong && 'font-semibold text-ink')}>{label}</span>
      </div>
      <div className={cx('mt-0.5 text-sm font-bold whitespace-nowrap', tone)}>
        {valor}
        {extra && <span className="ml-1 text-xs font-medium text-faint">· {extra}</span>}
      </div>
    </div>
  )
}
