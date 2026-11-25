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
  renomearReferencias,
  updateRow,
} from './google'
import type { Cell, DB, Row, Tab } from './google'
import { buildModel } from './model'
import type { Fixo, Lancamento, Model, Receber, VersaoFixa } from './model'

export type TabFixa = 'fixos' | 'entradas_fixas'
export type TabConfig = 'formas_pagamento' | 'categorias' | 'destinos_investimento'

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

  const inflight = useRef<Promise<void> | null>(null)
  const reload = useCallback(() => {
    const t = tokenRef.current
    if (!t) return Promise.resolve()
    // Evita duas cargas simultâneas (o React em modo dev roda efeitos duas vezes).
    if (inflight.current) return inflight.current
    setLoading(true)
    inflight.current = (async () => {
      try {
        setDb(await loadDB(t))
        setError(null)
      } catch (e) {
        handle(e)
      } finally {
        setLoading(false)
        inflight.current = null
      }
    })()
    return inflight.current
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

      // ----- configurações (formas de pagamento, categorias, destinos) -----

      /** Cria (row ausente) ou edita um item. Renomear também atualiza os lançamentos que usam o nome. */
      salvarConfig: (tab: TabConfig, row: Row | undefined, valores: Record<string, Cell>) =>
        run(async (t, d) => {
          if (!row) return appendRows(t, d, tab, [valores])
          const antigo = String(row.nome).trim()
          const novo = String(valores.nome).trim()
          await updateRow(t, d, tab, row, valores)
          if (antigo && novo && antigo !== novo) await renomearReferencias(t, d, tab, antigo, novo)
        }),

      excluirConfig: (tab: TabConfig, row: Row) => run((t, d) => deleteRows(t, d, tab, [row])),

      // ----- contas fixas / entradas fixas (versões com período de validade) -----

      novoFixo: (tab: TabFixa, campos: Record<string, Cell>, mesInicio: string) =>
        run((t, d) => {
          const id = newId(tab === 'fixos' ? 'F' : 'EF')
          return appendRows(t, d, tab, [{ id, serie: id, ...campos, ativo: 'sim', mes_inicio: mesInicio, mes_fim: '' }])
        }),

      /** Altera a conta a partir de um mês: os meses anteriores mantêm o valor antigo. */
      alterarFixo: (tab: TabFixa, v: VersaoFixa, campos: Record<string, Cell>, aPartirDe: string) =>
        run(async (t, d) => {
          if (v.mes_inicio && aPartirDe <= v.mes_inicio) {
            await updateRow(t, d, tab, v.row, campos)
            return
          }
          await updateRow(t, d, tab, v.row, { mes_fim: addMeses(aPartirDe, -1) })
          await appendRows(t, d, tab, [
            { id: newId(tab === 'fixos' ? 'F' : 'EF'), serie: v.serie, ...campos, ativo: 'sim', mes_inicio: aPartirDe, mes_fim: v.mes_fim },
          ])
        }),

      /** Encerra a conta a partir de um mês (inclusive). */
      encerrarFixo: (tab: TabFixa, versoes: VersaoFixa[], aPartirDe: string) =>
        run(async (t, d) => {
          for (const v of versoes) {
            if (!v.ativo || (v.mes_fim && v.mes_fim < aPartirDe)) continue
            if (v.mes_inicio && v.mes_inicio >= aPartirDe) await updateRow(t, d, tab, v.row, { ativo: 'não' })
            else await updateRow(t, d, tab, v.row, { mes_fim: addMeses(aPartirDe, -1) })
          }
        }),

      /** Valor diferente só em um mês (não mexe no modelo). */
      ajustarFixoNoMes: (f: Fixo, campos: Record<string, Cell>, mes: string, existente?: Lancamento) =>
        run((t, d) =>
          existente?.row
            ? updateRow(t, d, 'lancamentos', existente.row, campos)
            : appendRows(t, d, 'lancamentos', [
                {
                  id: newId('L'),
                  mes_ref: mes,
                  data: '',
                  categoria: f.categoria,
                  forma_pagamento: f.forma_pagamento,
                  descricao: f.descricao,
                  ...campos,
                  tipo: 'fixo',
                  fixo_id: f.serie,
                },
              ]),
        ),

      /** Confirma no mês as entradas fixas estimadas (com os valores informados). */
      lancarEntradas: (mes: string, itens: { descricao: string; valor: number }[]) =>
        run((t, d) =>
          appendRows(
            t,
            d,
            'entradas',
            itens.map((e, k) => ({ id: newId('E') + k, mes_ref: mes, descricao: e.descricao, valor: e.valor })),
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
