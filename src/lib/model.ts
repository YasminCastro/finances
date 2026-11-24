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
  row?: Row
  /** fixo calculado a partir do modelo (ainda não lançado na planilha) */
  projetado?: boolean
  fixo?: Fixo
}

export interface Fixo {
  id: string
  descricao: string
  valor: number
  categoria: string
  forma_pagamento: string
  dia_vencimento: number | null
  ativo: boolean
}

export interface Forma {
  nome: string
  cartao: boolean
  dia_vencimento: number | null
  mes_seguinte: boolean
  cor: string
}

export interface Entrada {
  id: string
  mes_ref: string
  descricao: string
  valor: number
}

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

export interface Model {
  db: DB
  lancamentos: Lancamento[]
  fixos: Fixo[]
  entradas: Entrada[]
  investimentos: Investimento[]
  receber: Receber[]
  formas: Forma[]
  categorias: { nome: string; orcamento: number }[]
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
      row: r,
    }
  })
  const meses = lancamentos.map((l) => l.mes_ref).filter((m) => /^\d{4}-\d{2}$/.test(m))
  return {
    db,
    lancamentos,
    fixos: t.fixos.map((r) => ({
      id: str(r.id),
      descricao: str(r.descricao),
      valor: num(r.valor),
      categoria: str(r.categoria) || 'Outros',
      forma_pagamento: str(r.forma_pagamento),
      dia_vencimento: str(r.dia_vencimento) ? num(r.dia_vencimento) : null,
      ativo: str(r.ativo) === '' || isYes(r.ativo),
    })),
    entradas: t.entradas.map((r) => ({
      id: str(r.id),
      mes_ref: normMes(r.mes_ref),
      descricao: str(r.descricao),
      valor: num(r.valor),
    })),
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
        mes_seguinte: isYes(r.fatura_vence_mes_seguinte),
        cor: str(r.cor),
      })),
    categorias: t.categorias.filter((r) => str(r.nome)).map((r) => ({ nome: str(r.nome), orcamento: num(r.orcamento_mensal) })),
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
