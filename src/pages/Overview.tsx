import { CartoesCard } from '../components/cards/CartoesCard'
import { CategoriasCard } from '../components/cards/CategoriasCard'
import { ContasCard } from '../components/cards/ContasCard'
import { InvestimentosCard } from '../components/cards/InvestimentosCard'
import { ParcelasCard } from '../components/cards/ParcelasCard'
import { ReceberCard } from '../components/cards/ReceberCard'
import { SaldoCard } from '../components/cards/SaldoCard'
import { addMeses, categoriasDoMes, contasDoMes, resumoMes } from '../lib/finance'
import type { Model } from '../lib/model'
import type { Finance } from '../lib/store'

export function Overview({ model, mes, finance }: { model: Model; mes: string; finance: Finance }) {
  const r = resumoMes(model, mes)
  const contas = contasDoMes(model, mes)
  const { actions, busy } = finance
  const historico = [-5, -4, -3, -2, -1, 0].map((k) => {
    const m = addMeses(mes, k)
    const x = k === 0 ? r : resumoMes(model, m)
    return { mes: m, entradas: x.entradas, saidas: x.saidas }
  })
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
      <SaldoCard r={r} historico={historico} busy={busy} onLancarFixos={() => actions.lancarFixos(mes, r.itens)} />
      <ContasCard contas={contas} busy={busy} onToggle={(c) => actions.togglePago(mes, c)} />
      <CartoesCard model={model} mes={mes} />
      <CategoriasCard cats={categoriasDoMes(model, mes)} />
      <ReceberCard model={model} busy={busy} onToggle={actions.toggleRecebido} />
      <ParcelasCard model={model} mes={mes} itens={r.itens} />
      <InvestimentosCard model={model} mes={mes} />
    </div>
  )
}
