import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Widgets fixados por padrão na tela de Relatórios. */
const DEFAULT_PINNED = ['saldos', 'receita-despesa', 'pizza', 'a-pagar']

interface DashboardPrefsState {
  /** Ids dos widgets fixados, na ordem de exibição. */
  pinned: string[]
  toggle: (id: string) => void
  moveUp: (id: string) => void
  moveDown: (id: string) => void
  reset: () => void
}

export const useDashboardPrefs = create<DashboardPrefsState>()(
  persist(
    (set) => ({
      pinned: DEFAULT_PINNED,
      toggle: (id) =>
        set((s) => ({
          pinned: s.pinned.includes(id)
            ? s.pinned.filter((x) => x !== id)
            : [...s.pinned, id],
        })),
      moveUp: (id) =>
        set((s) => {
          const i = s.pinned.indexOf(id)
          if (i <= 0) return s
          const p = [...s.pinned]
          ;[p[i - 1], p[i]] = [p[i], p[i - 1]]
          return { pinned: p }
        }),
      moveDown: (id) =>
        set((s) => {
          const i = s.pinned.indexOf(id)
          if (i < 0 || i >= s.pinned.length - 1) return s
          const p = [...s.pinned]
          ;[p[i + 1], p[i]] = [p[i], p[i + 1]]
          return { pinned: p }
        }),
      reset: () => set({ pinned: DEFAULT_PINNED }),
    }),
    { name: 'financas-dashboard' },
  ),
)
