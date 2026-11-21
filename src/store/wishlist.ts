import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { priceAlert, type PriceAlert } from '@/engine/wishlist'
import { ownerCols } from './owner'
import type { WishlistCategory, WishlistCategoryInsert, WishlistCategoryUpdate, WishlistItem, WishlistItemInsert, WishlistItemUpdate, WishlistPricePoint } from '@/domain/types'

export type ScrapeResult = { ok: boolean; titulo?: string | null; descricao?: string | null; imagem_url?: string | null; preco_centavos?: number | null; loja?: string | null; motivo?: string }
interface WishlistState {
  items: WishlistItem[]; categories: WishlistCategory[]; history: WishlistPricePoint[]; loaded: boolean; loadError: string | null
  load: (workspaceId: string) => Promise<void>; reset: () => void
  scrape: (url: string, browserFallback?: boolean) => Promise<ScrapeResult>
  addItem: (input: Omit<WishlistItemInsert, 'user_id' | 'workspace_id'>) => Promise<WishlistItem>
  updateItem: (id: string, patch: WishlistItemUpdate) => Promise<void>; deleteItem: (id: string) => Promise<void>
  refreshPrice: (id: string) => Promise<{ok: boolean; motivo?: string; alerta: PriceAlert}>
  addCategory: (input: Omit<WishlistCategoryInsert, 'user_id' | 'workspace_id'>) => Promise<void>
  updateCategory: (id: string, patch: WishlistCategoryUpdate) => Promise<void>; deleteCategory: (id: string) => Promise<void>
}
let loadSequence = 0
export const useWishlist = create<WishlistState>((set,get) => ({
  items: [], categories: [], history: [], loaded: false, loadError: null,
  load: async (workspaceId) => {
    const sequence = ++loadSequence
    set({ items: [], categories: [], history: [], loaded: false, loadError: null })
    const [categories, items, history] = await Promise.all([
      supabase.from('wishlist_categories').select('*').eq('workspace_id', workspaceId),
      supabase.from('wishlist_items').select('*').eq('workspace_id', workspaceId),
      supabase.from('wishlist_price_history').select('*').eq('workspace_id', workspaceId).gte('verificado_em', new Date(Date.now()-90*86400000).toISOString()),
    ])
    if (sequence !== loadSequence) return
    const error = categories.error || items.error || history.error
    if (error) { set({ loadError: error.message }); throw error }
    set({ categories: categories.data ?? [], items: items.data ?? [], history: history.data ?? [], loaded: true })
  },
  reset: () => { loadSequence++; set({ items: [], categories: [], history: [], loaded: false, loadError: null }) },
  scrape: async (url, browserFallback = false) => {
    try { const { data, error } = await supabase.functions.invoke('wishlist-scrape', { body: { url, browser_fallback: browserFallback } }); return error ? { ok: false, motivo: error.message } : data as ScrapeResult }
    catch { return { ok: false, motivo: 'Não foi possível acessar o leitor.' } }
  },
  addItem: async (input) => {
    const owner = ownerCols(), price = input.preco_atual_centavos ?? null
    const { data, error } = await supabase.from('wishlist_items').insert({ ...input, ...owner, preco_inicial_centavos: price, preco_minimo_centavos: price }).select().single()
    if (error) throw error
    if (price != null) {
      const result = await supabase.from('wishlist_price_history').insert({ workspace_id: owner.workspace_id, item_id: data.id, preco_centavos: price }).select().single()
      if (result.error) { const rollback = await supabase.from('wishlist_items').delete().eq('id', data.id); if (rollback.error) throw new Error('O item foi criado, mas não foi possível registrar o histórico nem desfazer a criação. Recarregue a página.'); throw result.error }
      set(s => ({ history: [...s.history, result.data] }))
    }
    set(s => ({ items: [...s.items, data] })); return data
  },
  updateItem: async (id, patch) => { const { data,error } = await supabase.from('wishlist_items').update(patch).eq('id',id).select().single(); if (error) throw error; set(s => ({ items: s.items.map(i => i.id === id ? data : i) })) },
  deleteItem: async (id) => {
    const image = get().items.find(i => i.id === id)?.imagem_url
    const {error} = await supabase.from('wishlist_items').delete().eq('id',id)
    if (error) throw error
    set(s => ({items:s.items.filter(i=>i.id!==id),history:s.history.filter(h=>h.item_id!==id)}))
    if (image?.startsWith('wishlist-storage:')) {
      const result = await supabase.storage.from('wishlist-images').remove([image.slice('wishlist-storage:'.length)])
      if (result.error) console.warn('Não foi possível remover a imagem do desejo excluído', result.error)
    }
  },
  refreshPrice: async (id) => {
    const item = get().items.find(i => i.id === id)
    if (!item) return {ok:false,motivo:'Desejo não encontrado',alerta:null}
    const result = await get().scrape(item.url, true)
    if (!result.ok || result.preco_centavos == null) return {ok:false,motivo:result.motivo ?? 'Preço não encontrado',alerta:null}
    const price = result.preco_centavos, alerta = priceAlert(item.preco_atual_centavos,price,item.preco_alvo_centavos)
    const point = await supabase.from('wishlist_price_history').insert({workspace_id:item.workspace_id,item_id:id,preco_centavos:price}).select().single()
    if (point.error) throw point.error
    set(s=>({history:[...s.history,point.data]}))
    await get().updateItem(id,{preco_atual_centavos:price,preco_inicial_centavos:item.preco_inicial_centavos ?? price,preco_minimo_centavos:Math.min(item.preco_minimo_centavos ?? price,price),ultima_verificacao:new Date().toISOString(),ultimo_erro:null})
    return {ok:true,alerta}
  },
  addCategory: async (input) => { const {data,error}=await supabase.from('wishlist_categories').insert({...input,...ownerCols()}).select().single(); if(error)throw error; set(s=>({categories:[...s.categories,data]})) },
  updateCategory: async (id,patch) => { const {data,error}=await supabase.from('wishlist_categories').update(patch).eq('id',id).select().single(); if(error)throw error; set(s=>({categories:s.categories.map(c=>c.id===id?data:c)})) },
  deleteCategory: async (id) => {const {error}=await supabase.from('wishlist_categories').delete().eq('id',id);if(error)throw error;set(s=>({categories:s.categories.filter(c=>c.id!==id),items:s.items.map(i=>i.category_id===id?{...i,category_id:null}:i)}))},
}))
