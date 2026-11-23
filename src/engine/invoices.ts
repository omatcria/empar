import type { Invoice, Transaction } from '@/domain/types'
import { sumCents, type Cents } from '@/lib/money'

import { resolveInvoiceCycle, cycleFromClosing, type InvoiceCycle } from '../../supabase/functions/_shared/invoice-cycle'
export { resolveInvoiceCycle, cycleFromClosing, type InvoiceCycle } from '../../supabase/functions/_shared/invoice-cycle'

/**
 * Divide um total em N parcelas inteiras (centavos) cuja soma é EXATAMENTE o total.
 * O resto é distribuído nas primeiras parcelas. Ex.: 1000 em 3 -> [334, 333, 333].
 */
export function splitCents(total: Cents, n: number): Cents[] {
  if (n <= 0) return []
  const base = Math.floor(total / n)
  const resto = total - base * n
  return Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0))
}

export interface InstallmentPlanItem extends InvoiceCycle {
  valorCentavos: Cents
  parcelaN: number
  parcelaTotal: number
}

/**
 * Gera o plano de parcelas de uma compra no crédito:
 * a 1ª parcela na fatura da compra e as seguintes nas faturas subsequentes.
 */
export function buildInstallmentPlan(
  diaFechamento: number,
  diaVencimento: number,
  purchaseISO: string,
  totalCentavos: Cents,
  n: number,
): InstallmentPlanItem[] {
  const amounts = splitCents(totalCentavos, n)
  const first = resolveInvoiceCycle(diaFechamento, diaVencimento, purchaseISO)
  const [firstY, firstM] = first.mesReferencia.split('-').map(Number)

  return amounts.map((valor, i) => {
    let currentY = firstY
    let currentM = firstM + i
    while (currentM > 12) {
      currentM -= 12
      currentY++
    }
    const cycle = cycleFromClosing(currentY, currentM, diaFechamento, diaVencimento)
    return {
      ...cycle,
      valorCentavos: valor,
      parcelaN: i + 1,
      parcelaTotal: n,
    }
  })
}

/** Total de uma fatura = soma das transações vinculadas a ela (todas despesas). */
export function invoiceTotal(invoice: Invoice, txs: Transaction[]): Cents {
  return sumCents(
    txs.filter((t) => t.invoice_id === invoice.id).map((t) => t.valor_centavos),
  )
}

/** Soma das faturas ainda não pagas (crédito em aberto). */
export function faturasAbertasTotal(invoices: Invoice[], txs: Transaction[]): Cents {
  return sumCents(
    invoices.filter((inv) => !inv.paga).map((inv) => invoiceTotal(inv, txs)),
  )
}
