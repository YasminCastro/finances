import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { ptBR } from 'react-day-picker/locale'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { MESES, dataCurta, mesAtual, nomeMes } from '@/lib/finance'
import { cn } from '@/lib/utils'

// Datas no app são texto: 'AAAA-MM-DD' (dia) e 'AAAA-MM' (mês).
const toDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return y && m && d ? new Date(y, m - 1, d) : undefined
}
const fromDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const triggerCls =
  'h-auto w-full justify-between rounded-xl border-line bg-card px-3 py-2.5 text-sm font-normal text-ink shadow-none hover:bg-soft'

/** Seletor de data (shadcn Calendar dentro de um Popover). */
export function DatePicker({ value, onChange, placeholder = 'Escolher data' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false)
  const selected = toDate(value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={triggerCls}>
          <span className={cn(!selected && 'text-muted')}>{selected ? `${dataCurta(value)}/${value.slice(0, 4)}` : placeholder}</span>
          <CalendarDays className="size-4 text-muted" />
        </Button>
      </PopoverTrigger>
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
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children ?? (
          <Button variant="outline" className={triggerCls}>
            <span>{value ? `${nomeMes(value)} de ${value.slice(0, 4)}` : 'Escolher mês'}</span>
            <CalendarDays className="size-4 text-muted" />
          </Button>
        )}
      </PopoverTrigger>
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
    </Popover>
  )
}
