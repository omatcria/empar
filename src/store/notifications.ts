import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Notification, NotificationPrefUpdate, NotificationPref } from '@/domain/types'
import { computeNotifications } from '@/engine'
import { todayISO } from '@/lib/cn'
import { useAuth } from './auth'
import { useWorkspace } from './workspace'
import { useData } from './data'

interface NotificationsState {
  notifications: Notification[]
  prefs: NotificationPref | null
  unreadCount: number
  loading: boolean

  load: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  updatePrefs: (patch: NotificationPrefUpdate) => Promise<void>
  /** Gera (na app) notificações de vencimento e 80% de orçamento, deduplicando. */
  generate: () => Promise<void>
  subscribe: () => void
  unsubscribe: () => void
}

const byCreatedDesc = (a: Notification, b: Notification) =>
  b.created_at.localeCompare(a.created_at)

let subscription: ReturnType<typeof supabase.channel> | null = null

export const useNotifications = create<NotificationsState>((set, get) => ({
  notifications: [],
  prefs: null,
  unreadCount: 0,
  loading: true,

  load: async () => {
    set({ loading: true })
    const uid = useAuth.getState().user?.id
    const ws = useWorkspace.getState().activeWorkspaceId
    if (!uid || !ws) {
      set({ loading: false })
      return
    }

    const [ { data: prefs }, { data: notifs } ] = await Promise.all([
      supabase.from('notification_prefs').select('*').eq('user_id', uid).maybeSingle(),
      supabase
        .from('notifications')
        .select('*')
        .eq('workspace_id', ws)
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(50)
    ])

    const notifications = notifs ?? []
    set({
      prefs,
      notifications,
      unreadCount: notifications.filter(n => !n.lida).length,
      loading: false
    })
  },

  markAsRead: async (id) => {
    const { error } = await supabase.from('notifications').update({ lida: true }).eq('id', id)
    if (error) throw error
    set((s) => {
      const notifications = s.notifications.map(n => n.id === id ? { ...n, lida: true } : n)
      return {
        notifications,
        unreadCount: notifications.filter(n => !n.lida).length
      }
    })
  },

  markAllAsRead: async () => {
    const ws = useWorkspace.getState().activeWorkspaceId
    const uid = useAuth.getState().user?.id
    if (!ws || !uid) return
    const { error } = await supabase
      .from('notifications')
      .update({ lida: true })
      .eq('workspace_id', ws)
      .eq('user_id', uid)
      .eq('lida', false)
    if (error) throw error
    set((s) => ({
      notifications: s.notifications.map(n => ({ ...n, lida: true })),
      unreadCount: 0
    }))
  },

  updatePrefs: async (patch) => {
    const uid = useAuth.getState().user?.id
    if (!uid) return
    const { data, error } = await supabase
      .from('notification_prefs')
      .update(patch)
      .eq('user_id', uid)
      .select()
      .single()
    if (error) throw error
    set({ prefs: data })
  },

  generate: async () => {
    const uid = useAuth.getState().user?.id
    const ws = useWorkspace.getState().activeWorkspaceId
    const prefs = get().prefs
    if (!uid || !ws || !prefs) return
    // Nada ligado → não faz consulta nenhuma.
    if (!prefs.venc_faturas && !prefs.venc_contas && !prefs.orcamento_80) return

    const { invoices, transactions, budgets, categories, cards } = useData.getState()

    // Chaves já notificadas (robusto: varre todas as notificações do usuário no espaço).
    const { data: existing } = await supabase
      .from('notifications')
      .select('meta')
      .eq('workspace_id', ws)
      .eq('user_id', uid)
    const existingKeys = new Set<string>(
      (existing ?? [])
        .map((r) => (r.meta as { dedupe_key?: string } | null)?.dedupe_key)
        .filter((k): k is string => typeof k === 'string'),
    )

    const pending = computeNotifications({
      today: todayISO(),
      prefs,
      invoices,
      transactions,
      budgets,
      categories,
      cardNames: new Map(cards.map((c) => [c.id, c.nome])),
      existingKeys,
    })
    if (pending.length === 0) return

    const rows = pending.map((p) => ({
      workspace_id: ws,
      user_id: uid,
      tipo: p.tipo,
      titulo: p.titulo,
      corpo: p.corpo,
      meta: { ...p.meta, dedupe_key: p.dedupe_key },
    }))

    const { data, error } = await supabase.from('notifications').insert(rows).select()
    if (error) {
      console.error('Falha ao gerar notificações', error)
      return
    }
    if (data && data.length) {
      set((s) => {
        // Evita duplicar caso o realtime já tenha entregue algo.
        const seen = new Set(s.notifications.map((n) => n.id))
        const novos = data.filter((n) => !seen.has(n.id))
        if (novos.length === 0) return s
        return {
          notifications: [...novos, ...s.notifications].sort(byCreatedDesc),
          unreadCount: s.unreadCount + novos.filter((n) => !n.lida).length,
        }
      })
    }
  },

  subscribe: () => {
    const ws = useWorkspace.getState().activeWorkspaceId
    const uid = useAuth.getState().user?.id
    if (!ws || !uid) return

    if (subscription) {
      subscription.unsubscribe()
    }

    subscription = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${uid}`
        },
        (payload) => {
          const newNotif = payload.new as Notification
          if (newNotif.workspace_id !== ws) return
          set((s) => {
            if (s.notifications.some((n) => n.id === newNotif.id)) return s
            return {
              notifications: [newNotif, ...s.notifications].sort(byCreatedDesc),
              unreadCount: s.unreadCount + (newNotif.lida ? 0 : 1),
            }
          })
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
