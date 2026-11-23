import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ViewMode } from '@/domain/types'
import { currentMesRef } from '@/engine/period'
import type { QuickAddPreset } from '@/lib/quick-link'

type QuickAdd = 'tx' | 'prolabore' | 'rateio' | null

interface UIState {
  /** Seletor de contexto global: Pessoal | Empresarial | Consolidado. */
  viewMode: ViewMode
  /** Mês de referência ativo ('YYYY-MM'). */
  mes: string
  /** Modal de lançamento rápido aberto globalmente. */
  quickAdd: QuickAdd
  quickAddPreset: QuickAddPreset | null
  setViewMode: (v: ViewMode) => void
  setMes: (m: string) => void
  openQuickAdd: (q: Exclude<QuickAdd, null>, preset?: QuickAddPreset) => void
  closeQuickAdd: () => void
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      viewMode: 'CONSOLIDADO',
      mes: currentMesRef(),
      quickAdd: null,
      quickAddPreset: null,
      setViewMode: (viewMode) => set({ viewMode }),
      setMes: (mes) => set({ mes }),
      openQuickAdd: (quickAdd, preset) => set({ quickAdd, quickAddPreset: preset ?? null }),
      closeQuickAdd: () => set({ quickAdd: null, quickAddPreset: null }),
    }),
    {
      name: 'financas-ui',
      partialize: (s) => ({ viewMode: s.viewMode, mes: s.mes }),
    },
  ),
)
