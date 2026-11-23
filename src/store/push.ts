import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { VAPID_PUBLIC_KEY } from '@/lib/push-config'
import { currentPushEnv, pushSupport, urlBase64ToUint8Array } from '@/lib/push'
import { useAuth } from '@/store/auth'
import { useWorkspace } from '@/store/workspace'
import type { PushSubscriptionInsert } from '@/domain/types'

export type PushStatus = 'checking' | 'unsupported' | 'ios-install' | 'off' | 'on' | 'blocked' | 'error'

interface PushState {
  status: PushStatus
  error: string | null
  refresh(): Promise<void>
  enable(): Promise<void>
  disable(): Promise<void>
  sendTest(): Promise<void>
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.ready
}

async function saveSubscription(sub: PushSubscription): Promise<void> {
  const uid = useAuth.getState().user?.id
  if (!uid) throw new Error('Sem sessão')
  const json = sub.toJSON()
  const row: PushSubscriptionInsert = {
    user_id: uid,
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  }
  const { error } = await supabase.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' })
  if (error) throw error
}

export const usePush = create<PushState>((set) => ({
  status: 'checking',
  error: null,

  async refresh() {
    try {
      const support = pushSupport(currentPushEnv())
      if (support !== 'ok') {
        set({ status: support, error: null })
        return
      }
      if (Notification.permission === 'denied') {
        set({ status: 'blocked', error: null })
        return
      }
      if (Notification.permission !== 'granted') {
        set({ status: 'off', error: null })
        return
      }
      const reg = await getRegistration()
      const sub = await reg.pushManager.getSubscription()
      if (!sub) {
        set({ status: 'off', error: null })
        return
      }
      await saveSubscription(sub) // o endpoint pode ter mudado
      set({ status: 'on', error: null })
    } catch (e) {
      console.error('Falha ao sincronizar notificações push', e)
      set({ status: 'error', error: e instanceof Error ? e.message : String(e) })
    }
  },

  async enable() {
    try {
      const support = pushSupport(currentPushEnv())
      if (support !== 'ok') {
        set({ status: support, error: null })
        return
      }
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        set({ status: permission === 'denied' ? 'blocked' : 'off', error: null })
        return
      }
      const reg = await getRegistration()
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      })
      await saveSubscription(sub)
      set({ status: 'on', error: null })
    } catch (e) {
      console.error('Falha ao ativar notificações push', e)
      set({ status: 'error', error: e instanceof Error ? e.message : String(e) })
    }
  },

  async disable() {
    try {
      const reg = await getRegistration()
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const endpoint = sub.endpoint
        await sub.unsubscribe()
        const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
        if (error) throw error
      }
      set({ status: 'off', error: null })
    } catch (e) {
      console.error('Falha ao desativar notificações push', e)
      set({ status: 'error', error: e instanceof Error ? e.message : String(e) })
    }
  },

  async sendTest() {
    try {
      const uid = useAuth.getState().user?.id
      const ws = useWorkspace.getState().activeWorkspaceId
      if (!uid || !ws) return
      const { error } = await supabase.from('notifications').insert({
        workspace_id: ws,
        user_id: uid,
        tipo: 'teste',
        titulo: 'Notificações ativadas',
        corpo: 'Este é um teste do Empar.',
      })
      if (error) throw error
    } catch (e) {
      console.error('Falha ao enviar teste de notificação', e)
    }
  },
}))
