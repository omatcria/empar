import type { TaxProvision, Transaction } from '@/domain/types'
import { sumCents, type Cents } from '@/lib/money'

export interface ProvisionContribution {
  id: string
  nome: string
  contributionCentavos: Cents
}

/**
 * Ao registrar uma receita PJ, quanto reservar em cada envelope ativo.
 * O dinheiro continua na conta; a provisão é uma etiqueta lógica.
 */
export function provisionContributions(
  receitaCentavos: Cents,
  provisions: TaxProvision[],
): ProvisionContribution[] {
  return provisions
    .filter((p) => p.ativo)
    .map((p) => ({
      id: p.id,
      nome: p.nome,
      contributionCentavos: Math.round(
        (receitaCentavos * Number(p.percentual)) / 100,
      ),
    }))
}

/** Total a reservar de uma receita, somando todos os envelopes ativos. */
export function totalProvisionContribution(
  receitaCentavos: Cents,
  provisions: TaxProvision[],
): Cents {
  return sumCents(
    provisionContributions(receitaCentavos, provisions).map(
      (c) => c.contributionCentavos,
    ),
  )
}

/** Total já provisionado (guardado) — soma dos saldos armazenados (legado). */
export function totalProvisionado(provisions: TaxProvision[]): Cents {
  return sumCents(
    provisions.filter((p) => p.ativo).map((p) => p.saldo_provisionado_centavos),
  )
}

/* ============================================================
   Provisão DERIVADA (fonte única da verdade, sem drift):
   provisionado = (receitas PJ × Σ% ativos) − impostos já pagos.
   ============================================================ */

/** Soma de todas as receitas PJ (base para provisionar). */
export function receitasPJTotais(transactions: Transaction[]): Cents {
  return sumCents(
    transactions
      .filter((t) => t.contexto === 'EMPRESARIAL' && t.tipo === 'RECEITA')
      .map((t) => t.valor_centavos),
  )
}

/** Quanto deveria estar reservado no total (antes de descontar impostos pagos). */
export function provisaoDevida(
  transactions: Transaction[],
  provisions: TaxProvision[],
): Cents {
  const base = receitasPJTotais(transactions)
  const pct = provisions
    .filter((p) => p.ativo)
    .reduce((s, p) => s + Number(p.percentual), 0)
  return Math.round((base * pct) / 100)
}

/** Quanto por envelope ativo (para detalhamento). */
export function provisaoPorEnvelope(
  transactions: Transaction[],
  provisions: TaxProvision[],
): { id: string; nome: string; percentual: number; devidoCentavos: Cents }[] {
  const base = receitasPJTotais(transactions)
  return provisions
    .filter((p) => p.ativo)
    .map((p) => ({
      id: p.id,
      nome: p.nome,
      percentual: Number(p.percentual),
      devidoCentavos: Math.round((base * Number(p.percentual)) / 100),
    }))
}

/** Impostos já pagos (despesas EMPRESARIAL na categoria de sistema "Impostos"). */
export function impostosPagos(
  transactions: Transaction[],
  impostosCategoryIds: Set<string>,
): Cents {
  return sumCents(
    transactions
      .filter(
        (t) =>
          t.contexto === 'EMPRESARIAL' &&
          t.tipo === 'DESPESA' &&
          impostosCategoryIds.has(t.category_id),
      )
      .map((t) => t.valor_centavos),
  )
}

/** Provisionado atual = devido − pago (nunca negativo). */
export function provisionadoAtual(
  transactions: Transaction[],
  provisions: TaxProvision[],
  impostosCategoryIds: Set<string>,
): Cents {
  return Math.max(
    0,
    provisaoDevida(transactions, provisions) -
      impostosPagos(transactions, impostosCategoryIds),
  )
}
