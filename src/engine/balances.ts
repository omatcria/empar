import type { Account, Card, Context, Invoice, Transaction } from '@/domain/types'
import { sumCents, type Cents } from '@/lib/money'
import { isInMonth, type MesRef } from './period'
import { invoiceTotal } from './invoices'

/** Valor com sinal: RECEITA soma, DESPESA subtrai. */
function signed(t: Transaction): Cents {
  return t.tipo === 'RECEITA' ? t.valor_centavos : -t.valor_centavos
}

/** Transação realizada: paga e com data até `asOf` (inclusive). */
export function isRealized(t: Transaction, asOf: string): boolean {
  return t.pago && t.data <= asOf
}

export interface BalanceContext {
  cards?: Card[]
  invoices?: Invoice[]
  /** Se informado, só conta transações realizadas até esta data (YYYY-MM-DD). */
  asOf?: string
}

/**
 * Saldo REALIZADO (caixa) de uma conta:
 *   saldo_inicial
 *   + Σ transações PAGAS na conta (receita/despesa)
 *   − Σ faturas PAGAS dos cartões que debitam nesta conta
 *
 * Compras no crédito NÃO afetam o saldo aqui; só quando a fatura é paga.
 */
export function accountBalance(
  account: Account,
  txs: Transaction[],
  ctx: BalanceContext = {},
): Cents {
  let bal = account.saldo_inicial_centavos
  bal += sumCents(
    txs
      .filter(
        (t) =>
          t.account_id === account.id &&
          (ctx.asOf ? isRealized(t, ctx.asOf) : t.pago),
      )
      .map(signed),
  )

  if (ctx.cards && ctx.invoices) {
    const cardPayAcct = new Map(ctx.cards.map((c) => [c.id, c.account_pagamento_id]))
    // Fatura paga sai de `paid_account_id` (conta escolhida ao pagar) ou,
    // se ausente, da conta padrão do cartão.
    const pagas = ctx.invoices.filter((inv) => {
      if (!inv.paga) return false
      const conta = inv.paid_account_id ?? cardPayAcct.get(inv.card_id) ?? null
      return conta === account.id
    })
    bal -= sumCents(pagas.map((inv) => invoiceTotal(inv, txs)))
  }

  return bal
}

/** Saldo somado de um conjunto de contas. */
export function accountsBalance(
  accounts: Account[],
  txs: Transaction[],
  ctx: BalanceContext = {},
): Cents {
  return sumCents(accounts.map((a) => accountBalance(a, txs, ctx)))
}

/** Saldo total de um contexto (contas não arquivadas). */
export function contextBalance(
  context: Context,
  accounts: Account[],
  txs: Transaction[],
  ctx: BalanceContext = {},
): Cents {
  return accountsBalance(
    accounts.filter((a) => a.contexto === context && !a.arquivada),
    txs,
    ctx,
  )
}

/* ============================================================
   Fluxos mensais (regime de COMPETÊNCIA — conta tudo do mês,
   independente de `pago`; pago só importa para caixa/saldo).
   ============================================================ */

function sumWhere(txs: Transaction[], pred: (t: Transaction) => boolean): Cents {
  return sumCents(txs.filter(pred).map((t) => t.valor_centavos))
}

/** Receita de um contexto no mês (inclui pró-labore recebido no lado pessoal). */
export function contextIncome(
  context: Context,
  txs: Transaction[],
  mes?: MesRef,
): Cents {
  return sumWhere(
    txs,
    (t) =>
      t.contexto === context &&
      t.tipo === 'RECEITA' &&
      (!mes || isInMonth(t.data, mes)),
  )
}

/** Despesa de um contexto no mês (inclui compras no crédito por competência). */
export function contextExpense(
  context: Context,
  txs: Transaction[],
  mes?: MesRef,
): Cents {
  return sumWhere(
    txs,
    (t) =>
      t.contexto === context &&
      t.tipo === 'DESPESA' &&
      (!mes || isInMonth(t.data, mes)),
  )
}

/** Gasto de uma categoria no mês (para orçamentos/limites). */
export function categorySpend(
  categoryId: string,
  txs: Transaction[],
  mes?: MesRef,
): Cents {
  return sumWhere(
    txs,
    (t) =>
      t.category_id === categoryId &&
      t.tipo === 'DESPESA' &&
      (!mes || isInMonth(t.data, mes)),
  )
}

/** Despesas por categoria de um contexto no mês (para gráfico de pizza). */
export function expenseByCategory(
  context: Context,
  txs: Transaction[],
  mes?: MesRef,
): Map<string, Cents> {
  const map = new Map<string, Cents>()
  for (const t of txs) {
    if (t.contexto !== context || t.tipo !== 'DESPESA') continue
    if (mes && !isInMonth(t.data, mes)) continue
    map.set(t.category_id, (map.get(t.category_id) ?? 0) + t.valor_centavos)
  }
  return map
}

/* ============================================================
   Visão CONSOLIDADA — exclui as pernas de transferência
   (pró-labore / distribuição), que são dinheiro no mesmo bolso.
   ============================================================ */

/** É perna de uma transferência interna (pró-labore/distribuição/transfer)? */
export function isTransferLeg(t: Transaction): boolean {
  return t.transfer_id != null
}

/** Receita consolidada real (salário CLT + receita PJ), sem transferências. */
export function consolidatedIncome(txs: Transaction[], mes?: MesRef): Cents {
  return sumWhere(
    txs,
    (t) =>
      t.tipo === 'RECEITA' &&
      !isTransferLeg(t) &&
      (!mes || isInMonth(t.data, mes)),
  )
}

/** Despesa consolidada real, sem transferências. */
export function consolidatedExpense(txs: Transaction[], mes?: MesRef): Cents {
  return sumWhere(
    txs,
    (t) =>
      t.tipo === 'DESPESA' &&
      !isTransferLeg(t) &&
      (!mes || isInMonth(t.data, mes)),
  )
}
