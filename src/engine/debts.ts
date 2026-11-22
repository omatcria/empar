import { addMonths, format, lastDayOfMonth, parseISO } from 'date-fns'
import type { Cents } from '@/lib/money'
import type { Debt, DebtInstallment } from '@/domain/types'
import { splitCents } from './invoices'

export type DebtStatus = 'quitada' | 'em_dia' | 'atrasada' | 'sem_parcelas'

/** Total efetivo da dívida: o acordo quando existe, senão o valor original. */
export function debtTotal(d: Pick<Debt, 'valor_acordo_centavos' | 'valor_original_centavos'>): Cents {
  return d.valor_acordo_centavos ?? d.valor_original_centavos ?? 0
}

/** Divide o total em n parcelas mensais; cada vencimento usa o dia original limitado ao fim do mês. */
export function buildDebtInstallments(
  total: Cents,
  n: number,
  primeiroVencimento: string,
): { numero: number; valor_centavos: Cents; vencimento: string }[] {
  assertParcelas(n)
  const base = parseISO(primeiroVencimento)
  const dia = base.getDate()
  return splitCents(total, n).map((valor, i) => {
    const alvo = addMonths(new Date(base.getFullYear(), base.getMonth(), 1), i)
    const ultimo = lastDayOfMonth(alvo).getDate()
    const d = new Date(alvo.getFullYear(), alvo.getMonth(), Math.min(dia, ultimo))
    return { numero: i + 1, valor_centavos: valor, vencimento: format(d, 'yyyy-MM-dd') }
  })
}

export function debtSummary(debt: Debt, parcelas: DebtInstallment[], todayISO: string) {
  const pagasList = parcelas.filter((p) => p.pago)
  const abertas = parcelas.filter((p) => !p.pago)
  const pago = pagasList.reduce((s, p) => s + p.valor_centavos, 0)
  const total = debtTotal(debt)
  const proxima =
    [...abertas].sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0] ?? null
  const atrasadas = abertas.filter((p) => p.vencimento < todayISO).length
  const status: DebtStatus =
    parcelas.length === 0
      ? 'sem_parcelas'
      : abertas.length === 0
        ? 'quitada'
        : atrasadas > 0
          ? 'atrasada'
          : 'em_dia'
  return {
    total,
    pago,
    restante: parcelas.length > 0 ? abertas.reduce((s, p) => s + p.valor_centavos, 0) : total - pago,
    pagas: pagasList.length,
    totalParcelas: parcelas.length,
    proxima,
    atrasadas,
    status,
  }
}

export function debtsTotals(debts: Debt[], parcelas: DebtInstallment[]) {
  const ids = new Set(debts.map((d) => d.id))
  const totalAcordos = debts.reduce((s, d) => s + debtTotal(d), 0)
  const pago = parcelas
    .filter((p) => ids.has(p.debt_id) && p.pago)
    .reduce((s, p) => s + p.valor_centavos, 0)
  const economia = debts.reduce(
    (s, d) =>
      d.valor_original_centavos == null || d.valor_acordo_centavos == null
        ? s
        : s + (d.valor_original_centavos - d.valor_acordo_centavos),
    0,
  )
  return { totalAcordos, pago, restante: totalAcordos - pago, economia }
}

/** Valida o número de parcelas antes de qualquer chamada ao banco. */
export function assertParcelas(n: number): void {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error('Informe ao menos 1 parcela.')
  }
}
