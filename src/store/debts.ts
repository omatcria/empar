import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type {
  Debt,
  DebtInsert,
  DebtUpdate,
  DebtInstallment,
  DebtInstallmentUpdate,
} from '@/domain/types'
import { buildDebtInstallments } from '@/engine/debts'
import { ownerCols } from './owner'

type AddDebtInput = Omit<DebtInsert, 'user_id' | 'workspace_id'> & {
  parcelas: number
  primeiro_vencimento: string
}

interface DebtsState {
  debts: Debt[]
  installments: DebtInstallment[]
  loaded: boolean
  load: (workspaceId: string) => Promise<void>
  reset: () => void
  addDebt: (input: AddDebtInput) => Promise<Debt>
  updateDebt: (id: string, patch: DebtUpdate) => Promise<void>
  deleteDebt: (id: string) => Promise<void>
  setInstallmentPaid: (id: string, pago: boolean, pagoEm?: string) => Promise<void>
  updateInstallment: (id: string, patch: DebtInstallmentUpdate) => Promise<void>
  regenerateUnpaid: (debtId: string, n: number, primeiroVencimento: string) => Promise<void>
  payAll: (debtId: string) => Promise<void>
}

const todayISO = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const useDebts = create<DebtsState>((set, get) => ({
  debts: [],
  installments: [],
  loaded: false,

  load: async (workspaceId) => {
    const [debts, installments] = await Promise.all([
      supabase.from('debts').select('*').eq('workspace_id', workspaceId),
      supabase.from('debt_installments').select('*').eq('workspace_id', workspaceId),
    ])
    const err = debts.error || installments.error
    if (err) {
      console.error('Falha ao carregar dívidas:', err.message)
      throw new Error(err.message)
    }
    set({
      debts: (debts.data ?? []) as Debt[],
      installments: (installments.data ?? []) as DebtInstallment[],
      loaded: true,
    })
  },

  reset: () => set({ debts: [], installments: [], loaded: false }),

  addDebt: async (input) => {
    const { parcelas, primeiro_vencimento, ...debtInput } = input
    const owner = ownerCols()
    const { data: debt, error } = await supabase
      .from('debts')
      .insert({ ...debtInput, ...owner })
      .select()
      .single()
    if (error) throw error
    const rows = buildDebtInstallments(debt.valor_acordo_centavos, parcelas, primeiro_vencimento).map(
      (p) => ({ ...p, debt_id: debt.id, pago: false, ...owner }),
    )
    const { data: created, error: instErr } = await supabase
      .from('debt_installments')
      .insert(rows)
      .select()
    if (instErr) {
      await supabase.from('debts').delete().eq('id', debt.id)
      throw instErr
    }
    set((s) => ({
      debts: [...s.debts, debt],
      installments: [...s.installments, ...(created ?? [])],
    }))
    return debt
  },

  updateDebt: async (id, patch) => {
    const { data, error } = await supabase.from('debts').update(patch).eq('id', id).select().single()
    if (error) throw error
    set((s) => ({ debts: s.debts.map((d) => (d.id === id ? data : d)) }))
  },

  deleteDebt: async (id) => {
    const { error } = await supabase.from('debts').delete().eq('id', id)
    if (error) throw error
    set((s) => ({
      debts: s.debts.filter((d) => d.id !== id),
      installments: s.installments.filter((i) => i.debt_id !== id),
    }))
  },

  updateInstallment: async (id, patch) => {
    const { data, error } = await supabase
      .from('debt_installments')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    set((s) => ({ installments: s.installments.map((i) => (i.id === id ? data : i)) }))
  },

  setInstallmentPaid: async (id, pago, pagoEm) => {
    await get().updateInstallment(id, {
      pago,
      pago_em: pago ? (pagoEm ?? todayISO()) : null,
    })
  },

  regenerateUnpaid: async (debtId, n, primeiroVencimento) => {
    const debt = get().debts.find((d) => d.id === debtId)
    if (!debt) throw new Error('Dívida não encontrada')
    const paid = get().installments.filter((i) => i.debt_id === debtId && i.pago)
    const pagoTotal = paid.reduce((s, i) => s + i.valor_centavos, 0)
    const restante = Math.max(0, debt.valor_acordo_centavos - pagoTotal)
    const maxNumero = paid.reduce((m, i) => Math.max(m, i.numero), 0)

    const { error: delErr } = await supabase
      .from('debt_installments')
      .delete()
      .eq('debt_id', debtId)
      .eq('pago', false)
    if (delErr) throw delErr

    const owner = ownerCols()
    const rows = buildDebtInstallments(restante, n, primeiroVencimento).map((p) => ({
      ...p,
      numero: p.numero + maxNumero,
      debt_id: debtId,
      pago: false,
      ...owner,
    }))
    const { data: created, error } = await supabase.from('debt_installments').insert(rows).select()
    if (error) throw error
    set((s) => ({
      installments: [
        ...s.installments.filter((i) => i.debt_id !== debtId || i.pago),
        ...(created ?? []),
      ],
    }))
  },

  payAll: async (debtId) => {
    const open = get().installments.filter((i) => i.debt_id === debtId && !i.pago)
    if (open.length === 0) return
    const { data, error } = await supabase
      .from('debt_installments')
      .update({ pago: true, pago_em: todayISO() })
      .eq('debt_id', debtId)
      .eq('pago', false)
      .select()
    if (error) throw error
    const byId = new Map((data ?? []).map((i) => [i.id, i]))
    set((s) => ({ installments: s.installments.map((i) => byId.get(i.id) ?? i) }))
  },
}))
