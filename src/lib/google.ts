// Login com Google (Google Identity Services, token no navegador) e acesso à Sheets API.
// Não existe servidor: o navegador fala direto com o Google usando o token da usuária.

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
] as const
export type Tab = (typeof TABS)[number]

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
  if (missing.length) throw new Error(`Abas faltando na planilha: ${missing.join(', ')}`)

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
  return { headers, sheetIds, tables }
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

/** Confere se as linhas ainda têm o id esperado (a planilha pode ter sido editada em outro lugar). */
async function assertIds(token: string, tab: Tab, rows: Row[]) {
  const ranges = rows.map((r) => 'ranges=' + encodeURIComponent(`${tab}!A${r._row}`)).join('&')
  const res = await api<{ valueRanges: { values?: Cell[][] }[] }>(token, `/values:batchGet?${ranges}`)
  rows.forEach((r, i) => {
    const got = String(res.valueRanges[i]?.values?.[0]?.[0] ?? '')
    if (got !== String(r.id)) throw new Error('A planilha mudou desde que foi carregada. Atualize e tente de novo.')
  })
}

export async function updateRow(token: string, db: DB, tab: Tab, row: Row, patch: Record<string, Cell>) {
  await assertIds(token, tab, [row])
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
  await assertIds(token, tab, rows)
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
