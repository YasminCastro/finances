import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Esc fecha o formulário, mas não quando há uma lista/calendário aberto por cima (o Esc é dele). */
export function escFecha(e: KeyboardEvent, onClose: () => void) {
  if (e.key !== 'Escape') return
  if (document.querySelector('[data-radix-popper-content-wrapper]')) return
  onClose()
}
