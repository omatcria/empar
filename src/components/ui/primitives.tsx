import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from 'react'
import { Loader2 } from '@/components/icons'
import { cn } from '@/lib/cn'

/* ---------------- Button ---------------- */
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

const variantClass: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-content hover:bg-primary-strong shadow-sm',
  secondary:
    'bg-app-surface text-app-fg border border-app-border hover:bg-app-surface-2',
  ghost: 'text-app-fg2 hover:bg-app-surface-2',
  danger: 'bg-expense text-white hover:brightness-110',
}

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-11 px-4 text-sm rounded-xl gap-2',
  lg: 'h-12 px-5 text-base rounded-xl gap-2',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pessoal focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg',
        'disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}

/* ---------------- Surface / Card ---------------- */
export function Surface({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-app-border bg-app-surface',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

/* ---------------- Badge ---------------- */
export function Badge({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ---------------- Spinner ---------------- */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-app-muted', className)} />
}

/* ---------------- ProgressBar ---------------- */
export function ProgressBar({
  value,
  max,
  className,
  colorClass = 'bg-pessoal',
}: {
  value: number
  max: number
  className?: string
  colorClass?: string
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-app-surface-2', className)}>
      <div
        className={cn('h-full rounded-full transition-all', colorClass)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
