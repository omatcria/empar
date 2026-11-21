import { useData } from '@/store/data'
import { useDebts } from '@/store/debts'
import { useWishlist } from '@/store/wishlist'

/** Baixa um JSON com todos os dados do espaço (inclui investimentos, dívidas e desejos). */
export function exportBackup(store: ReturnType<typeof useData.getState>) {
  const debts = useDebts.getState()
  const wishlist = useWishlist.getState()
  const payload = {
    exportedAt: new Date().toISOString(),
    profile: store.profile,
    accounts: store.accounts,
    cards: store.cards,
    invoices: store.invoices,
    categories: store.categories,
    transactions: store.transactions,
    budgets: store.budgets,
    goals: store.goals,
    provisions: store.provisions,
    investments: store.investments,
    investmentMovements: store.investmentMovements,
    debts: debts.debts,
    debtInstallments: debts.installments,
    wishlistItems: wishlist.items,
    wishlistCategories: wishlist.categories,
    wishlistHistory: wishlist.history,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `financas-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
