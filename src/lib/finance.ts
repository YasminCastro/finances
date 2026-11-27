import { ordemAlfabetica } from './cores'
import { corCategoria, vigente } from './model'
import type { Entrada, Fixo, Forma, Lancamento, Model, Pagamento, Receber, Rodizio, VersaoFixa } from './model'

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

/** Divide um total em N parcelas iguais (em centavos); a sobra dos centavos vai para a 1ª. */
export function dividirParcelas(total: number, n: number): number[] {
  const centavos = Math.round(total * 100)
  const base = Math.floor(centavos / n)
  return Array.from({ length: n }, (_, k) => (k === 0 ? centavos - base * (n - 1) : base) / 100)
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
  // conta fixa lançada sem data usa o dia da cobrança do modelo (pelo fixo_id ou, nos antigos, pelo nome)
  const diaCobranca = (l: Lancamento) => {
    const nome = l.descricao.trim().toLowerCase()
    const doMesmo = l.fixo_id
      ? model.fixos.filter((f) => f.serie === l.fixo_id)
      : model.fixos.filter((f) => f.descricao.trim().toLowerCase() === nome)
    const comDia = doMesmo.filter((f) => f.dia_vencimento)
    return (comDia.find((f) => vigente(f, mes)) ?? comDia[comDia.length - 1])?.dia_vencimento ?? null
  }
  const doMes = model.lancamentos
    .filter((l) => l.mes_ref === mes)
    .map((l) => {
      if (l.tipo !== 'fixo' || l.data) return l
      const dia = diaCobranca(l)
      return dia ? { ...l, data: venc(mes, dia)! } : l
    })
  // fixos lançados sem fixo_id (vindos da planilha antiga) só são reconhecidos pelo nome
  const legado = doMes.some((l) => l.tipo === 'fixo' && !l.fixo_id)
  // meses passados no formato antigo ficam como foram lançados; do mês atual em diante, completa com os fixos que faltam
  if ((legado && mes < mesAtual()) || (model.primeiroMes && mes < model.primeiroMes)) return { itens: doMes, fixosProjetados: false }
  const nomesLancados = new Set(doMes.filter((l) => l.tipo === 'fixo' && !l.fixo_id).map((l) => l.descricao.trim().toLowerCase()))
  const ajustadas = new Set(doMes.filter((l) => l.tipo === 'fixo').map((l) => l.fixo_id))
  for (const f of model.fixos) if (nomesLancados.has(f.descricao.trim().toLowerCase())) ajustadas.add(f.serie)
  const projetados: Lancamento[] = model.fixos
    .filter((f) => !ajustadas.has(f.serie))
    .map((f) => ({ f, oc: ocorrenciaFixo(f, mes) }))
    .filter((x): x is { f: Fixo; oc: NonNullable<ReturnType<typeof ocorrenciaFixo>> } => x.oc !== null)
    .map(({ f, oc }) => ({
      id: `fixo:${f.serie}`,
      mes_ref: mes,
      data: venc(mes, f.dia_vencimento) ?? '', // aparece nos lançamentos no dia da cobrança
      descricao: oc.de > 1 ? `${f.descricao} (${oc.parcela}/${oc.de})` : f.descricao,
      valor: oc.valor,
      categoria: f.categoria,
      forma_pagamento: f.forma_pagamento,
      tipo: 'fixo',
      parcelas_restantes: null,
      parcelamento_id: '',
      fixo_id: f.serie,
      carro: '',
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
  // gastos que outra pessoa pagou por você (abatidos do que ela te deve) não são contas a pagar
  const abatidos = new Set(model.receber.filter((r) => r.valor < 0 && r.origem).map((r) => r.origem))
  for (const l of itens) {
    if (abatidos.has(l.id)) continue
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
        // data de pagamento do lançamento (no mesmo dia em cada mês, nas parcelas) ou o dia da cobrança do fixo
        vencimento: l.vencimento
          ? l.tipo === 'parcela'
            ? venc(mes, Number(l.vencimento.slice(8, 10)))
            : l.vencimento
          : venc(mes, modelo?.dia_vencimento ?? null),
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
  /** quanto costuma gastar (ver sugestoesOrcamento); null = histórico insuficiente */
  sugestao: number | null
}

export interface SugestaoOrcamento {
  valor: number
  /** quantos meses entraram na conta */
  meses: number
}

const MESES_SUGESTAO = 6
const MIN_MESES_SUGESTAO = 3

/**
 * Sugestão de orçamento por categoria: a mediana dos gastos avulsos (tipo "gasto")
 * dos últimos 6 meses com lançamentos antes de `mes`. Fixos e parcelas ficam de fora —
 * já são conhecidos de antemão, e uma compra grande parcelada inflaria o histórico.
 * Meses em que a categoria não teve gasto contam como zero. É só uma referência:
 * nada é gravado como orçamento.
 */
export function sugestoesOrcamento(model: Model, mes: string): Map<string, SugestaoOrcamento> {
  const gastos = model.lancamentos.filter((l) => l.tipo === 'gasto' && !l.projetado && l.mes_ref < mes)
  const meses = [...new Set(gastos.map((l) => l.mes_ref))].sort().slice(-MESES_SUGESTAO)
  const out = new Map<string, SugestaoOrcamento>()
  if (meses.length < MIN_MESES_SUGESTAO) return out
  const porCat = new Map<string, Map<string, number>>()
  for (const l of gastos) {
    if (!meses.includes(l.mes_ref)) continue
    const chave = l.categoria.toLowerCase()
    const m = porCat.get(chave) ?? new Map<string, number>()
    m.set(l.mes_ref, (m.get(l.mes_ref) ?? 0) + l.valor)
    porCat.set(chave, m)
  }
  for (const [chave, m] of porCat) {
    const vals = meses.map((x) => m.get(x) ?? 0).sort((a, b) => a - b)
    const meio = vals.length / 2
    const mediana = vals.length % 2 ? vals[Math.floor(meio)] : (vals[meio - 1] + vals[meio]) / 2
    // arredonda para cima, de 10 em 10: é uma referência, não um valor exato
    const valor = Math.ceil(mediana / 10) * 10
    if (valor > 0) out.set(chave, { valor, meses: meses.length })
  }
  return out
}

/** Gastos do mês por categoria, em ordem alfabética. */
export function categoriasDoMes(model: Model, mes: string): CategoriaResumo[] {
  const { itens } = itensDoMes(model, mes)
  const sugestoes = sugestoesOrcamento(model, mes)
  const sug = (nome: string) => sugestoes.get(nome.toLowerCase())?.valor ?? null
  const mapa = new Map<string, CategoriaResumo>()
  for (const c of model.categorias) mapa.set(c.nome, { nome: c.nome, cor: c.cor, gasto: 0, orcamento: c.orcamento, sugestao: sug(c.nome) })
  for (const l of itens) {
    const c = mapa.get(l.categoria) ?? { nome: l.categoria, cor: corCategoria(model, l.categoria), gasto: 0, orcamento: 0, sugestao: sug(l.categoria) }
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

/** Meses de `de` até `ate` (negativo se `ate` vem antes). */
export function difMeses(de: string, ate: string) {
  const [y1, m1] = de.split('-').map(Number)
  const [y2, m2] = ate.split('-').map(Number)
  return (y2 - y1) * 12 + (m2 - m1)
}

/** De quem é a vez no rodízio em `mes` (null antes do início). */
export function vezDoRodizio(r: Rodizio, mes: string): string | null {
  const n = r.membros.length
  const k = difMeses(r.mes_inicio, mes)
  if (!n || !r.mes_inicio || k < 0) return null
  return r.membros[k % n]
}

/** Valor do rodízio no mês: o da conta fixa ligada (se houver nesse mês) ou o valor cadastrado. */
export function valorDoRodizio(model: Model, r: Rodizio, mes: string) {
  if (r.fixo_id) {
    const f = model.fixos.find((x) => x.serie === r.fixo_id && vigente(x, mes))
    const oc = f && ocorrenciaFixo(f, mes)
    if (oc) return oc.valor
  }
  return r.valor
}

/**
 * Tudo que é para receber: as linhas da aba a_receber + a vez de cada pessoa nos rodízios
 * (do início do rodízio até o mês atual) que ainda não virou linha.
 */
export function receberItens(model: Model): Receber[] {
  const ate = hoje().slice(0, 7)
  const feitos = new Set(model.receber.filter((r) => r.origem.startsWith('rodizio:')).map((r) => `${r.origem}|${r.mes_ref}`))
  const projetados: Receber[] = []
  for (const rod of model.rodizios) {
    if (!rod.mes_inicio) continue
    for (let m = rod.mes_inicio; m <= ate; m = addMeses(m, 1)) {
      const pessoa = vezDoRodizio(rod, m)
      const origem = `rodizio:${rod.id}`
      if (!pessoa || pessoa.toLowerCase() === rod.eu.toLowerCase() || feitos.has(`${origem}|${m}`)) continue
      projetados.push({
        id: `${origem}:${m}`,
        pessoa,
        descricao: rod.nome,
        mes_ref: m,
        valor: valorDoRodizio(model, rod, m),
        recebido: false,
        origem,
        tipo: 'fixo',
        recebido_em: '',
        data: '',
        projetado: true,
      })
    }
  }
  return [...model.receber, ...projetados]
}

/** Quanto dos seus gastos do mês outras pessoas vão te devolver, por tipo (para os limites contarem só a sua parte). */
export function reembolsoDoMes(model: Model, mes: string): { fixo: number; gasto: number; parcela: number; total: number } {
  const out = { fixo: 0, gasto: 0, parcela: 0, total: 0 }
  for (const r of receberItens(model)) {
    if (r.mes_ref !== mes || !r.tipo || r.valor <= 0) continue
    out[r.tipo] += r.valor
    out.total += r.valor
  }
  return out
}

/** Cobranças ligadas a cada lançamento (id do lançamento → itens). */
export function cobrancasPorLancamento(model: Model) {
  const m = new Map<string, Receber[]>()
  for (const r of model.receber) if (r.origem && !r.origem.startsWith('rodizio:')) m.set(r.origem, [...(m.get(r.origem) ?? []), r])
  return m
}

export function receberPendente(model: Model) {
  const pend = receberItens(model).filter((r) => !r.recebido)
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
  const centavos = (v: number) => Math.round(v * 100) / 100
  // só onde ainda tem dinheiro: o que foi resgatado já foi usado e sai da conta
  const lista = [...destinos.entries()].map(([nome, valor]) => ({ nome, valor: centavos(valor) })).filter((d) => d.valor > 0)
  return {
    total: centavos(lista.reduce((a, d) => a + d.valor, 0)),
    destinos: lista.sort((a, b) => b.valor - a.valor),
  }
}

// ---------- carro ----------

/** Tipos de custo do carro (as linhas da planilha antiga "Carro"). */
export const CUSTOS_CARRO = ['Combustível', 'Mecânico', 'Documento', 'Multa', 'Estética', 'Outros'] as const
export type CustoCarro = (typeof CUSTOS_CARRO)[number]

const semAcento = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

/** Categorias que são do carro: "Carro", "Combustível" (e variações como "Veículo", "Automóvel"). */
export function ehCategoriaCarro(categoria: string) {
  const c = semAcento(categoria)
  return c === 'carro' || c.startsWith('combust') || c.startsWith('veicul') || c.startsWith('automov')
}

/**
 * Tipo de custo do carro de um lançamento, ou null se não for do carro.
 * Vale o que foi escolhido à mão (coluna "carro"); senão, deduz pela categoria e pela descrição.
 */
export function custoCarro(l: Pick<Lancamento, 'categoria' | 'descricao' | 'carro'>): CustoCarro | null {
  if (l.carro === NAO_E_CARRO) return null
  if (l.carro) return CUSTOS_CARRO.find((c) => semAcento(c) === semAcento(l.carro)) ?? 'Outros'
  // categoria do carro, ou a descrição fala do carro (ex.: "Sensor do carro" na categoria Outros)
  if (!ehCategoriaCarro(l.categoria) && !/carro/.test(semAcento(l.descricao))) return null
  return custoDeduzido(l)
}

/** Valor da coluna "carro" que tira um lançamento do carro (quando a dedução acerta errado). */
export const NAO_E_CARRO = 'não'

/** O tipo que o app deduz quando ninguém escolheu (mostrado como "automático"). */
export function custoDeduzido(l: Pick<Lancamento, 'categoria' | 'descricao'>): CustoCarro {
  const c = semAcento(l.categoria)
  const d = semAcento(l.descricao)
  if (c.startsWith('combust') || /gasolina|etanol|alcool|combust|posto|abastec|diesel|gnv/.test(d)) return 'Combustível'
  if (/multa|infracao/.test(d)) return 'Multa'
  if (/ipva|licenciamento|detran|documento|crlv|dpvat|transferencia|vistoria|emplacamento/.test(d)) return 'Documento'
  if (/lava|lavagem|polimento|estetica|higieniza|enceramento|cera\b/.test(d)) return 'Estética'
  if (/estacionamento|pedagio|zona azul|seguro/.test(d)) return 'Outros'
  return 'Mecânico'
}

export interface CustosCarroAno {
  /** valor por tipo, um número por mês (jan..dez) */
  porTipo: Record<CustoCarro, number[]>
  porMes: number[]
  total: number
}

/** Custos do carro no ano, por tipo e mês (inclui fixos projetados e parcelas). */
export function custosCarroAno(model: Model, ano: number): CustosCarroAno {
  const porTipo = Object.fromEntries(CUSTOS_CARRO.map((c) => [c, Array(12).fill(0)])) as Record<CustoCarro, number[]>
  const porMes = Array(12).fill(0) as number[]
  for (let m = 0; m < 12; m++) {
    for (const l of itensDoMes(model, `${ano}-${String(m + 1).padStart(2, '0')}`).itens) {
      const c = custoCarro(l)
      if (!c) continue
      porTipo[c][m] += l.valor
      porMes[m] += l.valor
    }
  }
  return { porTipo, porMes, total: porMes.reduce((a, b) => a + b, 0) }
}

/** Lançamentos do carro no mês, com o tipo de custo. */
export function lancamentosCarro(model: Model, mes: string): { l: Lancamento; custo: CustoCarro }[] {
  return itensDoMes(model, mes)
    .itens.map((l) => ({ l, custo: custoCarro(l) }))
    .filter((x): x is { l: Lancamento; custo: CustoCarro } => x.custo !== null)
    .sort((a, b) => (b.l.data || '').localeCompare(a.l.data || ''))
}

/** Soma das entradas fixas (salário) vigentes no mês. */
export function salarioFixo(model: Model, mes: string) {
  return model.entradasFixas.filter((f) => vigente(f, mes)).reduce((a, f) => a + f.valor, 0)
}

/** Meta do destino em reais no mês (meses de salário viram valor); null = sem meta. */
export function metaDoDestino(model: Model, destino: string, mes: string): number | null {
  const m = model.metas[destino]
  if (!m) return null
  return m.meses !== undefined ? m.meses * salarioFixo(model, mes) : m.valor
}

/** Cores fixas por posição do destino na lista de Configurações (validadas para daltonismo, claro e escuro); "Outros" e excedentes ficam cinza. */
const PALETA_DESTINOS = ['#0d9488', '#6366f1', '#d97706', '#0284c7', '#e11d48']
export function corDoDestino(model: Model, destino: string) {
  const k = model.destinos.filter((d) => d.toLowerCase() !== 'outros').indexOf(destino)
  return k >= 0 && k < PALETA_DESTINOS.length ? PALETA_DESTINOS[k] : '#94a3b8'
}
