import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addMeses, dividirParcelas, hoje } from './finance'
import type { Conta } from './finance'
import {
  AuthError,
  SemAcessoError,
  liberarPlanilha,
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
  updateRows,
} from './google'
import type { Cell, DB, Row, Tab } from './google'
import { buildModel, normMes, num, str, vigente } from './model'
import type { Entrada, Fixo, Lancamento, Model, Receber, VersaoFixa } from './model'

export type TabFixa = 'fixos' | 'entradas_fixas'
export type TabConfig = 'formas_pagamento' | 'categorias' | 'destinos_investimento'

export interface NovoParcelado {
  descricao: string
  /** valor total da compra; é dividido entre as parcelas */
  valor_total: number
  total_parcelas: number
  mes_primeira_parcela: string
  categoria: string
  forma_pagamento: string
  /** AAAA-MM-DD; fica na 1ª parcela */
  data_compra?: string
  /** parte da compra que é de outra pessoa (vira cobrança em cada parcela) */
  cobranca?: Cobranca
  /** dia do mês para pagar cada parcela (fora do cartão) */
  dia_pagamento?: number
}

/** Compra que você pagou (toda ou em parte) por outra pessoa. */
export interface Cobranca {
  pessoa: string
  /** quanto a pessoa te deve no total */
  valor: number
}

/** Linhas de a_receber para uma cobrança ligada a lançamentos (dividida como as parcelas). */
function linhasCobranca(c: Cobranca | undefined, lancs: { id: string; mes_ref: string; descricao: Cell; tipo: string }[]) {
  if (!c || !c.pessoa.trim() || !(c.valor > 0) || !lancs.length) return []
  const partes = dividirParcelas(c.valor, lancs.length)
  return lancs.map((l, k) => ({
    id: newId('R') + k,
    pessoa: c.pessoa.trim(),
    descricao: str(l.descricao) + (lancs.length > 1 ? ` (${k + 1}/${lancs.length})` : ''),
    mes_ref: l.mes_ref,
    valor: partes[k],
    recebido: 'não',
    origem: l.id,
    tipo: l.tipo,
  }))
}

export function useFinance() {
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const [db, setDb] = useState<DB | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Logada, mas a planilha ainda não foi liberada para o app (escopo drive.file). */
  const [semAcesso, setSemAcesso] = useState(false)
  const tokenRef = useRef(token)

  useEffect(() => {
    tokenRef.current = token
  }, [token])

  useEffect(() => {
    loadGoogleScript().catch(() => {})
  }, [])

  const handle = useCallback((e: unknown) => {
    if (e instanceof SemAcessoError) {
      setSemAcesso(true)
      setError(null)
      return
    }
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
    setSemAcesso(false)
  }, [])

  const liberar = useCallback(async () => {
    const t = tokenRef.current
    if (!t) return
    setError(null)
    try {
      await liberarPlanilha(t)
      setSemAcesso(false)
      await reload()
    } catch (e) {
      handle(e)
    }
  }, [handle, reload])

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
          const valores = dividirParcelas(p.valor_total, p.total_parcelas)
          // a cobrança não é coluna de parcelamentos: vira linhas em a_receber logo abaixo
          const { cobranca: _cobranca, ...campos } = p
          await appendRows(t, d, 'parcelamentos', [{ id: pid, ...campos, valor_parcela: valores[valores.length - 1], observacao: '' }])
          const linhas = valores.map((valor, k) => ({
            id: newId('L') + k,
            mes_ref: addMeses(p.mes_primeira_parcela, k),
            data: k === 0 ? p.data_compra || hoje() : `${addMeses(p.mes_primeira_parcela, k)}-01`, // 1ª: dia da compra; demais: início do mês
            descricao: p.descricao,
            valor,
            categoria: p.categoria,
            forma_pagamento: p.forma_pagamento,
            tipo: 'parcela',
            parcelas_restantes: p.total_parcelas - k,
            parcelamento_id: pid,
            vencimento: p.dia_pagamento ? `${addMeses(p.mes_primeira_parcela, k)}-${String(p.dia_pagamento).padStart(2, '0')}` : '',
          }))
          await appendRows(t, d, 'lancamentos', linhas)
          await appendRows(t, d, 'a_receber', linhasCobranca(p.cobranca, linhas))
        }),

      /** Novo gasto; com `cobranca`, a parte da outra pessoa vira um item a receber ligado a ele. */
      addGasto: (campos: Record<string, Cell>, cobranca?: Cobranca) =>
        run(async (t, d) => {
          const l = { id: newId('L'), ...campos, tipo: 'gasto' }
          await appendRows(t, d, 'lancamentos', [l])
          await appendRows(t, d, 'a_receber', linhasCobranca(cobranca, [{ id: l.id, mes_ref: str(campos.mes_ref), descricao: campos.descricao, tipo: 'gasto' }]))
        }),

      /** Cobra de alguém um lançamento que já existe (ex.: a parte de outra pessoa numa compra). */
      cobrarLancamentos: (ls: Lancamento[], cobranca: Cobranca) =>
        run(async (t, d) => {
          // parcelas estimadas ainda não têm linha: cria antes para a cobrança ficar ligada a elas
          const ids = new Map(ls.filter((l) => !l.row).map((l, k) => [l, newId('L') + k]))
          if (ids.size) await salvarLancamentos(t, d, [...ids].map(([l, id]) => ({ l, campos: { id } })))
          const comId = ls.map((l) => ({ id: ids.get(l) ?? l.id, mes_ref: l.mes_ref, descricao: l.descricao, tipo: l.tipo }))
          await appendRows(t, d, 'a_receber', linhasCobranca(cobranca, comId))
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

      /** Grava um ajuste geral (aba "ajustes"). */
      salvarAjuste: (chave: string, valor: Cell) =>
        run((t, d) => {
          const row = d.tables.ajustes.find((r) => str(r.chave) === chave)
          return row ? updateRow(t, d, 'ajustes', row, { valor }) : appendRows(t, d, 'ajustes', [{ chave, valor }])
        }),

      // ----- contas fixas / entradas fixas (versões com período de validade) -----

      novoFixo: (tab: TabFixa, campos: Record<string, Cell>, mesInicio: string) =>
        run((t, d) => {
          const id = newId(tab === 'fixos' ? 'F' : 'EF')
          return appendRows(t, d, tab, [{ id, serie: id, ...campos, ativo: 'sim', mes_inicio: mesInicio, mes_fim: '' }])
        }),

      /** Altera a conta a partir de um mês: os meses anteriores mantêm o valor antigo. */
      alterarFixo: (tab: TabFixa, v: VersaoFixa, campos: Record<string, Cell>, aPartirDe: string) =>
        run(async (t, d) => {
          // entrada fixa já confirmada nesses meses com o valor antigo: acompanha a mudança
          // (sem isso, a confirmação gravada continua valendo no lugar do novo valor)
          if (tab === 'entradas_fixas') {
            const confirmadas = d.tables.entradas.filter((r) => {
              const m = normMes(r.mes_ref)
              return (
                m >= aPartirDe &&
                (!v.mes_fim || m <= v.mes_fim) &&
                str(r.descricao).toLowerCase() === v.descricao.toLowerCase() &&
                Math.abs(num(r.valor) - v.valor) < 0.005
              )
            })
            const patch: Record<string, Cell> = {}
            if (campos.valor !== undefined) patch.valor = campos.valor
            if (campos.descricao !== undefined) patch.descricao = campos.descricao
            if (confirmadas.length && Object.keys(patch).length) await updateRows(t, d, 'entradas', confirmadas.map((row) => ({ row, patch })))
          }
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

      /** Edita uma entrada já lançada (descrição, valor, mês). */
      editarEntrada: (e: Entrada, campos: { descricao: string; valor: number; mes_ref: string }) =>
        run((t, d) => (e.row ? updateRow(t, d, 'entradas', e.row, campos) : Promise.resolve())),

      excluirEntrada: (e: Entrada) => run((t, d) => (e.row ? deleteRows(t, d, 'entradas', [e.row]) : Promise.resolve())),

      /**
       * Salva lançamentos (cada um com seus próprios campos): os que já estão na planilha são atualizados;
       * parcelas estimadas (sem linha) são criadas.
       */
      editarLancamentos: (itens: ItemSalvar[]) => run((t, d) => salvarLancamentos(t, d, itens)),

      /** Exclui lançamentos; `antes` grava outros ajustes na mesma operação (ex.: parcelas restantes). */
      excluirLancamentos: (ls: Lancamento[], antes: ItemSalvar[] = []) =>
        run(async (t, d) => {
          await salvarLancamentos(t, d, antes)
          await deleteRows(
            t,
            d,
            'lancamentos',
            ls.filter((l) => l.row).map((l) => l.row!),
          )
          // cobranças ainda não recebidas desses lançamentos deixam de existir junto
          const ids = new Set(ls.map((l) => l.id))
          const cobr = d.tables.a_receber.filter((r) => ids.has(str(r.origem)) && !/^s/i.test(str(r.recebido)))
          if (cobr.length) await deleteRows(t, d, 'a_receber', cobr)
        }),

      /**
       * Troca em qual mês as faturas dos cartões aparecem e move os dados já lançados junto:
       * paraVencimento = true → a fatura que vence em dezembro passa a aparecer em Dezembro (tudo anda +1 mês).
       */
      mudarMesFatura: (cartoes: string[], paraVencimento: boolean) =>
        run(async (t, d) => {
          if (!model) return
          const delta = paraVencimento ? 1 : -1
          const nomes = new Set(cartoes.map((c) => c.trim().toLowerCase()))
          const doCartao = (forma: Cell | undefined) => nomes.has(str(forma).toLowerCase())
          const mover = (m: Cell | undefined) => (str(m) ? addMeses(normMes(m), delta) : '')

          // meses com fixos "à moda antiga" (sem fixo_id): ao avançar, o último deles cairia num mês que hoje
          // usa o modelo de fixos; esses viram ajustes do mês (com fixo_id) para o modelo continuar valendo ali.
          const legadoAntes = new Set(model.lancamentos.filter((l) => l.row && l.tipo === 'fixo' && !l.fixo_id).map((l) => l.mes_ref))

          const lanc = model.lancamentos
            .filter((l) => l.row && doCartao(l.forma_pagamento))
            .map((l) => {
              const mes = addMeses(l.mes_ref, delta)
              const patch: Record<string, Cell> = { mes_ref: mes }
              if (l.tipo === 'fixo' && !l.fixo_id && !legadoAntes.has(mes)) {
                const f = model.fixos.find(
                  (x) => vigente(x, mes) && x.descricao.toLowerCase() === l.descricao.toLowerCase() && x.forma_pagamento.toLowerCase() === l.forma_pagamento.toLowerCase(),
                )
                patch.fixo_id = f?.serie ?? 'legado'
              }
              return { row: l.row!, patch }
            })
          await updateRows(t, d, 'lancamentos', lanc)

          const fixos = d.tables.fixos
            .filter((r) => doCartao(r.forma_pagamento) && (str(r.mes_inicio) || str(r.mes_fim)))
            .map((r) => ({ row: r, patch: { mes_inicio: mover(r.mes_inicio), mes_fim: mover(r.mes_fim) } }))
          await updateRows(t, d, 'fixos', fixos)

          const parc = d.tables.parcelamentos
            .filter((r) => doCartao(r.forma_pagamento) && str(r.mes_primeira_parcela))
            .map((r) => ({ row: r, patch: { mes_primeira_parcela: mover(r.mes_primeira_parcela) } }))
          await updateRows(t, d, 'parcelamentos', parc)

          const pags = d.tables.pagamentos
            .filter((r) => {
              const ref = str(r.referencia)
              return ref.startsWith('fatura:') && nomes.has(ref.slice(7).toLowerCase())
            })
            .map((r) => ({ row: r, patch: { mes_ref: mover(r.mes_ref) } }))
          await updateRows(t, d, 'pagamentos', pags)

          const formas = d.tables.formas_pagamento
            .filter((r) => nomes.has(str(r.nome).toLowerCase()))
            .map((r) => ({ row: r, patch: { fatura_vence_mes_seguinte: paraVencimento ? 'não' : 'sim' } }))
          await updateRows(t, d, 'formas_pagamento', formas)
        }),

      togglePago: (mes: string, c: Conta) =>
        run((t, d) =>
          c.pagamento
            ? deleteRows(t, d, 'pagamentos', [c.pagamento.row])
            : appendRows(t, d, 'pagamentos', [{ id: newId('G'), mes_ref: mes, referencia: c.ref, valor: c.valor, pago_em: hoje() }]),
        ),

      toggleRecebido: (r: Receber) => run((t, d) => marcar(t, d, [r], !r.recebido)),

      /** Marca vários itens como recebidos (ou não). Vezes do rodízio ainda sem linha são gravadas. */
      marcarRecebidos: (itens: Receber[], recebido = true) => run((t, d) => marcar(t, d, itens, recebido)),

      editarReceber: (r: Receber, campos: Record<string, Cell>) =>
        run((t, d) =>
          r.row ? updateRow(t, d, 'a_receber', r.row, campos) : appendRows(t, d, 'a_receber', [{ ...linhaReceber(r), ...campos }]),
        ),

      /**
       * Abatimento: a pessoa pagou algo para você e isso desconta do que ela te deve.
       * Com `lancar`, vira também um gasto seu (pago por ela: não entra em fatura nem em contas a pagar).
       */
      abater: (a: { pessoa: string; descricao: string; valor: number; data: string; lancar?: { categoria: string } }) =>
        run(async (t, d) => {
          const mes = a.data.slice(0, 7)
          const lid = a.lancar ? newId('L') : ''
          if (a.lancar)
            await appendRows(t, d, 'lancamentos', [
              {
                id: lid,
                mes_ref: mes,
                data: a.data,
                descricao: a.descricao,
                valor: a.valor,
                categoria: a.lancar.categoria,
                forma_pagamento: `Pago por ${a.pessoa}`,
                tipo: 'gasto',
              },
            ])
          await appendRows(t, d, 'a_receber', [
            { id: newId('R'), pessoa: a.pessoa, descricao: a.descricao, mes_ref: mes, data: a.data, valor: -a.valor, recebido: 'não', origem: lid, tipo: '' },
          ])
        }),

      // ----- investimentos -----

      /** Grava de uma vez os ajustes dos investimentos de um mês: altera, cria e exclui linhas. */
      salvarInvestimentosMes: (mud: { alterar: { row: Row; patch: Record<string, Cell> }[]; novos: Record<string, Cell>[]; remover: Row[] }) =>
        run(async (t, d) => {
          if (mud.alterar.length) await updateRows(t, d, 'investimentos', mud.alterar)
          if (mud.novos.length) await appendRows(t, d, 'investimentos', mud.novos.map((n, k) => ({ id: newId('I') + k, ...n })))
          if (mud.remover.length) await deleteRows(t, d, 'investimentos', mud.remover)
        }),

      /** Grava a divisão dos investimentos (destino → %); destino fora do mapa fica sem %. */
      salvarDivisao: (pcts: Record<string, number>) =>
        run((t, d) =>
          updateRows(
            t,
            d,
            'destinos_investimento',
            d.tables.destinos_investimento.filter((r) => str(r.nome)).map((r) => ({ row: r, patch: { percentual: pcts[str(r.nome)] ?? '' } })),
          ),
        ),

      // ----- carro -----

      /**
       * Cria (row ausente) ou edita uma troca/manutenção.
       * Com `lancar`, cria também o gasto nos lançamentos e liga os dois.
       */
      salvarTroca: (row: Row | undefined, valores: Record<string, Cell>, lancar?: Record<string, Cell>) =>
        run(async (t, d) => {
          let lid = str(valores.lancamento_id)
          if (lancar) {
            lid = newId('L')
            await appendRows(t, d, 'lancamentos', [{ id: lid, tipo: 'gasto', ...lancar }])
          }
          const v = { ...valores, lancamento_id: lid }
          if (row) await updateRow(t, d, 'carro_trocas', row, v)
          else await appendRows(t, d, 'carro_trocas', [{ id: newId('T'), ...v }])
        }),

      // ----- salários -----
      salvarSalario: (row: Row | undefined, valores: Record<string, Cell>) =>
        run((t, d) => (row ? updateRow(t, d, 'salarios', row, valores) : appendRows(t, d, 'salarios', [{ id: newId('S'), ...valores }]))),
      excluirSalario: (row: Row) => run((t, d) => deleteRows(t, d, 'salarios', [row])),
      importarSalarios: (linhas: Record<string, Cell>[]) =>
        run((t, d) => appendRows(t, d, 'salarios', linhas.map((l, k) => ({ id: newId('S') + k, ...l })))),

      excluirTroca: (row: Row) => run((t, d) => deleteRows(t, d, 'carro_trocas', [row])),

      /** Importa trocas coladas da planilha antiga. */
      importarTrocas: (linhas: Record<string, Cell>[]) =>
        run((t, d) => appendRows(t, d, 'carro_trocas', linhas.map((l, k) => ({ id: newId('T') + k, ...l })))),

      /** Renomeia uma pessoa em todas as cobranças (pendentes e recebidas) e nos rodízios. */
      renomearPessoa: (antigo: string, novo: string) =>
        run(async (t, d) => {
          const igual = (x: Cell | undefined) => str(x).toLowerCase() === antigo.trim().toLowerCase()
          await updateRows(
            t,
            d,
            'a_receber',
            d.tables.a_receber.filter((r) => igual(r.pessoa)).map((r) => ({ row: r, patch: { pessoa: novo } })),
          )
          await updateRows(
            t,
            d,
            'rodizios',
            d.tables.rodizios
              .filter((r) => igual(r.eu) || str(r.membros).split(',').some(igual))
              .map((r) => ({
                row: r,
                patch: {
                  membros: str(r.membros)
                    .split(',')
                    .map((m) => (igual(m) ? novo : m.trim()))
                    .filter(Boolean)
                    .join(', '),
                  eu: igual(r.eu) ? novo : str(r.eu),
                },
              })),
          )
        }),

      excluirReceber: (itens: Receber[]) =>
        run((t, d) =>
          deleteRows(
            t,
            d,
            'a_receber',
            itens.filter((r) => r.row).map((r) => r.row!),
          ),
        ),

      // ----- rodízios (ex.: Spotify) -----
      salvarRodizio: (row: Row | undefined, valores: Record<string, Cell>) =>
        run((t, d) => (row ? updateRow(t, d, 'rodizios', row, valores) : appendRows(t, d, 'rodizios', [{ id: newId('RZ'), ...valores }]))),

      excluirRodizio: (row: Row) => run((t, d) => deleteRows(t, d, 'rodizios', [row])),
    }),
    [run, model],
  )

  return { token, model, loading, busy, error, setError, login, logout, reload, actions, semAcesso, liberar }
}

export type Finance = ReturnType<typeof useFinance>

export type ItemSalvar = { l: Lancamento; campos: Record<string, Cell> }

function linhaReceber(r: Receber): Record<string, Cell> {
  return {
    id: r.projetado ? newId('R') : r.id,
    pessoa: r.pessoa,
    descricao: r.descricao,
    mes_ref: r.mes_ref,
    valor: r.valor,
    recebido: r.recebido ? 'sim' : 'não',
    origem: r.origem,
    tipo: r.tipo,
    recebido_em: r.recebido_em,
    data: r.data,
  }
}

async function marcar(t: string, d: DB, itens: Receber[], recebido: boolean) {
  const patch = { recebido: recebido ? 'sim' : 'não', recebido_em: recebido ? hoje() : '' }
  const comLinha = itens.filter((r) => r.row && r.recebido !== recebido)
  await updateRows(
    t,
    d,
    'a_receber',
    comLinha.map((r) => ({ row: r.row!, patch })),
  )
  const novos = itens.filter((r) => !r.row && recebido)
  await appendRows(
    t,
    d,
    'a_receber',
    novos.map((r, k) => ({ ...linhaReceber(r), id: newId('R') + k, ...patch })),
  )
}

/** Atualiza os lançamentos que já têm linha e cria as parcelas estimadas (sem linha). */
async function salvarLancamentos(t: string, d: DB, itens: ItemSalvar[]) {
  await updateRows(
    t,
    d,
    'lancamentos',
    itens.filter((i) => i.l.row).map((i) => ({ row: i.l.row!, patch: i.campos })),
  )
  await appendRows(
    t,
    d,
    'lancamentos',
    itens
      .filter((i) => !i.l.row)
      .map(({ l, campos }, k) => ({
        id: newId('L') + k,
        mes_ref: l.mes_ref,
        data: l.data,
        descricao: l.descricao,
        valor: l.valor,
        categoria: l.categoria,
        forma_pagamento: l.forma_pagamento,
        tipo: l.tipo,
        parcelas_restantes: l.parcelas_restantes ?? '',
        parcelamento_id: l.parcelamento_id,
        fixo_id: l.fixo_id,
        ...campos,
      })),
  )
}
