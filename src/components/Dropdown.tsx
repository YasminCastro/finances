import { Check, ChevronDown } from 'lucide-react'
import { useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface OpcaoDropdown {
  value: string
  label: string
  /** bolinha de cor (categorias, formas de pagamento) */
  cor?: string
}

/** Tira acentos e maiúsculas: "Itaú" → "itau". */
const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/** Filtro da busca: começa com o texto vale mais; contém o texto vale menos; senão, some. */
function filtro(_value: string, busca: string, keywords?: string[]) {
  const alvo = normalizar(keywords?.[0] ?? _value)
  const q = normalizar(busca)
  if (!q) return 1
  if (alvo.startsWith(q)) return 1
  if (alvo.split(/\s+/).some((p) => p.startsWith(q))) return 0.8
  return alvo.includes(q) ? 0.5 : 0
}

/**
 * Dropdown com busca (padrão Combobox do shadcn/ui: Popover + Command).
 * Dá para começar a digitar com o campo focado: ele abre já filtrando.
 */
export function Dropdown({
  value,
  onChange,
  opcoes,
  placeholder = 'Selecione',
  className,
  disabled,
  gatilho,
  semBusca,
}: {
  value: string
  onChange: (v: string) => void
  opcoes: OpcaoDropdown[]
  placeholder?: string
  className?: string
  disabled?: boolean
  /** conteúdo próprio do botão (ex.: uma etiqueta); aí o botão só usa `className` */
  gatilho?: (atual: OpcaoDropdown | undefined) => ReactNode
  /** listas curtas: sem o campo de busca */
  semBusca?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [busca, setBusca] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const atual = opcoes.find((o) => o.value === value)

  const abrir = (texto = '') => {
    setBusca(texto)
    setOpen(true)
  }

  // Digitar com o campo fechado e focado abre a lista já buscando pela letra digitada.
  function onKeyDownTrigger(e: KeyboardEvent<HTMLButtonElement>) {
    if (!semBusca && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== ' ') {
      e.preventDefault()
      abrir(e.key)
    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault()
      abrir()
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setBusca('')
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          onKeyDown={onKeyDownTrigger}
          className={
            gatilho
              ? cn('outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-default', className)
              : cn(
                  'flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-card px-3 py-2.5 text-left text-sm text-ink outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50',
                  className,
                )
          }
        >
          {gatilho ? (
            gatilho(atual)
          ) : (
            <>
              <span className={cn('flex min-w-0 items-center gap-2', !atual && 'text-muted')}>
                {atual?.cor && <span className="size-2.5 shrink-0 rounded-full" style={{ background: atual.cor }} />}
                <span className="truncate">{atual?.label ?? placeholder}</span>
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted" />
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={cn('min-w-48 rounded-xl border-line p-0', gatilho ? 'w-auto' : 'w-(--radix-popover-trigger-width)')}
        align="start"
        onOpenAutoFocus={(e) => {
          // foca a busca com o cursor no fim, para não perder a letra já digitada
          e.preventDefault()
          const el = inputRef.current
          if (el) {
            el.focus()
            el.setSelectionRange(el.value.length, el.value.length)
          }
        }}
      >
        <Command filter={filtro}>
          {/* sem busca: o campo continua lá (invisível) só para as setas do teclado funcionarem */}
          <div className={semBusca ? 'h-0 overflow-hidden' : undefined}>
            <CommandInput ref={inputRef} placeholder="Buscar…" value={busca} onValueChange={setBusca} />
          </div>
          <CommandList className="max-h-64">
            <CommandEmpty>Nada encontrado.</CommandEmpty>
            {opcoes.map((o) => (
              <CommandItem
                key={o.value || '__vazio__'}
                value={o.value || '__vazio__'}
                keywords={[o.label]}
                onSelect={() => {
                  onChange(o.value)
                  setOpen(false)
                  setBusca('')
                }}
                className="rounded-lg py-2"
              >
                {o.cor && <span className="size-2.5 shrink-0 rounded-full" style={{ background: o.cor }} />}
                <span className="flex-1 truncate">{o.label}</span>
                <Check className={cn('size-4 text-primary', o.value === value ? 'opacity-100' : 'opacity-0')} />
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
