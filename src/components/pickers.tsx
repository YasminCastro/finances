import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { ptBR } from 'react-day-picker/locale'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { MESES, mesAtual, nomeMes } from '@/lib/finance'
import { cn } from '@/lib/utils'

// Datas no app são texto: 'AAAA-MM-DD' (dia) e 'AAAA-MM' (mês).
const toDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return y && m && d ? new Date(y, m - 1, d) : undefined
}
const fromDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** 'AAAA-MM-DD' → 'dd/mm/aaaa' */
const dataBR = (v: string) => (toDate(v) ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : '')

/** Põe as barras enquanto digita: "0106" → "01/06", "01062021" → "01/06/2021". */
function mascara(txt: string, partes: number[]) {
  const d = txt.replace(/\D/g, '').slice(0, partes.reduce((a, b) => a + b, 0))
  const out: string[] = []
  let i = 0
  for (const n of partes) {
    if (i >= d.length) break
    out.push(d.slice(i, i + n))
    i += n
  }
  return out.join('/')
}

/** Lê "dd/mm/aaaa", "dd/mm/aa" ou "dd/mm" (ano atual); devolve 'AAAA-MM-DD' ou null. */
function lerData(txt: string): string | null {
  const m = txt.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/)
  if (!m) return null
  const dia = Number(m[1])
  const mes = Number(m[2])
  const ano = !m[3] ? new Date().getFullYear() : m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
  const d = new Date(ano, mes - 1, dia)
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null
  return fromDate(d)
}

const campoCls =
  'w-full rounded-xl border border-line bg-card py-2.5 pr-10 pl-3 text-sm text-ink tabular-nums outline-none transition placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20'
const iconeCls = 'absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-soft hover:text-ink'
const erroCls = 'border-bad focus:border-bad focus:ring-bad/20'

/**
 * Campo de data: dá para digitar (dd/mm/aaaa, as barras entram sozinhas; dd/mm usa o ano atual)
 * ou escolher no calendário.
 */
export function DatePicker({ value, onChange, placeholder = 'dd/mm/aaaa' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false)
  const [txt, setTxt] = useState(() => dataBR(value))
  const [erro, setErro] = useState(false)
  // valor mudou por fora (calendário, outro campo): mostra o novo
  const [ultimo, setUltimo] = useState(value)
  if (value !== ultimo) {
    setUltimo(value)
    setTxt(dataBR(value))
    setErro(false)
  }
  const selected = toDate(value)

  const digitar = (t: string) => {
    const m = mascara(t, [2, 2, 4])
    setTxt(m)
    setErro(false)
    // data completa e válida: já vale
    if (m.length === 10) {
      const iso = lerData(m)
      if (iso) {
        setUltimo(iso)
        onChange(iso)
      }
    }
  }
  const confirmar = () => {
    if (!txt.trim()) return setTxt(dataBR(value))
    const iso = lerData(txt)
    if (iso) {
      setUltimo(iso)
      setTxt(dataBR(iso))
      if (iso !== value) onChange(iso)
    } else setErro(true)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <input
            inputMode="numeric"
            autoComplete="off"
            className={cn(campoCls, erro && erroCls)}
            value={txt}
            placeholder={placeholder}
            onChange={(e) => digitar(e.target.value)}
            onBlur={confirmar}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && txt && !lerData(txt)) {
                e.preventDefault()
                setErro(true)
              } else if (e.key === 'Enter') confirmar()
              else if (e.key === 'ArrowDown' && e.altKey) setOpen(true)
            }}
            aria-invalid={erro || undefined}
            title={erro ? 'Data inválida: use dd/mm/aaaa' : undefined}
          />
          <PopoverTrigger asChild>
            <button type="button" className={iconeCls} aria-label="Abrir calendário" title="Abrir calendário">
              <CalendarDays className="size-4" />
            </button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent className="w-auto rounded-2xl border-line p-0" align="start">
        <Calendar
          mode="single"
          locale={ptBR}
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => {
            if (d) onChange(fromDate(d))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

/** Grade de meses no estilo do shadcn (o shadcn não tem seletor de mês pronto). */
function MonthGrid({ value, onSelect }: { value: string; onSelect: (v: string) => void }) {
  const [ano, setAno] = useState(() => Number((value || mesAtual()).slice(0, 4)))
  const atual = mesAtual()
  return (
    <div className="w-64 p-3">
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => setAno(ano - 1)} aria-label="Ano anterior">
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-semibold">{ano}</span>
        <Button variant="ghost" size="icon" className="size-8" onClick={() => setAno(ano + 1)} aria-label="Próximo ano">
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {MESES.map((nome, i) => {
          const m = `${ano}-${String(i + 1).padStart(2, '0')}`
          const sel = m === value
          return (
            <Button
              key={m}
              variant={sel ? 'default' : 'ghost'}
              onClick={() => onSelect(m)}
              className={cn('h-9 text-sm font-medium', !sel && m === atual && 'bg-accent text-primary')}
            >
              {nome.slice(0, 3)}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Seletor de mês. Sem `children` mostra um campo de formulário;
 * com `children`, usa o elemento passado como gatilho (ex.: o título do topo).
 */
export function MonthPicker({
  value,
  onChange,
  children,
  align = 'start',
}: {
  value: string
  onChange: (v: string) => void
  children?: ReactNode
  align?: 'start' | 'center' | 'end'
}) {
  const [open, setOpen] = useState(false)
  const grade = (
    <PopoverContent className="w-auto rounded-2xl border-line p-0" align={align}>
      <MonthGrid
        key={value}
        value={value}
        onSelect={(m) => {
          onChange(m)
          setOpen(false)
        }}
      />
    </PopoverContent>
  )
  if (children)
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        {grade}
      </Popover>
    )
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <MesDigitavel value={value} onChange={onChange} />
      {grade}
    </Popover>
  )
}

const mesBR = (v: string) => (/^\d{4}-\d{2}$/.test(v) ? `${v.slice(5, 7)}/${v.slice(0, 4)}` : '')
function lerMes(txt: string): string | null {
  const m = txt.match(/^(\d{1,2})\/(\d{2}|\d{4})$/)
  if (!m) return null
  const mes = Number(m[1])
  const ano = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2])
  return mes >= 1 && mes <= 12 ? `${ano}-${String(mes).padStart(2, '0')}` : null
}

/** Campo de mês digitável (mm/aaaa) com a grade de meses no botão. */
function MesDigitavel({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [txt, setTxt] = useState(() => mesBR(value))
  const [erro, setErro] = useState(false)
  const [ultimo, setUltimo] = useState(value)
  if (value !== ultimo) {
    setUltimo(value)
    setTxt(mesBR(value))
    setErro(false)
  }
  const confirmar = () => {
    if (!txt.trim()) return setTxt(mesBR(value))
    const m = lerMes(txt)
    if (m) {
      setUltimo(m)
      setTxt(mesBR(m))
      if (m !== value) onChange(m)
    } else setErro(true)
  }
  return (
    <PopoverAnchor asChild>
      <div className="relative">
        <input
          inputMode="numeric"
          autoComplete="off"
          className={cn(campoCls, erro && erroCls)}
          value={txt}
          placeholder="mm/aaaa"
          onChange={(e) => {
            const t = mascara(e.target.value, [2, 4])
            setTxt(t)
            setErro(false)
            const m = t.length === 7 ? lerMes(t) : null
            if (m) {
              setUltimo(m)
              onChange(m)
            }
          }}
          onBlur={confirmar}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && txt && !lerMes(txt)) {
              e.preventDefault()
              setErro(true)
            } else if (e.key === 'Enter') confirmar()
          }}
          aria-invalid={erro || undefined}
          title={erro ? 'Mês inválido: use mm/aaaa' : value ? `${nomeMes(value)} de ${value.slice(0, 4)}` : undefined}
        />
        <PopoverTrigger asChild>
          <button type="button" className={iconeCls} aria-label="Escolher mês" title="Escolher mês">
            <CalendarDays className="size-4" />
          </button>
        </PopoverTrigger>
      </div>
    </PopoverAnchor>
  )
}
