import { cn } from '@/lib/cn'
import { formatBRL, type Cents } from '@/lib/money'
import type { TxType } from '@/domain/types'

interface MoneyProps {
  cents: Cents
  className?: string
  /** Colore por tipo (verde receita / vermelho despesa). */
  tipo?: TxType
  /** Colore automaticamente: positivo verde, negativo vermelho. */
  signed?: boolean
  /** Mostra sinal +/− explícito. */
  showSign?: boolean
}

/** Exibe um valor monetário (centavos) formatado em BRL, com números tabulares. */
export function Money({ cents, className, tipo, signed, showSign }: MoneyProps) {
  let colorClass = ''
  if (tipo) colorClass = tipo === 'RECEITA' ? 'text-income' : 'text-expense'
  else if (signed) colorClass = cents >= 0 ? 'text-income' : 'text-expense'

  const prefix = showSign ? (cents > 0 ? '+' : cents < 0 ? '−' : '') : ''
  const shown = showSign ? formatBRL(Math.abs(cents)) : formatBRL(cents)

  return (
    <span className={cn('tnum tabular-nums', colorClass, className)}>
      {prefix}
      {shown}
    </span>
  )
}
