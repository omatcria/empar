import type { Invoice, Transaction } from '@/domain/types'
import { sumCents, type Cents } from '@/lib/money'

export interface InvoiceCycle {
  mesReferencia: string // 'YYYY-MM'
  dataFechamento: string // 'YYYY-MM-DD'
  dataVencimento: string // 'YYYY-MM-DD'
}

/**
 * Descobre a fatura (ciclo) de uma compra no crédito.
 * Regra: a compra entra na fatura que FECHA depois (ou no dia) da compra.
 * O vencimento cai no dia configurado; se <= dia de fechamento, rola para o mês seguinte.
 */
export function resolveInvoiceCycle(
  diaFechamento: number,
  diaVencimento: number,
  purchaseISO: string,
): InvoiceCycle {
  const [y, m, d] = purchaseISO.split('-').map(Number)
  let closingY = y
  let closingM = m

  if (d > diaFechamento) {
    closingM++
    if (closingM > 12) {
      closingM = 1
      closingY++
    }
  }
  return cycleFromClosing(closingY, closingM, diaFechamento, diaVencimento)
}

function cycleFromClosing(
  closingY: number,
  closingM: number,
  diaFechamento: number,
  diaVencimento: number,
): InvoiceCycle {
  let vencY = closingY
  let vencM = closingM
  if (diaVencimento <= diaFechamento) {
    vencM++
    if (vencM > 12) {
      vencM = 1
      vencY++
    }
  }
  
  const pad = (n: number) => String(n).padStart(2, '0')
  const maxClosingDays = new Date(closingY, closingM, 0).getDate()
  const cDay = Math.min(diaFechamento, maxClosingDays)
  
  const maxVencDays = new Date(vencY, vencM, 0).getDate()
  const vDay = Math.min(diaVencimento, maxVencDays)

  return {
    mesReferencia: `${closingY}-${pad(closingM)}`,
    dataFechamento: `${closingY}-${pad(closingM)}-${pad(cDay)}`,
    dataVencimento: `${vencY}-${pad(vencM)}-${pad(vDay)}`,
  }
}

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
