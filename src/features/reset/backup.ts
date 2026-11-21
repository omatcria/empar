import { useData } from '@/store/data'
import { useDebts } from '@/store/debts'
import { useWishlist } from '@/store/wishlist'
import { supabase } from '@/lib/supabase'
import type { WishlistPricePoint } from '@/domain/types'

/** Baixa um JSON com todos os dados do espaço (inclui investimentos, dívidas e desejos). */
export async function exportBackup(store: ReturnType<typeof useData.getState>) {
  const debts = useDebts.getState()
  const wishlist = useWishlist.getState()
  if (!store.workspaceId || !debts.loaded || !wishlist.loaded) throw new Error('Aguarde o carregamento completo dos dados antes de baixar o backup.')
  const history: WishlistPricePoint[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from('wishlist_price_history').select('*').eq('workspace_id', store.workspaceId).order('id').range(offset, offset + 999)
    if (error) throw new Error('Não foi possível carregar todo o histórico para o backup.')
    history.push(...data)
    if (data.length < 1000) break
  }
  const wishlistImages: { path: string; dataUrl: string }[] = []
  for (const item of wishlist.items) {
    if (!item.imagem_url?.startsWith('wishlist-storage:')) continue
    const path = item.imagem_url.slice('wishlist-storage:'.length)
    if (wishlistImages.some(image => image.path === path)) continue
    const { data, error } = await supabase.storage.from('wishlist-images').download(path)
    if (error) throw new Error('Não foi possível incluir todas as imagens dos desejos no backup.')
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('Não foi possível ler uma imagem para o backup.'))
      reader.readAsDataURL(data)
    })
    wishlistImages.push({ path, dataUrl })
  }
  const payload = {
    exportedAt: new Date().toISOString(),
    profile: store.profile,
    accounts: store.accounts,
    cards: store.cards,
    invoices: store.invoices,
    categories: store.categories,
    transactions: store.transactions,
    recurrences: store.recurrences,
    budgets: store.budgets,
    goals: store.goals,
    provisions: store.provisions,
    investments: store.investments,
    investmentMovements: store.investmentMovements,
    debts: debts.debts,
    debtInstallments: debts.installments,
    wishlistItems: wishlist.items,
    wishlistCategories: wishlist.categories,
    wishlistHistory: history,
    wishlistImages,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `financas-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
