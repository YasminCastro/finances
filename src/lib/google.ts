// Login com Google (Google Identity Services, token no navegador) e acesso à Sheets API.
// Não existe servidor: o navegador fala direto com o Google usando o token da usuária.

import { corDaPosicao, ordemAlfabetica } from './cores'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string
export const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID as string
export const SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const TOKEN_KEY = 'financas.token'

interface TokenResponse {
  access_token?: string
  expires_in?: number | string
  error?: string
  error_description?: string
}
interface TokenClient {
  requestAccessToken: (o?: { prompt?: string }) => void
}
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string
            scope: string
            callback: (r: TokenResponse) => void
            error_callback?: (e: { type?: string; message?: string }) => void
          }) => TokenClient
          revoke: (token: string, done: () => void) => void
        }
      }
    }
  }
}

export class AuthError extends Error {}

// ---------- token ----------

export function getStoredToken(): string | null {
  try {
    const s = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null') as { token: string; exp: number } | null
    if (s && s.exp > Date.now() + 60_000) return s.token
  } catch {
    /* armazenamento indisponível */
  }
  return null
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

let gisPromise: Promise<void> | null = null
export function loadGoogleScript(): Promise<void> {
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      if (window.google?.accounts) return resolve()
      const s = document.createElement('script')
      s.src = 'https://accounts.google.com/gsi/client'
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => {
        gisPromise = null
        reject(new Error('Não foi possível carregar o login do Google. Verifique a internet.'))
      }
      document.head.appendChild(s)
    })
  }
  return gisPromise
}

export async function signIn(): Promise<string> {
  await loadGoogleScript()
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (r) => {
        if (r.error || !r.access_token) {
          reject(new Error(r.error_description || r.error || 'Login cancelado'))
          return
        }
        const exp = Date.now() + Number(r.expires_in ?? 3600) * 1000
        try {
          localStorage.setItem(TOKEN_KEY, JSON.stringify({ token: r.access_token, exp }))
        } catch {
          /* segue sem lembrar o login */
        }
        resolve(r.access_token)
      },
      error_callback: (e) =>
        reject(new Error(e.type === 'popup_closed' ? 'A janela de login foi fechada.' : e.message || 'Login cancelado')),
    })
    client.requestAccessToken()
  })
}

export function signOut(token: string | null) {
  if (token) window.google?.accounts.oauth2.revoke(token, () => {})
  clearToken()
}

// ---------- Sheets API ----------

export const TABS = [
  'lancamentos',
  'fixos',
  'parcelamentos',
  'entradas',
  'investimentos',
  'a_receber',
  'formas_pagamento',
  'categorias',
  'destinos_investimento',
  'pagamentos',
  'entradas_fixas',
] as const
export type Tab = (typeof TABS)[number]

/** Abas que o app cria sozinho se ainda não existirem na planilha. */
const AUTO_CREATE: Partial<Record<Tab, string[]>> = {
  entradas_fixas: ['id', 'descricao', 'valor', 'ativo', 'mes_inicio', 'mes_fim', 'serie'],
}

/** Colunas que o app acrescenta no fim do cabeçalho se ainda não existirem. */
const AUTO_COLUMNS: Partial<Record<Tab, string[]>> = {
  fixos: ['mes_inicio', 'mes_fim', 'serie', 'frequencia_meses', 'parcelas'],
  entradas_fixas: ['mes_inicio', 'mes_fim', 'serie'],
  lancamentos: ['fixo_id'],
  formas_pagamento: ['dias_fechamento', 'limite'],
  categorias: ['cor'],
}

export type Cell = string | number
export type Row = Record<string, Cell> & { _row: number }
export interface DB {
  headers: Record<Tab, string[]>
  sheetIds: Record<string, number>
  tables: Record<Tab, Row[]>
}

async function api<T = unknown>(token: string, path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (r.status === 401) {
    clearToken()
    throw new AuthError('Sua sessão expirou. Entre novamente.')
  }
  if (!r.ok) {
    let msg = ''
    try {
      msg = ((await r.json()) as { error?: { message?: string } }).error?.message ?? ''
    } catch {
      /* corpo não é JSON */
    }
    if (r.status === 403) msg = `Sem permissão na planilha. ${msg}`
    throw new Error(`Google Sheets (${r.status}): ${msg || r.statusText}`)
  }
  return (await r.json()) as T
}

function colLetter(n: number) {
  let s = ''
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export async function loadDB(token: string): Promise<DB> {
  const meta = await api<{ sheets: { properties: { sheetId: number; title: string } }[] }>(
    token,
    '?fields=sheets.properties(sheetId,title)',
  )
  const sheetIds: Record<string, number> = {}
  for (const s of meta.sheets) sheetIds[s.properties.title] = s.properties.sheetId
  const missing = TABS.filter((t) => !(t in sheetIds))
  const toCreate = missing.filter((t) => AUTO_CREATE[t])
  const fatal = missing.filter((t) => !AUTO_CREATE[t])
  if (fatal.length) throw new Error(`Abas faltando na planilha: ${fatal.join(', ')}`)
  if (toCreate.length) {
    let res: { replies: { addSheet: { properties: { sheetId: number; title: string } } }[] }
    try {
      res = await api(token, ':batchUpdate', {
        method: 'POST',
        body: JSON.stringify({ requests: toCreate.map((title) => ({ addSheet: { properties: { title } } })) }),
      })
    } catch (e) {
      // Outra carga (ou outra aba do navegador) criou a aba ao mesmo tempo: só recarrega.
      if (e instanceof Error && /already exists|já existe/i.test(e.message)) return loadDB(token)
      throw e
    }
    for (const r of res.replies) sheetIds[r.addSheet.properties.title] = r.addSheet.properties.sheetId
    await api(token, '/values:batchUpdate', {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: toCreate.map((t) => ({ range: `${t}!A1`, values: [AUTO_CREATE[t]] })),
      }),
    })
  }

  const qs = TABS.map((t) => 'ranges=' + encodeURIComponent(t)).join('&')
  const data = await api<{ valueRanges: { values?: Cell[][] }[] }>(
    token,
    `/values:batchGet?${qs}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`,
  )
  const headers = {} as Record<Tab, string[]>
  const tables = {} as Record<Tab, Row[]>
  TABS.forEach((tab, i) => {
    const values = data.valueRanges[i]?.values ?? []
    const h = (values[0] ?? []).map((x) => String(x).trim())
    headers[tab] = h
    tables[tab] = values
      .slice(1)
      .map((v, idx) => {
        const o = { _row: idx + 2 } as Row
        h.forEach((k, j) => {
          o[k] = v[j] ?? ''
        })
        return o
      })
      .filter((o) => h.some((k) => o[k] !== ''))
  })

  // Acrescenta colunas novas no cabeçalho (os valores ficam vazios nas linhas existentes).
  const novas: { range: string; values: Cell[][] }[] = []
  for (const tab of TABS) {
    const faltam = (AUTO_COLUMNS[tab] ?? []).filter((c) => !headers[tab].includes(c))
    if (!faltam.length || !headers[tab].length) continue
    novas.push({ range: `${tab}!${colLetter(headers[tab].length + 1)}1`, values: [faltam] })
    headers[tab] = [...headers[tab], ...faltam]
    for (const r of tables[tab]) for (const c of faltam) r[c] = ''
  }
  if (novas.length)
    await api(token, '/values:batchUpdate', { method: 'POST', body: JSON.stringify({ valueInputOption: 'RAW', data: novas }) })

  const db: DB = { headers, sheetIds, tables }

  // Categorias sem cor recebem uma cor pela ordem alfabética (uma vez só; depois fica gravada).
  const jCor = headers.categorias.indexOf('cor')
  if (jCor >= 0) {
    const ordenadas = [...tables.categorias].filter((r) => String(r.nome).trim()).sort((a, b) => ordemAlfabetica(String(a.nome), String(b.nome)))
    const semCor = ordenadas.map((r, i) => ({ r, i })).filter(({ r }) => !String(r.cor ?? '').trim())
    if (semCor.length) {
      await api(token, '/values:batchUpdate', {
        method: 'POST',
        body: JSON.stringify({
          valueInputOption: 'RAW',
          data: semCor.map(({ r, i }) => ({ range: `categorias!${colLetter(jCor + 1)}${r._row}`, values: [[corDaPosicao(i)]] })),
        }),
      })
      for (const { r, i } of semCor) r.cor = corDaPosicao(i)
    }
  }

  // Aba recém-criada: usa o salário mais recente como ponto de partida.
  // (Só na criação: o Google recusa criar a mesma aba duas vezes, então não duplica.)
  if (toCreate.includes('entradas_fixas')) {
    const salario = [...tables.entradas]
      .filter((r) => String(r.descricao).toLowerCase().startsWith('sal'))
      .sort((a, b) => String(a.mes_ref).localeCompare(String(b.mes_ref)))
      .pop()
    if (salario) {
      const id = newId('EF')
      const row = { id, serie: id, descricao: String(salario.descricao), valor: salario.valor, ativo: 'sim' }
      await appendRows(token, db, 'entradas_fixas', [row])
      tables.entradas_fixas = [{ ...row, _row: 2 }]
    }
  }
  return db
}

export async function appendRows(token: string, db: DB, tab: Tab, rows: Record<string, Cell>[]) {
  if (!rows.length) return
  const h = db.headers[tab]
  const values = rows.map((o) => h.map((k) => o[k] ?? ''))
  await api(token, `/values/${encodeURIComponent(tab + '!A1')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body: JSON.stringify({ values }),
  })
}

/**
 * Confere se as linhas ainda são as esperadas (a planilha pode ter sido editada em outro lugar).
 * Compara a 1ª coluna da aba (id, ou nome nas abas de configuração).
 */
async function assertIds(token: string, db: DB, tab: Tab, rows: Row[]) {
  const chave = db.headers[tab][0]
  const ranges = rows.map((r) => 'ranges=' + encodeURIComponent(`${tab}!A${r._row}`)).join('&')
  const res = await api<{ valueRanges: { values?: Cell[][] }[] }>(token, `/values:batchGet?${ranges}`)
  rows.forEach((r, i) => {
    const got = String(res.valueRanges[i]?.values?.[0]?.[0] ?? '')
    if (got !== String(r[chave])) throw new Error('A planilha mudou desde que foi carregada. Atualize e tente de novo.')
  })
}

/** Onde cada nome de configuração é usado (aba, coluna). */
const REFERENCIAS: Partial<Record<Tab, [Tab, string][]>> = {
  formas_pagamento: [
    ['lancamentos', 'forma_pagamento'],
    ['fixos', 'forma_pagamento'],
    ['parcelamentos', 'forma_pagamento'],
  ],
  categorias: [
    ['lancamentos', 'categoria'],
    ['fixos', 'categoria'],
    ['parcelamentos', 'categoria'],
  ],
  destinos_investimento: [['investimentos', 'destino']],
}

/** Ao renomear uma categoria/forma/destino, atualiza todas as linhas que usam o nome antigo. */
export async function renomearReferencias(token: string, db: DB, tab: Tab, antigo: string, novo: string) {
  const data: { range: string; values: Cell[][] }[] = []
  const igual = (v: Cell) => String(v).trim().toLowerCase() === antigo.trim().toLowerCase()
  for (const [alvo, coluna] of REFERENCIAS[tab] ?? []) {
    const j = db.headers[alvo].indexOf(coluna)
    if (j < 0) continue
    for (const r of db.tables[alvo]) if (igual(r[coluna])) data.push({ range: `${alvo}!${colLetter(j + 1)}${r._row}`, values: [[novo]] })
  }
  // pagamentos marcados como "fatura:<forma>"
  if (tab === 'formas_pagamento') {
    const j = db.headers.pagamentos.indexOf('referencia')
    for (const r of db.tables.pagamentos)
      if (String(r.referencia).toLowerCase() === `fatura:${antigo}`.toLowerCase())
        data.push({ range: `pagamentos!${colLetter(j + 1)}${r._row}`, values: [[`fatura:${novo}`]] })
  }
  if (data.length) await api(token, '/values:batchUpdate', { method: 'POST', body: JSON.stringify({ valueInputOption: 'RAW', data }) })
  return data.length
}

export async function updateRow(token: string, db: DB, tab: Tab, row: Row, patch: Record<string, Cell>) {
  await assertIds(token, db, tab, [row])
  const h = db.headers[tab]
  const merged: Record<string, Cell> = { ...row, ...patch }
  const range = `${tab}!A${row._row}:${colLetter(h.length)}${row._row}`
  await api(token, `/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [h.map((k) => merged[k] ?? '')] }),
  })
}

export async function deleteRows(token: string, db: DB, tab: Tab, rows: Row[]) {
  if (!rows.length) return
  await assertIds(token, db, tab, rows)
  const sorted = [...new Set(rows.map((r) => r._row))].sort((a, b) => b - a)
  await api(token, ':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      requests: sorted.map((r) => ({
        deleteDimension: { range: { sheetId: db.sheetIds[tab], dimension: 'ROWS', startIndex: r - 1, endIndex: r } },
      })),
    }),
  })
}

export function newId(prefix: string) {
  return prefix + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase()
}
