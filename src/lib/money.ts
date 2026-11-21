/**
 * Dinheiro é SEMPRE representado internamente em centavos (inteiros)
 * para evitar erros de ponto flutuante. A conversão para reais só acontece
 * na borda (input do usuário / formatação de exibição).
 */
export type Cents = number

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const brlCompact = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** Reais (número/decimal) -> centavos (inteiro). Ex.: 12.34 -> 1234 */
export function toCents(reais: number): Cents {
  return Math.round(reais * 100)
}

/** Centavos -> reais (decimal). Ex.: 1234 -> 12.34 */
export function toReais(cents: Cents): number {
  return cents / 100
}

/** Formata centavos como "R$ 1.234,56" */
export function formatBRL(cents: Cents): string {
  return brl.format(cents / 100)
}

/** Formata centavos de forma compacta: "R$ 1,2 mil" (para cards apertados) */
export function formatBRLCompact(cents: Cents): string {
  return brlCompact.format(cents / 100)
}

/** Soma segura de uma lista de centavos */
export function sumCents(values: Cents[]): Cents {
  return values.reduce((acc, v) => acc + v, 0)
}

/**
 * Converte uma string digitada pelo usuário (pt-BR) para centavos.
 * Aceita "1.234,56", "1234,56", "1234.56", "R$ 1.234,56".
 */
export function parseBRLToCents(input: string): Cents {
  const cleaned = input
    .replace(/[^\d.,-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const value = Number(cleaned)
  return Number.isFinite(value) ? Math.round(value * 100) : 0
}
