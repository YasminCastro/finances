import type { Forma, Lancamento, Model, Pagamento, Receber } from './model'

// ---------- meses e formatação ----------

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function mesAtual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function hoje() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addMeses(mes: string, n: number) {
  const [y, m] = mes.split('-').map(Number)
  const t = y * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}

export function nomeMes(mes: string) {
  const [, m] = mes.split('-').map(Number)
  return MESES[m - 1] ?? mes
}

export function mesCurto(mes: string, comAno = true) {
  const [y, m] = mes.split('-').map(Number)
  const n = (MESES[m - 1] ?? '???').slice(0, 3)
  return comAno ? `${n}/${String(y).slice(2)}` : n
}

export function dataCurta(d: string) {
  const m = d.match(/^\d{4}-(\d{2})-(\d{2})/)
  return m ? `${m[2]}/${m[1]}` : d
}

const nf = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const fmt = (v: number) => nf.format(v)
export const brl = (v: number) => (v < 0 ? '− R$ ' : 'R$ ') + nf.format(Math.abs(v))
export const pct = (v: number) => `${Math.round(v * 100)}%`

const sum = (xs: { valor: number }[]) => xs.reduce((a, x) => a + x.valor, 0)

// ---------- resumo do mês ----------

export interface ResumoMes {
  itens: Lancamento[]
  fixosProjetados: boolean
  fixos: number
  parcelas: number
  gastos: number
  saidas: number
  entradas: number
  saldo: number
  investido: number
}

/** Itens do mês. Se o mês ainda não tem fixos lançados, usa o modelo da aba "fixos". */
export function itensDoMes(model: Model, mes: string): { itens: Lancamento[]; fixosProjetados: boolean } {
  const doMes = model.lancamentos.filter((l) => l.mes_ref === mes)
  const temFixos = doMes.some((l) => l.tipo === 'fixo')
  const podeProjetar = !temFixos && (!model.primeiroMes || mes >= model.primeiroMes)
  if (!podeProjetar) return { itens: doMes, fixosProjetados: false }
  const projetados: Lancamento[] = model.fixos
    .filter((f) => f.ativo)
    .map((f) => ({
      id: `fixo:${f.id}`,
      mes_ref: mes,
      data: '',
      descricao: f.descricao,
      valor: f.valor,
      categoria: f.categoria,
      forma_pagamento: f.forma_pagamento,
      tipo: 'fixo',
      parcelas_restantes: null,
      parcelamento_id: '',
      projetado: true,
      fixo: f,
    }))
  return { itens: [...projetados, ...doMes], fixosProjetados: projetados.length > 0 }
}

export function resumoMes(model: Model, mes: string): ResumoMes {
  const { itens, fixosProjetados } = itensDoMes(model, mes)
  const fixos = sum(itens.filter((l) => l.tipo === 'fixo'))
  const parcelas = sum(itens.filter((l) => l.tipo === 'parcela'))
  const gastos = sum(itens.filter((l) => l.tipo === 'gasto'))
  const saidas = fixos + parcelas + gastos
  const entradas = sum(model.entradas.filter((e) => e.mes_ref === mes))
  const investido = sum(model.investimentos.filter((i) => i.mes_ref === mes))
  return { itens, fixosProjetados, fixos, parcelas, gastos, saidas, entradas, saldo: entradas - saidas, investido }
}

// ---------- contas a pagar ----------

export interface Conta {
  ref: string
  titulo: string
  subtitulo: string
  valor: number
  vencimento: string | null // AAAA-MM-DD
  cor: string
  cartao: boolean
  pagamento?: Pagamento
}

export function formaDe(model: Model, nome: string): Forma | undefined {
  return model.formas.find((f) => f.nome.toLowerCase() === nome.toLowerCase())
}

function venc(mes: string, dia: number | null) {
  if (!dia) return null
  const [y, m] = mes.split('-').map(Number)
  const ultimo = new Date(y, m, 0).getDate()
  return `${mes}-${String(Math.min(dia, ultimo)).padStart(2, '0')}`
}

export function vencimentoFatura(forma: Forma, mes: string) {
  return venc(forma.mes_seguinte ? addMeses(mes, 1) : mes, forma.dia_vencimento)
}

export function contasDoMes(model: Model, mes: string): Conta[] {
  const { itens } = itensDoMes(model, mes)
  const contas: Conta[] = []
  const porCartao = new Map<string, Lancamento[]>()
  for (const l of itens) {
    const f = formaDe(model, l.forma_pagamento)
    if (f?.cartao) {
      const k = f.nome
      porCartao.set(k, [...(porCartao.get(k) ?? []), l])
    } else {
      const ref = l.projetado ? `fixo:${l.fixo!.id}` : `lanc:${l.id}`
      contas.push({
        ref,
        titulo: l.descricao,
        subtitulo: [l.forma_pagamento || 'Sem forma', l.tipo === 'parcela' && l.parcelas_restantes ? `faltam ${l.parcelas_restantes}` : '']
          .filter(Boolean)
          .join(' · '),
        valor: l.valor,
        vencimento: venc(mes, l.fixo?.dia_vencimento ?? null),
        cor: f?.cor || '',
        cartao: false,
      })
    }
  }
  for (const [nome, ls] of porCartao) {
    const f = formaDe(model, nome)!
    contas.push({
      ref: `fatura:${nome}`,
      titulo: `Fatura ${nome}`,
      subtitulo: `${ls.length} ${ls.length === 1 ? 'lançamento' : 'lançamentos'}`,
      valor: sum(ls),
      vencimento: vencimentoFatura(f, mes),
      cor: f.cor,
      cartao: true,
    })
  }
  for (const c of contas) c.pagamento = model.pagamentos.find((p) => p.mes_ref === mes && p.referencia === c.ref)
  return contas.sort((a, b) => (a.vencimento ?? '9999').localeCompare(b.vencimento ?? '9999') || b.valor - a.valor)
}

// ---------- cartões ----------

export function faturaCartao(model: Model, mes: string, cartao: string) {
  return sum(itensDoMes(model, mes).itens.filter((l) => l.forma_pagamento.toLowerCase() === cartao.toLowerCase()))
}

// ---------- categorias ----------

export interface CategoriaResumo {
  nome: string
  gasto: number
  orcamento: number
}

export function categoriasDoMes(model: Model, mes: string): CategoriaResumo[] {
  const { itens } = itensDoMes(model, mes)
  const mapa = new Map<string, CategoriaResumo>()
  for (const c of model.categorias) mapa.set(c.nome, { nome: c.nome, gasto: 0, orcamento: c.orcamento })
  for (const l of itens) {
    const c = mapa.get(l.categoria) ?? { nome: l.categoria, gasto: 0, orcamento: 0 }
    c.gasto += l.valor
    mapa.set(l.categoria, c)
  }
  return [...mapa.values()].filter((c) => c.gasto > 0 || c.orcamento > 0).sort((a, b) => b.gasto - a.gasto)
}

// ---------- parcelas ----------

export function parcelasPorMes(model: Model, mes: string, n = 12) {
  return Array.from({ length: n }, (_, k) => {
    const m = addMeses(mes, k)
    return { mes: m, valor: sum(model.lancamentos.filter((l) => l.tipo === 'parcela' && l.mes_ref === m)) }
  })
}

// ---------- a receber / investimentos ----------

export function receberPendente(model: Model) {
  const pend = model.receber.filter((r) => !r.recebido)
  const porPessoa = new Map<string, Receber[]>()
  for (const r of pend) porPessoa.set(r.pessoa, [...(porPessoa.get(r.pessoa) ?? []), r])
  return {
    total: sum(pend),
    pessoas: [...porPessoa.entries()]
      .map(([pessoa, itens]) => ({ pessoa, itens: itens.sort((a, b) => a.mes_ref.localeCompare(b.mes_ref)), total: sum(itens) }))
      .sort((a, b) => b.total - a.total),
  }
}

export function investimentosResumo(model: Model, ateMes: string) {
  const ate = model.investimentos.filter((i) => i.mes_ref <= ateMes)
  const destinos = new Map<string, number>()
  for (const d of model.destinos) destinos.set(d, 0)
  for (const i of ate) destinos.set(i.destino, (destinos.get(i.destino) ?? 0) + i.valor)
  return {
    total: sum(ate),
    destinos: [...destinos.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor),
  }
}
