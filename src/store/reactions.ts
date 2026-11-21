import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { ReactionEmoji, TransactionReaction } from '@/domain/types'
import { useAuth } from './auth'
import { useWorkspace } from './workspace'
import { useData } from './data'

interface ReactionsState {
  reactions: TransactionReaction[]
  loading: boolean

  load: (workspaceId: string) => Promise<void>
  addReaction: (transactionId: string, emoji: ReactionEmoji) => Promise<void>
  removeReaction: (id: string) => Promise<void>
  subscribe: () => void
  unsubscribe: () => void
}

let subscription: ReturnType<typeof supabase.channel> | null = null

export const useReactions = create<ReactionsState>((set, get) => ({
  reactions: [],
  loading: true,

  load: async (workspaceId) => {
    set({ loading: true })
    const { data } = await supabase
      .from('transaction_reactions')
      .select('*')
      .eq('workspace_id', workspaceId)
    set({ reactions: data ?? [], loading: false })
  },

  addReaction: async (transactionId, emoji) => {
    const ws = useWorkspace.getState().activeWorkspaceId
    const uid = useAuth.getState().user?.id
    if (!ws || !uid) return

    // Optimistic check to avoid duplicate reactions from same user
    const existing = get().reactions.find(r => r.transaction_id === transactionId && r.user_id === uid && r.emoji === emoji)
    if (existing) return

    const { data, error } = await supabase
      .from('transaction_reactions')
      .insert({ workspace_id: ws, transaction_id: transactionId, user_id: uid, emoji })
      .select()
      .single()

    if (error) throw error
    set(s => ({ reactions: [...s.reactions, data] }))

    // Enviar notificação para o dono da transação
    try {
      const tx = useData.getState().transactions.find(t => t.id === transactionId)
      if (tx && tx.user_id !== uid) {
        const meuNome = useWorkspace.getState().members.find(m => m.user_id === uid)?.nome || 'Alguém'
        await supabase.from('notifications').insert({
          workspace_id: ws,
          user_id: tx.user_id,
          tipo: 'reaction',
          titulo: `${meuNome} reagiu a um lançamento`,
          corpo: `${meuNome} reagiu com ${emoji} ao lançamento "${tx.descricao || 'sem descrição'}"`,
        })
      }
    } catch (e) {
      console.error('Falha ao enviar notificação de reação', e)
    }
  },

  removeReaction: async (id) => {
    const { error } = await supabase.from('transaction_reactions').delete().eq('id', id)
    if (error) throw error
    set(s => ({ reactions: s.reactions.filter(r => r.id !== id) }))
  },

  subscribe: () => {
    const ws = useWorkspace.getState().activeWorkspaceId
    if (!ws) return

    if (subscription) {
      subscription.unsubscribe()
    }

    subscription = supabase
      .channel('public:transaction_reactions')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transaction_reactions', filter: `workspace_id=eq.${ws}` },
        (payload) => {
          set(s => {
            // Ignore if already have it optimistically
            if (s.reactions.some(r => r.id === payload.new.id)) return s
            return { reactions: [...s.reactions, payload.new as TransactionReaction] }
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'transaction_reactions', filter: `workspace_id=eq.${ws}` },
        (payload) => {
          set(s => ({ reactions: s.reactions.filter(r => r.id !== payload.old.id) }))
        }
      )
      .subscribe()
  },

  unsubscribe: () => {
    if (subscription) {
      subscription.unsubscribe()
      subscription = null
    }
  }
}))
