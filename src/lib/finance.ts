import { ordemAlfabetica } from './cores'
import { corCategoria, vigente } from './model'
import type { Entrada, Fixo, Forma, Lancamento, Model, Pagamento, Receber, VersaoFixa } from './model'

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
  entradasItens: Entrada[]
  entradasProjetadas: boolean
  fixos: number
  parcelas: number
  gastos: number
  saidas: number
  entradas: number
  saldo: number
  investido: number
}

function mesesEntre(de: string, ate: string) {
  const [y1, m1] = de.split('-').map(Number)
  const [y2, m2] = ate.split('-').map(Number)
  return (y2 - y1) * 12 + (m2 - m1)
}

/**
 * Ocorrência de uma conta fixa no mês: null se não acontece naquele mês.
 * Contas com repetição (a cada N meses) contam o ciclo a partir de mes_inicio;
 * cada ocorrência pode ser dividida em parcelas nos meses seguidos.
 */
export function ocorrenciaFixo(f: Fixo, mes: string): { valor: number; parcela: number; de: number } | null {
  if (!vigente(f, mes)) return null
  const freq = Math.max(1, f.frequencia)
  const parc = Math.min(Math.max(1, f.parcelas), freq)
  if (freq === 1 && parc === 1) return { valor: f.valor, parcela: 1, de: 1 }
  const ancora = f.mes_inicio || mes
  const d = mesesEntre(ancora, mes)
  if (d < 0) return null
  const k = d % freq
  if (k >= parc) return null
  // conta em centavos inteiros; a última parcela leva a sobra do arredondamento
  const centavos = Math.round(f.valor * 100)
  const base = Math.floor(centavos / parc)
  const valor = (k === parc - 1 ? centavos - base * (parc - 1) : base) / 100
  return { valor, parcela: k + 1, de: parc }
}

/** Próximo mês (a partir de `mes`, inclusive) em que a conta acontece. */
export function proximaOcorrencia(f: Fixo, mes: string, limite = 36): string | null {
  for (let i = 0; i < limite; i++) {
    const m = addMeses(mes, i)
    if (ocorrenciaFixo(f, m)) return m
  }
  return null
}

/**
 * Itens do mês. As contas fixas vêm da aba "fixos" (versão vigente no mês), exceto:
 * - meses com fixos lançados à moda antiga (sem fixo_id, ex.: histórico importado) → usa só os lançados;
 * - contas com ajuste "só neste mês" (lançamento tipo fixo com fixo_id) → o ajuste substitui o modelo.
 */
export function itensDoMes(model: Model, mes: string): { itens: Lancamento[]; fixosProjetados: boolean } {
  const doMes = model.lancamentos.filter((l) => l.mes_ref === mes)
  const legado = doMes.some((l) => l.tipo === 'fixo' && !l.fixo_id)
  if (legado || (model.primeiroMes && mes < model.primeiroMes)) return { itens: doMes, fixosProjetados: false }
  const ajustadas = new Set(doMes.filter((l) => l.tipo === 'fixo').map((l) => l.fixo_id))
  const projetados: Lancamento[] = model.fixos
    .filter((f) => !ajustadas.has(f.serie))
    .map((f) => ({ f, oc: ocorrenciaFixo(f, mes) }))
    .filter((x): x is { f: Fixo; oc: NonNullable<ReturnType<typeof ocorrenciaFixo>> } => x.oc !== null)
    .map(({ f, oc }) => ({
      id: `fixo:${f.serie}`,
      mes_ref: mes,
      data: '',
      descricao: oc.de > 1 ? `${f.descricao} (${oc.parcela}/${oc.de})` : f.descricao,
      valor: oc.valor,
      categoria: f.categoria,
      forma_pagamento: f.forma_pagamento,
      tipo: 'fixo',
      parcelas_restantes: null,
      parcelamento_id: '',
      fixo_id: f.serie,
      projetado: true,
      fixo: f,
    }))
  return { itens: [...projetados, ...doMes], fixosProjetados: projetados.length > 0 }
}

/**
 * Entradas do mês. Cada entrada fixa (ex.: Salário) aparece como estimada
 * enquanto não houver no mês uma entrada lançada com o mesmo nome.
 */
export function entradasDoMes(model: Model, mes: string): { itens: Entrada[]; projetadas: boolean } {
  const doMes = model.entradas.filter((e) => e.mes_ref === mes)
  if (model.primeiroMes && mes < model.primeiroMes) return { itens: doMes, projetadas: false }
  const nomes = new Set(doMes.map((e) => e.descricao.toLowerCase()))
  const projetadas: Entrada[] = model.entradasFixas
    .filter((f) => vigente(f, mes) && !nomes.has(f.descricao.toLowerCase()))
    .map((f) => ({ id: `ef:${f.id}`, mes_ref: mes, descricao: f.descricao, valor: f.valor, projetado: true }))
  return { itens: [...doMes, ...projetadas], projetadas: projetadas.length > 0 }
}

export function resumoMes(model: Model, mes: string): ResumoMes {
  const { itens, fixosProjetados } = itensDoMes(model, mes)
  const fixos = sum(itens.filter((l) => l.tipo === 'fixo'))
  const parcelas = sum(itens.filter((l) => l.tipo === 'parcela'))
  const gastos = sum(itens.filter((l) => l.tipo === 'gasto'))
  const saidas = fixos + parcelas + gastos
  const ent = entradasDoMes(model, mes)
  const entradas = sum(ent.itens)
  const investido = sum(model.investimentos.filter((i) => i.mes_ref === mes))
  return {
    itens,
    fixosProjetados,
    entradasItens: ent.itens,
    entradasProjetadas: ent.projetadas,
    fixos,
    parcelas,
    gastos,
    saidas,
    entradas,
    saldo: entradas - saidas,
    investido,
  }
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

function menosDias(iso: string, n: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d - n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/** Data de fechamento da fatura do mês de referência (null se o cartão não tiver os dias configurados). */
export function fechamentoFatura(forma: Forma, mes: string) {
  const v = vencimentoFatura(forma, mes)
  return v && forma.dias_fechamento != null ? menosDias(v, forma.dias_fechamento) : null
}

/**
 * Em qual fatura (mês de referência) cai uma compra no cartão feita na data informada.
 * Compras antes da data de fechamento entram na fatura; no dia do fechamento ou depois, vão para a próxima.
 */
export function faturaDaCompra(forma: Forma | undefined, data: string): { mes_ref: string; vencimento: string; fechamento: string } | null {
  if (!forma?.cartao || !forma.dia_vencimento || forma.dias_fechamento == null || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return null
  // começa pela fatura cujo mês de referência é o mês da compra menos 1 e avança até achar
  let mes = addMeses(data.slice(0, 7), -1)
  for (let i = 0; i < 4; i++, mes = addMeses(mes, 1)) {
    const fech = fechamentoFatura(forma, mes)
    if (fech && data < fech) return { mes_ref: mes, vencimento: vencimentoFatura(forma, mes)!, fechamento: fech }
  }
  return null
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
      const ref = l.projetado ? `fixo:${l.fixo!.serie}` : `lanc:${l.id}`
      const modelo = l.fixo ?? (l.fixo_id ? model.fixos.find((f) => f.serie === l.fixo_id) : undefined)
      contas.push({
        ref,
        titulo: l.descricao,
        subtitulo: [l.forma_pagamento || 'Sem forma', l.tipo === 'parcela' && l.parcelas_restantes ? `faltam ${l.parcelas_restantes}` : '']
          .filter(Boolean)
          .join(' · '),
        valor: l.valor,
        vencimento: venc(mes, modelo?.dia_vencimento ?? null),
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

// ---------- séries de fixos (contas fixas e entradas fixas) ----------

export interface Serie<T extends VersaoFixa> {
  serie: string
  versoes: T[] // ordenadas por início
  /** versão que vale no mês consultado */
  atual?: T
  /** próxima alteração agendada depois do mês consultado */
  proxima?: T
  /** a série termina depois do mês consultado (tem mes_fim e nenhuma versão seguinte) */
  terminaEm?: string
}

export function seriesFixas<T extends VersaoFixa>(versoes: T[], mes: string): Serie<T>[] {
  const grupos = new Map<string, T[]>()
  for (const v of versoes) grupos.set(v.serie, [...(grupos.get(v.serie) ?? []), v])
  return [...grupos.entries()].map(([serie, vs]) => {
    const ord = [...vs].sort((a, b) => (a.mes_inicio || '0000').localeCompare(b.mes_inicio || '0000'))
    const atual = ord.find((v) => vigente(v, mes))
    const proxima = ord.find((v) => v.ativo && v.mes_inicio > mes)
    const ultima = ord.filter((v) => v.ativo).pop()
    return { serie, versoes: ord, atual, proxima, terminaEm: !proxima && ultima?.mes_fim && ultima.mes_fim >= mes ? ultima.mes_fim : undefined }
  })
}

// ---------- cartões ----------

export function faturaCartao(model: Model, mes: string, cartao: string) {
  return sum(itensDoMes(model, mes).itens.filter((l) => l.forma_pagamento.toLowerCase() === cartao.toLowerCase()))
}

/**
 * Limite do cartão: usado = faturas não pagas que ainda não venceram (inclui parcelas futuras já lançadas).
 * Contas fixas estimadas só entram até o mês atual (as futuras ainda não foram cobradas).
 */
export function limiteCartao(model: Model, forma: Forma, hojeISO = hoje()) {
  if (!forma.limite) return null
  const nome = forma.nome.toLowerCase()
  const doCartao = (l: Lancamento) => l.forma_pagamento.toLowerCase() === nome
  const meses = model.lancamentos.filter(doCartao).map((l) => l.mes_ref)
  const atual = mesAtual()
  const ultimo = meses.reduce((a, b) => (a > b ? a : b), atual)
  let usado = 0
  for (let m = addMeses(atual, -2); m <= ultimo; m = addMeses(m, 1)) {
    const venc = vencimentoFatura(forma, m) ?? `${forma.mes_seguinte ? addMeses(m, 1) : m}-28`
    if (venc < hojeISO) continue
    if (model.pagamentos.some((p) => p.mes_ref === m && p.referencia.toLowerCase() === `fatura:${nome}`)) continue
    const itens = m <= atual ? itensDoMes(model, m).itens : model.lancamentos.filter((l) => l.mes_ref === m)
    usado += sum(itens.filter(doCartao))
  }
  return { limite: forma.limite, usado, livre: forma.limite - usado }
}

// ---------- categorias ----------

export interface CategoriaResumo {
  nome: string
  cor: string
  gasto: number
  orcamento: number
}

/** Gastos do mês por categoria, em ordem alfabética. */
export function categoriasDoMes(model: Model, mes: string): CategoriaResumo[] {
  const { itens } = itensDoMes(model, mes)
  const mapa = new Map<string, CategoriaResumo>()
  for (const c of model.categorias) mapa.set(c.nome, { nome: c.nome, cor: c.cor, gasto: 0, orcamento: c.orcamento })
  for (const l of itens) {
    const c = mapa.get(l.categoria) ?? { nome: l.categoria, cor: corCategoria(model, l.categoria), gasto: 0, orcamento: 0 }
    c.gasto += l.valor
    mapa.set(l.categoria, c)
  }
  return [...mapa.values()].filter((c) => c.gasto > 0 || c.orcamento > 0).sort((a, b) => ordemAlfabetica(a.nome, b.nome))
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
