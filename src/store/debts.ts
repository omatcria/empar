import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Debt, DebtInstallment } from '@/domain/types'

interface DebtsState {
  debts: Debt[]
  installments: DebtInstallment[]
  loaded: boolean
  load: (workspaceId: string) => Promise<void>
  reset: () => void
}

export const useDebts = create<DebtsState>((set) => ({
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
}))
