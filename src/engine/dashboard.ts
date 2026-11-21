import type {
  Account,
  Card,
  Category,
  Invoice,
  TaxProvision,
  Transaction,
} from '@/domain/types'
import { sumCents, type Cents } from '@/lib/money'
import { isInMonth, type MesRef } from './period'
import {
  contextBalance,
  contextExpense,
  contextIncome,
} from './balances'
import { faturasAbertasTotal } from './invoices'
import { provisionadoAtual } from './taxes'

export interface DashboardInput {
  accounts: Account[]
  cards: Card[]
  invoices: Invoice[]
  transactions: Transaction[]
  provisions: TaxProvision[]
  categories: Category[]
  mes: MesRef
}

export interface DashboardData {
  /** Saldos (caixa) por universo e consolidado. */
  saldoPessoal: Cents
  saldoEmpresarial: Cents
  saldoConsolidado: Cents

  /** Empresa. */
  totalProvisionado: Cents
  proLaborePendenteMes: Cents
  /** Caixa disponível = saldo PJ − impostos provisionados − pró-labore pendente do mês. */
  caixaEmpresa: Cents

  /** Fluxos do mês. */
  receitaPessoalMes: Cents
  despesaPessoalMes: Cents
  vidaPessoalMes: Cents // salário + pró-labore − despesas pessoais
  receitaEmpresarialMes: Cents
  despesaEmpresarialMes: Cents

  /** Cartões. */
  faturasAbertas: Cents
}

/** Pró-labore ainda pendente (comprometido, não retirado) no mês. */
function proLaborePendente(txs: Transaction[], mes: MesRef): Cents {
  return sumCents(
    txs
      .filter(
        (t) =>
          t.contexto === 'EMPRESARIAL' &&
          t.transfer_kind === 'PRO_LABORE' &&
          t.tipo === 'DESPESA' &&
          !t.pago &&
          isInMonth(t.data, mes),
      )
      .map((t) => t.valor_centavos),
  )
}

/** Deriva todos os números do dashboard a partir do estado bruto. */
export function buildDashboard(inp: DashboardInput): DashboardData {
  const bctx = { cards: inp.cards, invoices: inp.invoices }

  const saldoPessoal = contextBalance('PESSOAL', inp.accounts, inp.transactions, bctx)
  const saldoEmpresarial = contextBalance('EMPRESARIAL', inp.accounts, inp.transactions, bctx)

  const impostosCatIds = new Set(
    inp.categories.filter((c) => c.chave === 'IMPOSTOS').map((c) => c.id),
  )
  const provisionado = provisionadoAtual(
    inp.transactions,
    inp.provisions,
    impostosCatIds,
  )
  const proLaboreMes = proLaborePendente(inp.transactions, inp.mes)
  const caixaEmpresa = saldoEmpresarial - provisionado - proLaboreMes

  const receitaPessoalMes = contextIncome('PESSOAL', inp.transactions, inp.mes)
  const despesaPessoalMes = contextExpense('PESSOAL', inp.transactions, inp.mes)
  const receitaEmpresarialMes = contextIncome('EMPRESARIAL', inp.transactions, inp.mes)
  const despesaEmpresarialMes = contextExpense('EMPRESARIAL', inp.transactions, inp.mes)

  return {
    saldoPessoal,
    saldoEmpresarial,
    saldoConsolidado: saldoPessoal + saldoEmpresarial,
    totalProvisionado: provisionado,
    proLaborePendenteMes: proLaboreMes,
    caixaEmpresa,
    receitaPessoalMes,
    despesaPessoalMes,
    vidaPessoalMes: receitaPessoalMes - despesaPessoalMes,
    receitaEmpresarialMes,
    despesaEmpresarialMes,
    faturasAbertas: faturasAbertasTotal(inp.invoices, inp.transactions),
  }
}
