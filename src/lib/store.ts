import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addMeses, hoje } from './finance'
import type { Conta } from './finance'
import {
  AuthError,
  appendRows,
  deleteRows,
  getStoredToken,
  loadDB,
  loadGoogleScript,
  newId,
  signIn,
  signOut,
  updateRow,
} from './google'
import type { Cell, DB, Tab } from './google'
import { buildModel } from './model'
import type { Lancamento, Model, Receber } from './model'

export interface NovoParcelado {
  descricao: string
  valor_parcela: number
  total_parcelas: number
  mes_primeira_parcela: string
  categoria: string
  forma_pagamento: string
}

export function useFinance() {
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const [db, setDb] = useState<DB | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tokenRef = useRef(token)

  useEffect(() => {
    tokenRef.current = token
  }, [token])

  useEffect(() => {
    loadGoogleScript().catch(() => {})
  }, [])

  const handle = useCallback((e: unknown) => {
    if (e instanceof AuthError) {
      setToken(null)
      setDb(null)
    }
    setError(e instanceof Error ? e.message : String(e))
  }, [])

  const reload = useCallback(async () => {
    const t = tokenRef.current
    if (!t) return
    setLoading(true)
    try {
      setDb(await loadDB(t))
      setError(null)
    } catch (e) {
      handle(e)
    } finally {
      setLoading(false)
    }
  }, [handle])

  useEffect(() => {
    if (token) void reload()
  }, [token, reload])

  const login = useCallback(async () => {
    setError(null)
    try {
      const t = await signIn()
      tokenRef.current = t
      setToken(t)
    } catch (e) {
      handle(e)
    }
  }, [handle])

  const logout = useCallback(() => {
    signOut(tokenRef.current)
    setToken(null)
    setDb(null)
  }, [])

  /** Executa uma escrita na planilha e recarrega tudo. */
  const run = useCallback(
    async (fn: (token: string, db: DB) => Promise<void>) => {
      const t = tokenRef.current
      if (!t || !db) return false
      setBusy(true)
      try {
        await fn(t, db)
        setDb(await loadDB(t))
        setError(null)
        return true
      } catch (e) {
        handle(e)
        return false
      } finally {
        setBusy(false)
      }
    },
    [db, handle],
  )

  const model: Model | null = useMemo(() => (db ? buildModel(db) : null), [db])

  const actions = useMemo(
    () => ({
      append: (tab: Tab, prefix: string, rows: Record<string, Cell>[]) =>
        run((t, d) => appendRows(t, d, tab, rows.map((r) => ({ id: newId(prefix), ...r })))),

      addParcelado: (p: NovoParcelado) =>
        run(async (t, d) => {
          const pid = newId('P')
          await appendRows(t, d, 'parcelamentos', [{ id: pid, ...p, observacao: '' }])
          const linhas = Array.from({ length: p.total_parcelas }, (_, k) => ({
            id: newId('L') + k,
            mes_ref: addMeses(p.mes_primeira_parcela, k),
            data: k === 0 ? hoje() : '',
            descricao: p.descricao,
            valor: p.valor_parcela,
            categoria: p.categoria,
            forma_pagamento: p.forma_pagamento,
            tipo: 'parcela',
            parcelas_restantes: p.total_parcelas - k,
            parcelamento_id: pid,
          }))
          await appendRows(t, d, 'lancamentos', linhas)
        }),

      /** Copia o modelo de fixos para o mês (passa a ser editável mês a mês). */
      lancarFixos: (mes: string, itens: Lancamento[]) =>
        run((t, d) =>
          appendRows(
            t,
            d,
            'lancamentos',
            itens
              .filter((l) => l.projetado)
              .map((l, k) => ({
                id: newId('L') + k,
                mes_ref: mes,
                data: '',
                descricao: l.descricao,
                valor: l.valor,
                categoria: l.categoria,
                forma_pagamento: l.forma_pagamento,
                tipo: 'fixo',
              })),
          ),
        ),

      excluirLancamentos: (ls: Lancamento[]) =>
        run((t, d) =>
          deleteRows(
            t,
            d,
            'lancamentos',
            ls.filter((l) => l.row).map((l) => l.row!),
          ),
        ),

      togglePago: (mes: string, c: Conta) =>
        run((t, d) =>
          c.pagamento
            ? deleteRows(t, d, 'pagamentos', [c.pagamento.row])
            : appendRows(t, d, 'pagamentos', [{ id: newId('G'), mes_ref: mes, referencia: c.ref, valor: c.valor, pago_em: hoje() }]),
        ),

      toggleRecebido: (r: Receber) => run((t, d) => updateRow(t, d, 'a_receber', r.row, { recebido: r.recebido ? 'não' : 'sim' })),
    }),
    [run],
  )

  return { token, model, loading, busy, error, setError, login, logout, reload, actions }
}

export type Finance = ReturnType<typeof useFinance>
