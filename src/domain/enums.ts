import type {
  AccountType,
  CardKind,
  Context,
  RecurrenceFreq,
  TxType,
  ViewMode,
} from './types'

/* ---------- Rótulos (pt-BR) ---------- */

export const CONTEXT_LABEL: Record<Context, string> = {
  PESSOAL: 'Pessoal',
  EMPRESARIAL: 'Empresarial',
}

export const VIEW_MODE_LABEL: Record<ViewMode, string> = {
  PESSOAL: 'Pessoal',
  EMPRESARIAL: 'Empresarial',
  CONSOLIDADO: 'Consolidado',
}

export const VIEW_MODES: ViewMode[] = ['PESSOAL', 'EMPRESARIAL', 'CONSOLIDADO']

export const TX_TYPE_LABEL: Record<TxType, string> = {
  RECEITA: 'Receita',
  DESPESA: 'Despesa',
}

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  conta_corrente: 'Conta corrente',
  conta_digital: 'Conta digital',
  conta_pj: 'Conta PJ',
  poupanca: 'Poupança',
  dinheiro: 'Dinheiro',
  investimento: 'Investimento',
}

export const CARD_KIND_LABEL: Record<CardKind, string> = {
  credito: 'Crédito',
  debito: 'Débito',
  credito_debito: 'Crédito e débito',
}

export const RECURRENCE_FREQ_LABEL: Record<RecurrenceFreq, string> = {
  mensal: 'Mensal',
  semanal: 'Semanal',
  anual: 'Anual',
}

/* ---------- Helpers de estilo por contexto (classes Tailwind) ---------- */

/** Badge de contexto: fundo suave + texto do acento. */
export function contextBadgeClass(c: Context): string {
  return c === 'PESSOAL'
    ? 'bg-pessoal-soft text-pessoal-strong'
    : 'bg-empresarial-soft text-empresarial-strong'
}

/** Texto no acento do contexto. */
export function contextTextClass(c: Context): string {
  return c === 'PESSOAL' ? 'text-pessoal' : 'text-empresarial'
}

/** Borda no acento do contexto. */
export function contextBorderClass(c: Context): string {
  return c === 'PESSOAL' ? 'border-pessoal' : 'border-empresarial'
}

/** Cor (CSS var) do contexto — para gráficos/inline styles. */
export function contextColorVar(c: Context): string {
  return c === 'PESSOAL' ? 'var(--color-pessoal)' : 'var(--color-empresarial)'
}

/** Classe de cor para valores monetários por tipo de lançamento. */
export function amountClass(tipo: TxType): string {
  return tipo === 'RECEITA' ? 'text-income' : 'text-expense'
}
