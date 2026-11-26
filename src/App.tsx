import { BarChart3, Car, TrendingUp, ChevronDown, PiggyBank, ChevronLeft, ChevronRight, HandCoins, Layers, LayoutDashboard, LayoutGrid, List, LoaderCircle, LogOut, Moon, Plus, RefreshCw, Repeat, Settings, Sun, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AddModal } from './components/AddModal'
import { ADD_KINDS } from './components/addKinds'
import type { AddKind } from './components/addKinds'
import { Button, cx } from './components/kit'
import { addMeses, mesAtual, nomeMes } from './lib/finance'
import { useFinance } from './lib/store'
import { escFecha } from './lib/utils'
import { MonthPicker } from './components/pickers'
import { Config } from './pages/Config'
import { Fixos } from './pages/Fixos'
import { Lancamentos } from './pages/Lancamentos'
import { Parcelamentos } from './pages/Parcelamentos'
import { Overview } from './pages/Overview'
import { Receber } from './pages/Receber'
import { Carro } from './pages/Carro'
import { Investimentos } from './pages/Investimentos'
import { Dashboard } from './pages/Dashboard'
import { Salarios } from './pages/Salarios'

type Page = 'overview' | 'dashboard' | 'lancamentos' | 'fixos' | 'parcelamentos' | 'receber' | 'carro' | 'salarios' | 'investimentos' | 'config'
const PAGES: { id: Page; label: string; curto?: string; icon: ReactNode }[] = [
  { id: 'overview', label: 'Visão geral', icon: <LayoutDashboard size={18} /> },
  { id: 'dashboard', label: 'Painel', icon: <BarChart3 size={18} /> },
  { id: 'lancamentos', label: 'Lançamentos', icon: <List size={18} /> },
  { id: 'fixos', label: 'Fixos', icon: <Repeat size={18} /> },
  { id: 'parcelamentos', label: 'Parcelas', icon: <Layers size={18} /> },
  { id: 'receber', label: 'A receber', icon: <HandCoins size={18} /> },
  { id: 'investimentos', label: 'Investimentos', curto: 'Investir', icon: <PiggyBank size={18} /> },
  { id: 'carro', label: 'Carro', icon: <Car size={18} /> },
  { id: 'salarios', label: 'Salários', icon: <TrendingUp size={18} /> },
]
const AJUSTES: { id: Page; label: string; icon: ReactNode }[] = [{ id: 'config', label: 'Configurações', icon: <Settings size={18} /> }]
const TODAS = [...PAGES, ...AJUSTES]
/** Celular: as abas fixas da barra inferior; o resto fica no "Mais". */
const PRINCIPAIS: { id: Page; label: string }[] = [
  { id: 'overview', label: 'Início' },
  { id: 'lancamentos', label: 'Lançamentos' },
  { id: 'dashboard', label: 'Painel' },
]
const NO_MAIS = TODAS.filter((p) => !PRINCIPAIS.some((x) => x.id === p.id))

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const set = (d: boolean) => {
    setDark(d)
    document.documentElement.classList.toggle('dark', d)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', d ? '#0b1120' : '#eef2f9')
    try {
      localStorage.setItem('financas.theme', d ? 'dark' : 'light')
    } catch {
      /* ignore */
    }
  }
  return [dark, set] as const
}

export default function App() {
  const finance = useFinance()
  const { token, model, loading, busy, error, setError, login, logout, reload, semAcesso, liberar } = finance
  const [dark, setDark] = useTheme()
  const [page, setPage] = useState<Page>('overview')
  const [mes, setMes] = useState(mesAtual)
  const [add, setAdd] = useState<AddKind | null>(null)
  const [mais, setMais] = useState(false)
  const closeAdd = useCallback(() => setAdd(null), [])
  const closeMais = useCallback(() => setMais(false), [])
  const irPara = (p: Page) => {
    setPage(p)
    setMais(false)
    window.scrollTo({ top: 0 })
  }
  // páginas que não dependem do mês (ex.: Salários) não mostram o seletor de mês nem o Adicionar das finanças
  const semMes = page === 'salarios'

  if (!token) return <Login onLogin={login} error={error} dark={dark} setDark={setDark} />
  if (semAcesso && !model)
    return <Liberar onLiberar={liberar} onSair={logout} error={error} dark={dark} setDark={setDark} />

  return (
    <div className="mx-auto flex min-h-screen max-w-[1500px] gap-5 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-5">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-5 hidden h-[calc(100vh-2.5rem)] w-60 shrink-0 flex-col rounded-3xl border border-line bg-card p-4 lg:flex">
        <Brand />
        <div className="mt-8 mb-2 px-2 text-xs font-medium text-faint">Menu</div>
        <nav className="space-y-1">
          {PAGES.map((p) => (
            <NavItem key={p.id} item={p} ativo={page === p.id} onClick={() => setPage(p.id)} />
          ))}
        </nav>
        <div className="mt-6 mb-2 px-2 text-xs font-medium text-faint">Ajustes</div>
        <nav className="space-y-1">
          {AJUSTES.map((p) => (
            <NavItem key={p.id} item={p} ativo={page === p.id} onClick={() => setPage(p.id)} />
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <div className="flex items-center justify-between rounded-xl px-2 text-sm text-muted">
            <span className="flex items-center gap-2">
              {dark ? <Moon size={16} /> : <Sun size={16} />} Tema
            </span>
            <ThemeToggle dark={dark} setDark={setDark} />
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl border-t border-line px-3 pt-4 pb-1 text-sm font-medium text-muted hover:text-ink"
          >
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        {/* Header (no celular fica grudado no topo ao rolar) */}
        <header className="sticky top-[max(0.5rem,env(safe-area-inset-top))] z-30 before:absolute before:inset-x-0 before:bottom-full before:h-[calc(env(safe-area-inset-top)+0.75rem)] before:bg-page lg:before:hidden mb-3 flex items-center gap-1 rounded-3xl border border-line bg-card/95 px-2 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur sm:gap-2 sm:px-5 sm:py-3 lg:static lg:mb-5 lg:bg-card lg:backdrop-blur-none">
          <div className="hidden sm:block lg:hidden">
            <Brand compact />
          </div>
          {semMes ? (
            <h1 className="min-w-0 flex-1 truncate px-2 text-lg font-bold tracking-tight sm:text-2xl">{TODAS.find((p) => p.id === page)?.label}</h1>
          ) : (
          <div className="flex min-w-0 flex-1 items-center gap-0.5 sm:gap-2">
            <IconBtn label="Mês anterior" onClick={() => setMes(addMeses(mes, -1))}>
              <ChevronLeft size={18} />
            </IconBtn>
            <MonthPicker value={mes} onChange={setMes}>
              <button className="flex min-w-0 items-center gap-1 rounded-xl px-1.5 py-0.5 hover:bg-soft" aria-label="Escolher mês">
                <h1 className="truncate text-[17px] font-bold tracking-tight sm:text-2xl">
                  {nomeMes(mes)} <span className="font-semibold text-muted">{mes.slice(0, 4)}</span>
                </h1>
                <ChevronDown size={16} className="shrink-0 text-muted" />
              </button>
            </MonthPicker>
            <IconBtn label="Próximo mês" onClick={() => setMes(addMeses(mes, 1))}>
              <ChevronRight size={18} />
            </IconBtn>
            {mes !== mesAtual() && (
              <button onClick={() => setMes(mesAtual())} className="ml-0.5 shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary hover:brightness-95 sm:ml-1">
                Hoje
              </button>
            )}
          </div>
          )}
          <IconBtn label="Atualizar dados" onClick={reload}>
            <RefreshCw size={17} className={cx((loading || busy) && 'animate-spin')} />
          </IconBtn>
          {!semMes && (
            <div className="hidden lg:flex">
              <AddButton onPick={setAdd} />
            </div>
          )}
        </header>

        {/* Celular: nome da página (a barra inferior só mostra parte delas) */}
        {!semMes && <h2 className="mb-3 px-1.5 text-xl font-bold tracking-tight lg:hidden">{TODAS.find((p) => p.id === page)?.label}</h2>}

        {error && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad">
            <span>{error}</span>
            <button onClick={() => setError(null)} aria-label="Fechar">
              <X size={16} />
            </button>
          </div>
        )}

        {!model ? (
          <div className="flex h-[60vh] items-center justify-center gap-3 text-muted">
            <LoaderCircle className="animate-spin" /> Carregando sua planilha…
          </div>
        ) : page === 'overview' ? (
          <Overview model={model} mes={mes} finance={finance} />
        ) : page === 'dashboard' ? (
          <Dashboard model={model} mes={mes} setMes={setMes} />
        ) : page === 'fixos' ? (
          <Fixos model={model} mes={mes} finance={finance} />
        ) : page === 'parcelamentos' ? (
          <Parcelamentos model={model} mes={mes} />
        ) : page === 'receber' ? (
          <Receber model={model} mes={mes} finance={finance} />
        ) : page === 'investimentos' ? (
          <Investimentos model={model} mes={mes} setMes={setMes} finance={finance} />
        ) : page === 'carro' ? (
          <Carro model={model} mes={mes} setMes={setMes} finance={finance} />
        ) : page === 'salarios' ? (
          <Salarios model={model} finance={finance} />
        ) : page === 'config' ? (
          <Config model={model} finance={finance} dark={dark} setDark={setDark} />
        ) : (
          <Lancamentos model={model} mes={mes} finance={finance} />
        )}
      </main>

      {/* Navegação (celular): 3 abas principais, Adicionar no centro e "Mais" com o restante */}
      <nav
        aria-label="Navegação"
        className="fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-40 mx-auto grid max-w-md grid-cols-[1fr_1fr_3.5rem_1fr_1fr] items-center rounded-3xl border border-line bg-card/95 px-1 py-1.5 shadow-[0_8px_30px_rgba(15,23,42,0.12)] backdrop-blur lg:hidden"
      >
        {PRINCIPAIS.slice(0, 2).map((p) => (
          <TabBtn key={p.id} label={p.label} icon={TODAS.find((x) => x.id === p.id)!.icon} ativo={page === p.id && !mais} onClick={() => irPara(p.id)} />
        ))}
        <div className="flex justify-center">
          <button
            onClick={() => {
              setMais(false)
              setAdd('gasto')
            }}
            aria-label="Adicionar"
            className="flex size-12 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_6px_16px_-4px_var(--color-primary)] transition active:scale-95"
          >
            <Plus size={24} strokeWidth={2.4} />
          </button>
        </div>
        {PRINCIPAIS.slice(2).map((p) => (
          <TabBtn key={p.id} label={p.label} icon={TODAS.find((x) => x.id === p.id)!.icon} ativo={page === p.id && !mais} onClick={() => irPara(p.id)} />
        ))}
        <TabBtn label="Mais" icon={<LayoutGrid size={20} />} ativo={mais || NO_MAIS.some((p) => p.id === page)} onClick={() => setMais((m) => !m)} />
      </nav>

      {mais && <MaisSheet page={page} onPick={irPara} onClose={closeMais} dark={dark} setDark={setDark} />}

      {add && model && <AddModal key={add} kind={add} setKind={setAdd} onClose={closeAdd} model={model} mes={mes} finance={finance} />}
    </div>
  )
}

function TabBtn({ label, icon, ativo, onClick }: { label: string; icon: ReactNode; ativo: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-current={ativo ? 'page' : undefined}
      className={cx(
        'flex min-w-0 flex-col items-center gap-1 rounded-2xl py-1 text-[11px] font-semibold tracking-tight transition active:scale-95',
        ativo ? 'text-primary' : 'text-muted',
      )}
    >
      <span className={cx('flex h-7 w-12 items-center justify-center rounded-full transition [&_svg]:size-5', ativo && 'bg-primary-soft')}>{icon}</span>
      <span className="max-w-full truncate">{label}</span>
    </button>
  )
}

/** Celular: folha inferior com as páginas que não cabem na barra. */
function MaisSheet({
  page,
  onPick,
  onClose,
  dark,
  setDark,
}: {
  page: Page
  onPick: (p: Page) => void
  onClose: () => void
  dark: boolean
  setDark: (d: boolean) => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => escFecha(e, onClose)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[35] bg-slate-950/40 backdrop-blur-[2px] lg:hidden" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Mais páginas"
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-line bg-card px-4 pt-2 pb-[calc(6.5rem+env(safe-area-inset-bottom))] shadow-2xl"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
        <div className="grid grid-cols-3 gap-2">
          {NO_MAIS.map((p) => (
            <button
              key={p.id}
              onClick={() => onPick(p.id)}
              className={cx(
                'flex flex-col items-center gap-2 rounded-2xl px-1 py-3.5 text-xs font-semibold transition active:scale-95',
                page === p.id ? 'bg-primary-soft text-primary' : 'bg-soft text-ink',
              )}
            >
              <span className={cx('[&_svg]:size-[22px]', page === p.id ? 'text-primary' : 'text-muted')}>{p.icon}</span>
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-soft px-4 py-2.5 text-sm font-medium text-muted">
          <span className="flex items-center gap-2">
            {dark ? <Moon size={16} /> : <Sun size={16} />} Tema
          </span>
          <ThemeToggle dark={dark} setDark={setDark} />
        </div>
      </div>
    </div>
  )
}

function NavItem({ item, ativo, onClick }: { item: { label: string; icon: ReactNode }; ativo: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
        ativo ? 'bg-soft font-semibold text-ink' : 'text-muted hover:bg-soft hover:text-ink',
      )}
    >
      <span className={ativo ? 'text-primary' : ''}>{item.icon}</span>
      {item.label}
    </button>
  )
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <img src="/favicon.svg" alt="" className="size-9 rounded-xl" />
      {!compact && (
        <div>
          <div className="text-sm font-bold">Finanças</div>
          <div className="text-xs text-muted">Controle pessoal</div>
        </div>
      )}
    </div>
  )
}

function IconBtn({ children, onClick, label }: { children: ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-10 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-soft hover:text-ink active:bg-soft sm:size-9"
    >
      {children}
    </button>
  )
}

function ThemeToggle({ dark, setDark }: { dark: boolean; setDark: (d: boolean) => void }) {
  return (
    <div className="flex rounded-full bg-soft p-0.5">
      {[false, true].map((d) => (
        <button
          key={String(d)}
          onClick={() => setDark(d)}
          aria-label={d ? 'Tema escuro' : 'Tema claro'}
          className={cx('flex size-7 items-center justify-center rounded-full', dark === d ? 'bg-card text-ink shadow-sm' : 'text-faint')}
        >
          {d ? <Moon size={14} /> : <Sun size={14} />}
        </button>
      ))}
    </div>
  )
}

function AddButton({ onPick }: { onPick: (k: AddKind) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  return (
    <div ref={ref} className="relative flex shrink-0">
      <button
        onClick={() => onPick('gasto')}
        className="flex items-center gap-1.5 rounded-l-xl bg-primary py-2 pr-2 pl-3 text-sm font-semibold text-white hover:brightness-110"
      >
        <Plus size={16} /> <span className="hidden sm:inline">Adicionar</span>
      </button>
      <button
        onClick={() => setOpen(!open)}
        aria-label="Mais opções"
        className="rounded-r-xl border-l border-white/25 bg-primary px-2 text-white hover:brightness-110"
      >
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="absolute top-full right-0 z-30 mt-2 w-48 overflow-hidden rounded-2xl border border-line bg-card p-1 shadow-xl">
          {ADD_KINDS.map((k) => (
            <button
              key={k.id}
              onClick={() => {
                setOpen(false)
                onPick(k.id)
              }}
              className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-soft"
            >
              {k.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Login({
  onLogin,
  error,
  dark,
  setDark,
}: {
  onLogin: () => void
  error: string | null
  dark: boolean
  setDark: (d: boolean) => void
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle dark={dark} setDark={setDark} />
      </div>
      <div className="w-full max-w-sm rounded-3xl border border-line bg-card p-8 text-center shadow-sm">
        <img src="/favicon.svg" alt="" className="mx-auto size-14 rounded-2xl" />
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Finanças</h1>
        <p className="mt-2 text-sm text-muted">Entre com a conta Google dona da planilha para ver seu painel.</p>
        <Button variant="primary" onClick={onLogin} className="mt-6 w-full py-3">
          <GoogleIcon /> Entrar com Google
        </Button>
        {error && <p className="mt-4 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
        <p className="mt-6 text-xs text-faint">Seus dados ficam só na sua planilha do Google.</p>
      </div>
    </div>
  )
}

/** Primeiro acesso (escopo drive.file): a usuária escolhe a planilha uma vez no seletor do Google. */
function Liberar({
  onLiberar,
  onSair,
  error,
  dark,
  setDark,
}: {
  onLiberar: () => void
  onSair: () => void
  error: string | null
  dark: boolean
  setDark: (d: boolean) => void
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle dark={dark} setDark={setDark} />
      </div>
      <div className="w-full max-w-sm rounded-3xl border border-line bg-card p-8 text-center shadow-sm">
        <img src="/favicon.svg" alt="" className="mx-auto size-14 rounded-2xl" />
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Liberar a planilha</h1>
        <p className="mt-2 text-sm text-muted">
          Por segurança, o app só acessa a planilha que você escolher. Selecione <b>Finanças App - Dados</b> na
          próxima janela. É preciso fazer isso só uma vez.
        </p>
        <Button variant="primary" onClick={onLiberar} className="mt-6 w-full py-3">
          <GoogleIcon /> Escolher planilha
        </Button>
        {error && <p className="mt-4 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
        <button onClick={onSair} className="mt-4 text-xs text-faint hover:underline">
          Sair
        </button>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden className="rounded-full bg-white p-0.5">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  )
}
