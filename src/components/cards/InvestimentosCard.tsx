import { PiggyBank } from 'lucide-react'
import { fmt, investimentosResumo, mesCurto } from '../../lib/finance'
import type { Model } from '../../lib/model'
import { Bar, Card, CardTitle, Money } from '../ui'

const CORES = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#0891b2', '#e11d48']

export function InvestimentosCard({ model, mes }: { model: Model; mes: string }) {
  const { total, destinos } = investimentosResumo(model, mes)
  const max = Math.max(...destinos.map((d) => d.valor), 1)
  const doMes = model.investimentos.filter((i) => i.mes_ref === mes)
  return (
    <Card>
      <CardTitle icon={<PiggyBank size={18} />}>Reserva e investimentos</CardTitle>
      <div className="text-xs text-muted">Acumulado até {mesCurto(mes)}</div>
      <Money value={total} className="mt-1 text-4xl" />
      <ul className="mt-5 space-y-3">
        {destinos.map((d, k) => (
          <li key={d.nome}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-medium">{d.nome}</span>
              <b>R$ {fmt(d.valor)}</b>
            </div>
            <Bar value={d.valor} max={max} color={CORES[k % CORES.length]} />
          </li>
        ))}
      </ul>
      {doMes.length > 0 && (
        <div className="mt-4 border-t border-line pt-3 text-xs text-muted">
          Neste mês:{' '}
          {doMes.map((i) => (
            <span key={i.id} className="mr-2 inline-block">
              {i.destino} <b className={i.valor < 0 ? 'text-bad' : 'text-good'}>{i.valor < 0 ? '−' : '+'}R$ {fmt(Math.abs(i.valor))}</b>
            </span>
          ))}
        </div>
      )}
    </Card>
  )
}
