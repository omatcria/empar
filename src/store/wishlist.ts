import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type {
  WishlistCategory,
  WishlistItem,
  WishlistPricePoint,
} from '@/domain/types'

interface WishlistState {
  items: WishlistItem[]
  categories: WishlistCategory[]
  history: WishlistPricePoint[]
  loaded: boolean
  load: (workspaceId: string) => Promise<void>
  reset: () => void
}

export const useWishlist = create<WishlistState>((set) => ({
  items: [],
  categories: [],
  history: [],
  loaded: false,

  load: async (workspaceId) => {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const [categories, items, history] = await Promise.all([
      supabase.from('wishlist_categories').select('*').eq('workspace_id', workspaceId),
      supabase.from('wishlist_items').select('*').eq('workspace_id', workspaceId),
      supabase
        .from('wishlist_price_history')
        .select('*')
        .eq('workspace_id', workspaceId)
        .gte('verificado_em', since),
    ])
    const err = categories.error || items.error || history.error
    if (err) {
      console.error('Falha ao carregar lista de desejos:', err.message)
      throw new Error(err.message)
    }
    set({
      categories: (categories.data ?? []) as WishlistCategory[],
      items: (items.data ?? []) as WishlistItem[],
      history: (history.data ?? []) as WishlistPricePoint[],
      loaded: true,
    })
  },

  reset: () => set({ items: [], categories: [], history: [], loaded: false }),
}))
