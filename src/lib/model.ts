import { corDaPosicao, ordemAlfabetica } from './cores'
import type { Cell, DB, Row } from './google'

// ---------- conversões tolerantes (a planilha também é editada à mão) ----------

export const str = (v: Cell | undefined) => (v === undefined || v === null ? '' : String(v).trim())

export function num(v: Cell | undefined): number {
  if (typeof v === 'number') return v
  const s = str(v).replace(/[R$\s]/g, '')
  if (!s) return 0
  const n = s.includes(',') ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s)
  return Number.isFinite(n) ? n : 0
}

export const isYes = (v: Cell | undefined) => ['sim', 's', 'yes', 'true', 'x', '1'].includes(str(v).toLowerCase())

/** Aceita 2026-11, 2026-11-01, 11/2026, 01/11/2026 → "2026-11" */
export function normMes(v: Cell | undefined): string {
  const s = str(v)
  let m = s.match(/^(\d{4})-(\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}`
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}`
  m = s.match(/^(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[2]}-${m[1].padStart(2, '0')}`
  return s
}

/** Aceita 2026-11-03 ou 03/11/2026 → "2026-11-03" */
export function normData(v: Cell | undefined): string {
  const s = str(v)
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return s
}

// ---------- tipos ----------

export type Tipo = 'gasto' | 'fixo' | 'parcela'

export interface Lancamento {
  id: string
  mes_ref: string
  data: string
  descricao: string
  valor: number
  categoria: string
  forma_pagamento: string
  tipo: Tipo
  parcelas_restantes: number | null
  parcelamento_id: string
  /** série do fixo quando este lançamento é um ajuste "só neste mês" */
  fixo_id: string
  /** tipo de custo do carro escolhido à mão (Combustível, Mecânico…); vazio = deduzido pela categoria e descrição */
  carro: string
  /** AAAA-MM-DD: quando pagar (contas fora do cartão, ex.: pagar a uma pessoa); nas parcelas vale o mesmo dia em cada mês */
  vencimento?: string
  row?: Row
  /** fixo calculado a partir do modelo (ainda não lançado na planilha) */
  projetado?: boolean
  fixo?: Fixo
  /** parcela futura deduzida de parcelas_restantes (a linha ainda não existe na planilha) */
  estimada?: boolean
}

/** Identifica a compra parcelada (o id do parcelamento ou, sem ele, descrição + forma). */
export function chaveParcela(l: Lancamento) {
  return l.parcelamento_id || `${l.descricao.trim().toLowerCase()}|${l.forma_pagamento}`
}

const mesSeguinte = (mes: string, n = 1) => {
  const [y, m] = mes.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Soma meses a uma data AAAA-MM-DD mantendo o dia (limitado ao fim do mês: 31/01 + 1 → 28/02). */
export function somarMesesData(data: string, n: number) {
  const [y, m, d] = data.split('-').map(Number)
  const alvo = new Date(y, m - 1 + n, 1)
  const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate()
  return `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`
}

/**
 * Datas das parcelas: a 1ª fica no dia da compra; da 2ª em diante aparecem no dia 1 do mês da fatura.
 * Só para exibição; a planilha não muda.
 */
function datarParcelas(lancamentos: Lancamento[]) {
  const base = new Map<string, Lancamento>()
  for (const l of lancamentos) {
    if (l.tipo !== 'parcela' || !/^\d{4}-\d{2}-\d{2}$/.test(l.data)) continue
    const k = chaveParcela(l)
    const b = base.get(k)
    if (!b || l.mes_ref < b.mes_ref) base.set(k, l)
  }
  return lancamentos.map((l) => {
    if (l.tipo !== 'parcela' || !/^\d{4}-\d{2}$/.test(l.mes_ref)) return l
    const b = base.get(chaveParcela(l))
    if (!b || l.mes_ref <= b.mes_ref) return l // a 1ª parcela fica no dia da compra
    // da 2ª em diante: dia 1 do mês da fatura. Datas próprias (ex.: adiantamento) são mantidas;
    // só troca a data vazia ou a que era só a da compra repetida mês a mês.
    const [y1, m1] = b.mes_ref.split('-').map(Number)
    const [y2, m2] = l.mes_ref.split('-').map(Number)
    if (l.data && l.data !== somarMesesData(b.data, (y2 - y1) * 12 + (m2 - m1))) return l
    return { ...l, data: `${l.mes_ref}-01` }
  })
}

/**
 * Parcelas que faltam na planilha: se a última parcela registrada diz "faltam N",
 * os meses seguintes aparecem como estimados (só do mês atual em diante, o histórico não muda).
 */
function parcelasEstimadas(lancamentos: Lancamento[]): Lancamento[] {
  const ultima = new Map<string, Lancamento>()
  for (const l of lancamentos) {
    if (l.tipo !== 'parcela' || !/^\d{4}-\d{2}$/.test(l.mes_ref)) continue
    const k = chaveParcela(l)
    const u = ultima.get(k)
    if (!u || l.mes_ref > u.mes_ref) ultima.set(k, l)
  }
  const hojeD = new Date()
  const atual = `${hojeD.getFullYear()}-${String(hojeD.getMonth() + 1).padStart(2, '0')}`
  const extras: Lancamento[] = []
  for (const [k, u] of ultima) {
    const rest = u.parcelas_restantes ?? 0
    for (let n = 1; n < rest; n++) {
      const mes = mesSeguinte(u.mes_ref, n)
      if (mes < atual) continue
      extras.push({ ...u, id: `est:${k}:${mes}`, mes_ref: mes, data: '', parcelas_restantes: rest - n, row: undefined, estimada: true })
    }
  }
  return extras
}

/** Campos comuns às versões de contas fixas e entradas fixas. */
export interface VersaoFixa {
  id: string
  /** identifica a conta ao longo das versões (alterações "a partir de") */
  serie: string
  descricao: string
  valor: number
  ativo: boolean
  mes_inicio: string // '' = desde sempre
  mes_fim: string // '' = sem fim
  row: Row
}

export interface Fixo extends VersaoFixa {
  categoria: string
  forma_pagamento: string
  dia_vencimento: number | null
  /** acontece a cada N meses (1 = todo mês) */
  frequencia: number
  /** em quantas parcelas cada ocorrência é paga */
  parcelas: number
}

/** A versão vale no mês? */
export function vigente(v: VersaoFixa, mes: string) {
  return v.ativo && (!v.mes_inicio || v.mes_inicio <= mes) && (!v.mes_fim || mes <= v.mes_fim)
}

function versao(r: Row): VersaoFixa {
  const id = str(r.id)
  return {
    id,
    serie: str(r.serie) || id,
    descricao: str(r.descricao),
    valor: num(r.valor),
    ativo: str(r.ativo) === '' || isYes(r.ativo),
    mes_inicio: str(r.mes_inicio) ? normMes(r.mes_inicio) : '',
    mes_fim: str(r.mes_fim) ? normMes(r.mes_fim) : '',
    row: r,
  }
}

export interface Forma {
  nome: string
  cartao: boolean
  dia_vencimento: number | null
  /** quantos dias antes do vencimento a fatura fecha */
  dias_fechamento: number | null
  limite: number | null
  mes_seguinte: boolean
  cor: string
}

export interface Entrada {
  id: string
  mes_ref: string
  descricao: string
  valor: number
  /** entrada fixa estimada (ainda não lançada no mês) */
  projetado?: boolean
}

export type EntradaFixa = VersaoFixa

export type MetaDestino = { valor: number; meses?: undefined } | { meses: number; valor?: undefined }

export interface Investimento {
  id: string
  mes_ref: string
  destino: string
  valor: number
  descricao: string
  row: Row
}

export interface Receber {
  id: string
  pessoa: string
  descricao: string
  mes_ref: string
  valor: number
  recebido: boolean
  /** de onde veio: id do lançamento que você pagou por alguém, ou `rodizio:<id>` */
  origem: string
  /** parte dos seus gastos que esse reembolso abate: fixo, gasto ou parcela ('' = avulso) */
  tipo: '' | 'fixo' | 'gasto' | 'parcela'
  recebido_em: string
  /** AAAA-MM-DD (ex.: dia em que a pessoa pagou algo para você, no abatimento) */
  data: string
  /** sem linha na planilha (ex.: vez de alguém no rodízio ainda não confirmada) */
  projetado?: boolean
  row?: Row
}

/** Assinatura dividida em rodízio: cai no seu cartão e cada mês uma pessoa te reembolsa. */
export interface Rodizio {
  id: string
  nome: string
  /** na ordem do rodízio */
  membros: string[]
  /** qual dos membros é você (no seu mês não há reembolso) */
  eu: string
  /** mês da vez do 1º membro */
  mes_inicio: string
  valor: number
  /** conta fixa ligada: o valor acompanha a conta */
  fixo_id: string
  row: Row
}

/** Troca ou manutenção feita no carro (aba carro_trocas). */
export interface Troca {
  id: string
  data: string
  item: string
  categoria: string
  observacao: string
  km: number | null
  proxima_data: string
  proxima_km: number | null
  custo: number
  lancamento_id: string
  row: Row
}

export interface Pagamento {
  id: string
  mes_ref: string
  referencia: string
  valor: number
  pago_em: string
  row: Row
}

export interface Categoria {
  nome: string
  orcamento: number
  cor: string
}

/** Cor da categoria pelo nome (cinza se não existir mais). */
export function corCategoria(model: Model, nome: string) {
  return model.categorias.find((c) => c.nome.toLowerCase() === nome.toLowerCase())?.cor ?? '#94a3b8'
}

export interface Model {
  db: DB
  lancamentos: Lancamento[]
  fixos: Fixo[]
  entradas: Entrada[]
  entradasFixas: EntradaFixa[]
  investimentos: Investimento[]
  receber: Receber[]
  rodizios: Rodizio[]
  trocas: Troca[]
  formas: Forma[]
  /** sempre em ordem alfabética */
  categorias: Categoria[]
  destinos: string[]
  /** como dividir cada aporte: destino → % (0–100); só os destinos com % preenchido */
  divisao: Record<string, number>
  /** meta de cada destino: valor fixo ou N meses de salário */
  metas: Record<string, MetaDestino>
  pagamentos: Pagamento[]
  primeiroMes: string | null
  /** limites do mês por tipo, como fração do salário fixo (0.3 = 30%) */
  limites: Record<TipoLimite, number>
}

/** fixo/gasto/parcela são tetos; investimento é meta (quanto guardar). */
export type TipoLimite = 'fixo' | 'gasto' | 'parcela' | 'investimento'

/** Limites por tipo em % do salário fixo (aba "ajustes": chave → valor). Base: regra 50/30/20. */
export const LIMITES: Record<TipoLimite, { chave: string; padrao: number; label: string }> = {
  fixo: { chave: 'limite_fixos_pct', padrao: 50, label: 'Fixos' },
  gasto: { chave: 'limite_gastos_pct', padrao: 20, label: 'Gastos' },
  parcela: { chave: 'limite_parcelas_pct', padrao: 30, label: 'Parcelas' },
  investimento: { chave: 'meta_investimento_pct', padrao: 10, label: 'Investimento (meta)' },
}

function ajuste(db: DB, chave: string): string {
  return str(db.tables.ajustes?.find((r) => str(r.chave) === chave)?.valor)
}

export function buildModel(db: DB): Model {
  const t = db.tables
  const lancamentos: Lancamento[] = t.lancamentos.map((r) => {
    const tipo = str(r.tipo).toLowerCase()
    const rest = str(r.parcelas_restantes)
    return {
      id: str(r.id),
      mes_ref: normMes(r.mes_ref),
      data: normData(r.data),
      descricao: str(r.descricao),
      valor: num(r.valor),
      categoria: str(r.categoria) || 'Outros',
      forma_pagamento: str(r.forma_pagamento),
      tipo: tipo === 'fixo' || tipo === 'parcela' ? tipo : 'gasto',
      parcelas_restantes: rest ? num(rest) : null,
      parcelamento_id: str(r.parcelamento_id),
      fixo_id: str(r.fixo_id),
      carro: str(r.carro),
      vencimento: normData(r.vencimento),
      row: r,
    }
  })
  const meses = lancamentos.map((l) => l.mes_ref).filter((m) => /^\d{4}-\d{2}$/.test(m))
  return {
    db,
    lancamentos: datarParcelas([...lancamentos, ...parcelasEstimadas(lancamentos)]),
    fixos: t.fixos
      .filter((r) => str(r.descricao))
      .map((r) => ({
        ...versao(r),
        categoria: str(r.categoria) || 'Outros',
        forma_pagamento: str(r.forma_pagamento),
        dia_vencimento: str(r.dia_vencimento) ? num(r.dia_vencimento) : null,
        frequencia: Math.max(1, Math.round(num(r.frequencia_meses)) || 1),
        parcelas: Math.max(1, Math.round(num(r.parcelas)) || 1),
      })),
    entradas: t.entradas.map((r) => ({
      id: str(r.id),
      mes_ref: normMes(r.mes_ref),
      descricao: str(r.descricao),
      valor: num(r.valor),
    })),
    entradasFixas: t.entradas_fixas.filter((r) => str(r.descricao)).map(versao),
    investimentos: t.investimentos.map((r) => ({
      id: str(r.id),
      mes_ref: normMes(r.mes_ref),
      destino: str(r.destino) || 'Outros',
      valor: num(r.valor),
      descricao: str(r.descricao),
      row: r,
    })),
    receber: t.a_receber.map((r) => ({
      id: str(r.id),
      pessoa: str(r.pessoa),
      descricao: str(r.descricao),
      mes_ref: normMes(r.mes_ref),
      valor: num(r.valor),
      recebido: isYes(r.recebido),
      origem: str(r.origem),
      tipo: (['fixo', 'gasto', 'parcela'].includes(str(r.tipo)) ? str(r.tipo) : '') as Receber['tipo'],
      recebido_em: normData(r.recebido_em),
      data: normData(r.data),
      row: r,
    })),
    rodizios: (t.rodizios ?? [])
      .filter((r) => str(r.nome))
      .map((r) => ({
        id: str(r.id),
        nome: str(r.nome),
        membros: str(r.membros)
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
        eu: str(r.eu),
        mes_inicio: normMes(r.mes_inicio),
        valor: num(r.valor),
        fixo_id: str(r.fixo_id),
        row: r,
      })),
    trocas: (t.carro_trocas ?? [])
      .filter((r) => str(r.item))
      .map((r) => ({
        id: str(r.id),
        data: normData(r.data),
        item: str(r.item),
        categoria: str(r.categoria) || 'Outros',
        observacao: str(r.observacao),
        km: str(r.km) ? num(r.km) : null,
        proxima_data: normData(r.proxima_data),
        proxima_km: str(r.proxima_km) ? num(r.proxima_km) : null,
        custo: num(r.custo),
        lancamento_id: str(r.lancamento_id),
        row: r,
      }))
      .sort((a, b) => b.data.localeCompare(a.data)),
    formas: t.formas_pagamento
      .filter((r) => str(r.nome))
      .map((r) => ({
        nome: str(r.nome),
        cartao: str(r.tipo).toLowerCase().startsWith('cart'),
        dia_vencimento: str(r.dia_vencimento) ? num(r.dia_vencimento) : null,
        dias_fechamento: str(r.dias_fechamento) ? num(r.dias_fechamento) : null,
        limite: num(r.limite) || null,
        mes_seguinte: isYes(r.fatura_vence_mes_seguinte),
        cor: str(r.cor),
      }))
      .sort((a, b) => ordemAlfabetica(a.nome, b.nome)),
    categorias: t.categorias
      .filter((r) => str(r.nome))
      .map((r) => ({ nome: str(r.nome), orcamento: num(r.orcamento_mensal), cor: str(r.cor) }))
      .sort((a, b) => ordemAlfabetica(a.nome, b.nome))
      .map((c, i) => ({ ...c, cor: c.cor || corDaPosicao(i) })),
    destinos: t.destinos_investimento.map((r) => str(r.nome)).filter(Boolean),
    metas: Object.fromEntries(
      t.destinos_investimento.flatMap((r): [string, MetaDestino][] => {
        const nome = str(r.nome)
        if (!nome) return []
        if (num(r.meta_meses) > 0) return [[nome, { meses: num(r.meta_meses) }]]
        if (num(r.meta) > 0) return [[nome, { valor: num(r.meta) }]]
        return []
      }),
    ),
    divisao: Object.fromEntries(
      t.destinos_investimento.filter((r) => str(r.nome) && str(r.percentual)).map((r) => [str(r.nome), num(str(r.percentual).replace('%', ''))]),
    ),
    pagamentos: t.pagamentos.map((r) => ({
      id: str(r.id),
      mes_ref: normMes(r.mes_ref),
      referencia: str(r.referencia),
      valor: num(r.valor),
      pago_em: normData(r.pago_em),
      row: r,
    })),
    primeiroMes: meses.length ? meses.reduce((a, b) => (a < b ? a : b)) : null,
    limites: Object.fromEntries(
      Object.entries(LIMITES).map(([k, l]) => {
        const v = num(ajuste(db, l.chave))
        return [k, (v > 0 && v <= 100 ? v : l.padrao) / 100]
      }),
    ) as Record<TipoLimite, number>,
  }
}
