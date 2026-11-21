import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ViewMode } from '@/domain/types'
import { currentMesRef } from '@/engine/period'

type QuickAdd = 'tx' | 'prolabore' | 'rateio' | null

interface UIState {
  /** Seletor de contexto global: Pessoal | Empresarial | Consolidado. */
  viewMode: ViewMode
  /** Mês de referência ativo ('YYYY-MM'). */
  mes: string
  /** Modal de lançamento rápido aberto globalmente. */
  quickAdd: QuickAdd
  setViewMode: (v: ViewMode) => void
  setMes: (m: string) => void
  openQuickAdd: (q: Exclude<QuickAdd, null>) => void
  closeQuickAdd: () => void
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      viewMode: 'CONSOLIDADO',
      mes: currentMesRef(),
      quickAdd: null,
      setViewMode: (viewMode) => set({ viewMode }),
      setMes: (mes) => set({ mes }),
      openQuickAdd: (quickAdd) => set({ quickAdd }),
      closeQuickAdd: () => set({ quickAdd: null }),
    }),
    {
      name: 'financas-ui',
      partialize: (s) => ({ viewMode: s.viewMode, mes: s.mes }),
    },
  ),
)
