import type { Account, Card, Context, Invoice, Transaction } from '@/domain/types'
import { sumCents, type Cents } from '@/lib/money'
import type { MesRef } from './period'
import { accountsBalance, isRealized } from './balances'
import { invoiceTotal } from './invoices'

export type ForecastScope = Context | 'CONSOLIDADO'

export interface ForecastInput {
  accounts: Account[]
  cards: Card[]
  invoices: Invoice[]
  transactions: Transaction[]
}

/** Horizonte da previsão: o maior entre o último dia do mês e hoje. */
export function forecastHorizon(mes: MesRef, hoje: string): string {
  const [y, m] = mes.split('-').map(Number)
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate()
  const fim = `${mes}-${String(last).padStart(2, '0')}`
  return fim > hoje ? fim : hoje
}

/**
 * Saldo PREVISTO no horizonte: saldo realizado (até hoje) das contas não
 * arquivadas do escopo + receitas/despesas em conta ainda não realizadas
 * (inclui atrasadas) − faturas em aberto vencendo até o horizonte.
 * Transações de cartão só entram via fatura.
 */
export function forecastBalance(
  scope: ForecastScope,
  inp: ForecastInput,
  mes: MesRef,
  hoje: string,
): Cents {
  const horizonte = forecastHorizon(mes, hoje)
  const inScope = (c: Context) => scope === 'CONSOLIDADO' || c === scope
  const accounts = inp.accounts.filter((a) => !a.arquivada && inScope(a.contexto))
  const ids = new Set(accounts.map((a) => a.id))

  const realizado = accountsBalance(accounts, inp.transactions, {
    cards: inp.cards,
    invoices: inp.invoices,
    asOf: hoje,
  })

  const pendente = sumCents(
    inp.transactions
      .filter(
        (t) =>
          t.account_id != null &&
          ids.has(t.account_id) &&
          !isRealized(t, hoje) &&
          t.data <= horizonte,
      )
      .map((t) => (t.tipo === 'RECEITA' ? t.valor_centavos : -t.valor_centavos)),
  )

  const cardCtx = new Map(inp.cards.map((c) => [c.id, c.contexto]))
  const faturas = sumCents(
    inp.invoices
      .filter((inv) => {
        if (inv.paga || inv.data_vencimento > horizonte) return false
        const ctx = cardCtx.get(inv.card_id)
        return ctx != null && inScope(ctx)
      })
      .map((inv) => invoiceTotal(inv, inp.transactions)),
  )

  return realizado + pendente - faturas
}
