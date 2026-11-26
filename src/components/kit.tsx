import type { ReactNode } from 'react'
import { fmt } from '../lib/finance'
import { cn } from '../lib/utils'

/** Junta classes; em conflito (ex.: p-4 do componente e p-0 de quem usa) vale a última. */
export function cx(...xs: (string | false | null | undefined)[]) {
  return cn(...xs)
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cx(
        'rounded-3xl border border-line bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function CardTitle({ children, extra, icon }: { children: ReactNode; extra?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        {icon && <span className="text-muted">{icon}</span>}
        {children}
      </h2>
      {extra}
    </div>
  )
}

/** Valor no estilo "R$ 5.304,28" com centavos pequenos. */
export function Money({
  value,
  className,
  tone,
}: {
  value: number
  className?: string
  tone?: 'good' | 'bad' | 'default'
}) {
  const [int, dec] = fmt(Math.abs(value)).split(',')
  const color = tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : 'text-ink'
  return (
    <span className={cx('inline-flex items-baseline whitespace-nowrap tracking-tight', className)}>
      <span className="mr-[0.25em] text-[0.55em] font-bold text-muted">{value < 0 ? '−R$' : 'R$'}</span>
      <span className={cx('font-extrabold', color)}>{int}</span>
      <span className="text-[0.45em] font-semibold text-muted">,{dec}</span>
    </span>
  )
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="text-xs font-medium text-muted">{children}</div>
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  disabled,
  type = 'button',
  className,
  title,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
  title?: string
}) {
  const styles = {
    primary: 'bg-primary text-white hover:brightness-110 shadow-sm',
    secondary: 'border border-line bg-card text-ink hover:bg-soft',
    ghost: 'text-muted hover:bg-soft hover:text-ink',
    danger: 'bg-bad text-white hover:brightness-110',
  }[variant]
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        styles,
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Bar({ value, max, color = 'var(--color-primary)', className }: { value: number; max: number; color?: string; className?: string }) {
  const w = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className={cx('h-2 overflow-hidden rounded-full bg-soft', className)}>
      <div className="h-full rounded-full transition-all" style={{ width: `${w}%`, background: color }} />
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl bg-soft px-4 py-6 text-center text-sm text-muted">{children}</div>
}

export const inputCls =
  'w-full rounded-xl border border-line bg-card px-3 py-2.5 text-base text-ink sm:text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20'

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-xs font-semibold text-muted">{label}</span>
      {children}
    </label>
  )
}
