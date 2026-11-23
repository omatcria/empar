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

export function cycleFromClosing(
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
