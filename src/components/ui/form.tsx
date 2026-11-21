import { useEffect, useState } from 'react'
import type {
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/cn'
import { formatBRL, parseBRLToCents, type Cents } from '@/lib/money'

/** Base visual dos campos (inputs, gatilho do Select, textarea). */
export const controlBase =
  'w-full h-11 rounded-xl border border-app-border bg-app-surface-2 px-3 text-sm text-app-fg ' +
  'placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-pessoal focus:border-transparent ' +
  'disabled:opacity-50 transition-shadow'

/* ---------------- Field wrapper ---------------- */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label?: string
  htmlFor?: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-xs font-medium text-app-fg2">
          {label}
          {required && <span className="ml-0.5 text-expense">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-expense">{error}</p>
      ) : hint ? (
        <p className="text-xs text-app-muted">{hint}</p>
      ) : null}
    </div>
  )
}

/* ---------------- TextInput ---------------- */
export function TextInput({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlBase, className)} {...rest} />
}

/* ---------------- Select ---------------- */
// Listbox próprio (portal, busca, teclado) — mesma API do <select> nativo.
export { Select } from './Select'
export type { SelectProps, SelectChangeEvent } from './Select'

/* ---------------- Textarea ---------------- */
export function Textarea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(controlBase, 'h-auto min-h-20 py-2 resize-none', className)}
      {...rest}
    />
  )
}

/* ---------------- MoneyInput ---------------- */
export function MoneyInput({
  cents,
  onChangeCents,
  id,
  placeholder = 'R$ 0,00',
  className,
  autoFocus,
  disabled,
}: {
  cents: Cents
  onChangeCents: (c: Cents) => void
  id?: string
  placeholder?: string
  className?: string
  autoFocus?: boolean
  disabled?: boolean
}) {
  // Inicializa a partir de `cents` só na montagem — o campo é a fonte da
  // verdade durante a digitação. Reformatar a cada tecla (via effect ligado
  // a `cents`) brigaria com o cursor, apagando o que o usuário acabou de
  // digitar antes de ele terminar.
  const [text, setText] = useState(cents ? formatBRL(cents) : '')

  // Sincroniza quando `cents` muda POR FORA (ex.: reset do formulário ao
  // abrir o modal, ou preenchimento ao editar). Comparamos por VALOR: se o
  // que está digitado já corresponde a `cents`, é o próprio eco da digitação
  // e não reformatamos (não briga com o cursor).
  useEffect(() => {
    if (parseBRLToCents(text) !== cents) {
      setText(cents ? formatBRL(cents) : '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cents])

  return (
    <input
      id={id}
      inputMode="decimal"
      autoFocus={autoFocus}
      disabled={disabled}
      className={cn(controlBase, 'tnum text-right text-base font-semibold', className)}
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        onChangeCents(parseBRLToCents(e.target.value))
      }}
      onBlur={() => setText(cents ? formatBRL(cents) : '')}
    />
  )
}
