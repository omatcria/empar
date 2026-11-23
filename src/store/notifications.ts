import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Notification, NotificationPrefUpdate, NotificationPref } from '@/domain/types'
import { computeNotifications } from '@/engine'
import { meiLimit, meiRevenue, meiStatus } from '@/engine/mei'
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
  /** Gera (na app) os avisos de orçamento e MEI para todos os membros do espaço. */
  generate: () => Promise<void>
  /** Agenda `generate` com debounce de 2 s (chamado após mutações de lançamento). */
  scheduleGenerate: () => void
  subscribe: () => void
  unsubscribe: () => void
}

const byCreatedDesc = (a: Notification, b: Notification) =>
  b.created_at.localeCompare(a.created_at)

let subscription: ReturnType<typeof supabase.channel> | null = null
let generateTimer: ReturnType<typeof setTimeout> | null = null

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
    if (!uid || !ws) return

    const { transactions, budgets, categories } = useData.getState()

    // Chaves já notificadas ao usuário atual (o gatilho do banco também deduplica).
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

    const wsRow = useWorkspace.getState().workspaces.find((w) => w.id === ws)
    let mei: { workspaceId: string; year: number; status: ReturnType<typeof meiStatus> } | undefined
    if (wsRow?.mei_ativo) {
      const today = todayISO()
      const year = Number(today.slice(0, 4))
      const { realizado } = meiRevenue(transactions, categories, year)
      const limite = meiLimit(wsRow.mei_limite_anual_centavos, wsRow.mei_abertura, year)
      mei = { workspaceId: ws, year, status: meiStatus(realizado, limite) }
    }

    // Tudo ligado: as preferências de cada membro são aplicadas pelo gatilho do banco.
    const pending = computeNotifications({
      today: todayISO(),
      prefs: { orcamento_80: true, mei_alertas: true },
      transactions,
      budgets,
      categories,
      existingKeys,
      mei,
    })
    if (pending.length === 0) return

    const members = useWorkspace.getState().members
    const userIds = members.length > 0 ? members.map((m) => m.user_id) : [uid]
    if (!userIds.includes(uid)) userIds.push(uid)

    const rows = pending.flatMap((p) =>
      userIds.map((user_id) => ({
        workspace_id: ws,
        user_id,
        tipo: p.tipo,
        titulo: p.titulo,
        corpo: p.corpo,
        meta: { ...p.meta, dedupe_key: p.dedupe_key },
      })),
    )

    // A policy de SELECT só enxerga as linhas do próprio usuário e o RETURNING exige que
    // todas passem nela: linhas de outros membros vão sem `.select()`.
    const proprias = rows.filter((r) => r.user_id === uid)
    const demais = rows.filter((r) => r.user_id !== uid)
    // 23505 = duplicata (o aviso já existe): não é falha.
    const falhou = (error: unknown) =>
      !!error && (error as { code?: string }).code !== '23505'

    if (demais.length) {
      const { error } = await supabase.from('notifications').insert(demais)
      if (falhou(error)) console.error('Falha ao gerar notificações', error)
    }
    if (proprias.length === 0) return
    const { data, error } = await supabase.from('notifications').insert(proprias).select()
    if (error) {
      if (falhou(error)) console.error('Falha ao gerar notificações', error)
      return
    }
    const meus = (data ?? []).filter((n) => n.user_id === uid)
    if (meus.length) {
      set((s) => {
        // Evita duplicar caso o realtime já tenha entregue algo.
        const seen = new Set(s.notifications.map((n) => n.id))
        const novos = meus.filter((n) => !seen.has(n.id))
        if (novos.length === 0) return s
        return {
          notifications: [...novos, ...s.notifications].sort(byCreatedDesc),
          unreadCount: s.unreadCount + novos.filter((n) => !n.lida).length,
        }
      })
    }
  },

  scheduleGenerate: () => {
    if (generateTimer) clearTimeout(generateTimer)
    generateTimer = setTimeout(() => {
      generateTimer = null
      get()
        .generate()
        .catch((e) => console.error('Falha ao gerar notificações', e))
    }, 2000)
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
