import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { Cents } from '@/lib/money'

/**
 * Cálculo DERIVADO de investimentos — engine PURA.
 * Estima o valor atual pela soma do "valor futuro" de cada movimento
 * (aporte soma, resgate subtrai) capitalizado até hoje pela taxa efetiva.
 */

export interface RendimentoSpec {
  /** CDI_PERCENT | PREFIXADO | CDI_SPREAD | NENHUM */
  forma_rendimento: string
  /** significado depende da forma (%) */
  taxa: number
}

export interface MovimentoLike {
  /** 'aporte' | 'resgate' */
  tipo: string
  valor_centavos: number
  /** ISO 'YYYY-MM-DD' */
  data: string
}

/** Taxa efetiva anual (% a.a.) dado o índice CDI anual (% a.a.). */
export function annualRatePct(spec: RendimentoSpec, cdiAnual: number): number {
  const { forma_rendimento: forma, taxa } = spec
  switch (forma) {
    case 'CDI_PERCENT':
      return cdiAnual * (taxa / 100)
    case 'PREFIXADO':
      return taxa
    case 'CDI_SPREAD':
      return cdiAnual + taxa
    default:
      return 0
  }
}

export function totalAportado(movs: MovimentoLike[]): Cents {
  return movs.filter((m) => m.tipo === 'aporte').reduce((s, m) => s + m.valor_centavos, 0)
}

export function totalResgatado(movs: MovimentoLike[]): Cents {
  return movs.filter((m) => m.tipo === 'resgate').reduce((s, m) => s + m.valor_centavos, 0)
}

/** Principal líquido nominal (aportes − resgates), sem rendimento. */
export function investedPrincipal(movs: MovimentoLike[]): Cents {
  return totalAportado(movs) - totalResgatado(movs)
}

/**
 * Valor estimado hoje: Σ (± valor × (1 + r)^(dias/365)).
 * Aporte soma, resgate subtrai; movimentos futuros não capitalizam.
 * NENHUM → r=0, então o valor estimado = principal líquido.
 */
export function investmentValue(
  spec: RendimentoSpec,
  movs: MovimentoLike[],
  cdiAnual: number,
  today: string,
): Cents {
  const r = annualRatePct(spec, cdiAnual) / 100
  const hoje = parseISO(today)
  let total = 0
  for (const m of movs) {
    const dias = Math.max(0, differenceInCalendarDays(hoje, parseISO(m.data)))
    const fator = r === 0 ? 1 : Math.pow(1 + r, dias / 365)
    const sinal = m.tipo === 'resgate' ? -1 : 1
    total += sinal * m.valor_centavos * fator
  }
  return Math.round(total)
}

/** Rendimento estimado = valor atual − principal líquido. */
export function investmentReturn(
  spec: RendimentoSpec,
  movs: MovimentoLike[],
  cdiAnual: number,
  today: string,
): Cents {
  return investmentValue(spec, movs, cdiAnual, today) - investedPrincipal(movs)
}
