import { addMonths, format, parse } from 'date-fns'
import type {
  Category,
  Recurrence,
  Transaction,
  ViewMode,
} from '@/domain/types'
import { sumCents, type Cents } from '@/lib/money'
import { isInMonth, type MesRef } from './period'
import {
  consolidatedExpense,
  consolidatedIncome,
  contextExpense,
  contextIncome,
} from './balances'
import type { RecurrenceTemplate } from './recurrences'

/** Lista de N meses terminando em `mesRef` (inclusive). */
export function lastMonths(mesRef: MesRef, n: number): MesRef[] {
  const base = parse(mesRef + '-01', 'yyyy-MM-dd', new Date())
  const arr: MesRef[] = []
  for (let i = n - 1; i >= 0; i--) arr.push(format(addMonths(base, -i), 'yyyy-MM'))
  return arr
}

/** Próximos N meses após `mesRef`. */
export function nextMonths(mesRef: MesRef, n: number): MesRef[] {
  const base = parse(mesRef + '-01', 'yyyy-MM-dd', new Date())
  const arr: MesRef[] = []
  for (let i = 1; i <= n; i++) arr.push(format(addMonths(base, i), 'yyyy-MM'))
  return arr
}

/** Receita segundo o modo de visão (consolidado exclui transferências). */
export function receitaView(txs: Transaction[], view: ViewMode, mes: MesRef): Cents {
  return view === 'CONSOLIDADO'
    ? consolidatedIncome(txs, mes)
    : contextIncome(view, txs, mes)
}

export function despesaView(txs: Transaction[], view: ViewMode, mes: MesRef): Cents {
  return view === 'CONSOLIDADO'
    ? consolidatedExpense(txs, mes)
    : contextExpense(view, txs, mes)
}

export interface FluxoMes {
  mes: MesRef
  receita: Cents
  despesa: Cents
  resultado: Cents
}

/** Receitas × despesas × resultado por mês. */
export function fluxoMensal(
  txs: Transaction[],
  view: ViewMode,
  meses: MesRef[],
): FluxoMes[] {
  return meses.map((mes) => {
    const receita = receitaView(txs, view, mes)
    const despesa = despesaView(txs, view, mes)
    return { mes, receita, despesa, resultado: receita - despesa }
  })
}

export interface DRE {
  receita: Cents
  custos: Cents
  impostos: Cents
  proLabore: Cents
  distribuicao: Cents
  resultado: Cents
}

/** DRE simplificada do lado empresarial para um mês. */
export function dreEmpresarial(
  txs: Transaction[],
  categories: Category[],
  mes: MesRef,
): DRE {
  const receita = contextIncome('EMPRESARIAL', txs, mes)
  const impostosCat = new Set(
    categories.filter((c) => c.chave === 'IMPOSTOS').map((c) => c.id),
  )
  const desp = txs.filter(
    (t) =>
      t.contexto === 'EMPRESARIAL' && t.tipo === 'DESPESA' && isInMonth(t.data, mes),
  )
  const impostos = sumCents(
    desp.filter((t) => impostosCat.has(t.category_id)).map((t) => t.valor_centavos),
  )
  const proLabore = sumCents(
    desp.filter((t) => t.transfer_kind === 'PRO_LABORE').map((t) => t.valor_centavos),
  )
  const distribuicao = sumCents(
    desp
      .filter((t) => t.transfer_kind === 'DISTRIBUICAO_LUCROS')
      .map((t) => t.valor_centavos),
  )
  const custos = sumCents(
    desp
      .filter((t) => !impostosCat.has(t.category_id) && !t.transfer_id)
      .map((t) => t.valor_centavos),
  )
  return {
    receita,
    custos,
    impostos,
    proLabore,
    distribuicao,
    resultado: receita - custos - impostos - proLabore - distribuicao,
  }
}

export interface ProjMes {
  mes: MesRef
  saldo: Cents
}

/**
 * Projeção simples do saldo: parte do saldo atual e soma, a cada mês, o efeito
 * líquido das recorrências MENSAIS ativas do contexto. É uma estimativa.
 */
export function projecaoSaldo(
  saldoAtual: Cents,
  recurrences: Recurrence[],
  view: ViewMode,
  meses: MesRef[],
): ProjMes[] {
  const net = recurrences
    .filter(
      (r) =>
        r.ativo &&
        r.frequencia === 'mensal' &&
        (view === 'CONSOLIDADO' || r.contexto === view),
    )
    .reduce((s, r) => {
      const t = r.template as unknown as RecurrenceTemplate
      return s + (t.tipo === 'RECEITA' ? t.valor_centavos : -t.valor_centavos)
    }, 0)

  let running = saldoAtual
  return meses.map((mes) => {
    running += net
    return { mes, saldo: running }
  })
}
