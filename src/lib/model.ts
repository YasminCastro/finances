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
  row?: Row
  /** fixo calculado a partir do modelo (ainda não lançado na planilha) */
  projetado?: boolean
  fixo?: Fixo
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

export interface Investimento {
  id: string
  mes_ref: string
  destino: string
  valor: number
  descricao: string
}

export interface Receber {
  id: string
  pessoa: string
  descricao: string
  mes_ref: string
  valor: number
  recebido: boolean
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
  formas: Forma[]
  /** sempre em ordem alfabética */
  categorias: Categoria[]
  destinos: string[]
  pagamentos: Pagamento[]
  primeiroMes: string | null
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
      row: r,
    }
  })
  const meses = lancamentos.map((l) => l.mes_ref).filter((m) => /^\d{4}-\d{2}$/.test(m))
  return {
    db,
    lancamentos,
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
    })),
    receber: t.a_receber.map((r) => ({
      id: str(r.id),
      pessoa: str(r.pessoa),
      descricao: str(r.descricao),
      mes_ref: normMes(r.mes_ref),
      valor: num(r.valor),
      recebido: isYes(r.recebido),
      row: r,
    })),
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
    pagamentos: t.pagamentos.map((r) => ({
      id: str(r.id),
      mes_ref: normMes(r.mes_ref),
      referencia: str(r.referencia),
      valor: num(r.valor),
      pago_em: normData(r.pago_em),
      row: r,
    })),
    primeiroMes: meses.length ? meses.reduce((a, b) => (a < b ? a : b)) : null,
  }
}
