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
  sendTest(): Promise<boolean>
  /** Libera o aparelho para a próxima conta (logout): apaga a linha e cancela a inscrição. */
  releaseDevice(): Promise<void>
}

const NOT_READY = 'O app ainda não está pronto para notificações. Recarregue a página.'

/** `ready` nunca resolve sem SW registrado (dev, instalação quebrada): limita a espera. */
async function getRegistration(): Promise<ServiceWorkerRegistration> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(NOT_READY)), 5000)
  })
  try {
    return await Promise.race([navigator.serviceWorker.ready, timeout])
  } finally {
    clearTimeout(timer)
  }
}

async function upsertSubscription(sub: PushSubscription): Promise<{ code?: string } | null> {
  const uid = useAuth.getState().user?.id
  if (!uid) throw new Error('Sem sessão')
  const json = sub.toJSON()
  if (!json.keys?.p256dh || !json.keys?.auth) throw new Error('Inscrição de push sem chaves')
  const row: PushSubscriptionInsert = {
    user_id: uid,
    endpoint: sub.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  }
  const { error } = await supabase.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' })
  return error ?? null
}

function subscribeDevice(reg: ServiceWorkerRegistration): Promise<PushSubscription> {
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
  })
}

async function saveSubscription(sub: PushSubscription): Promise<void> {
  const error = await upsertSubscription(sub)
  if (!error) return
  if (error.code !== '42501') throw error
  // 42501: o endpoint pertence a outra conta (aparelho compartilhado). Gera um endpoint novo.
  await sub.unsubscribe()
  const reg = await getRegistration()
  const fresh = await subscribeDevice(reg)
  const retry = await upsertSubscription(fresh)
  if (retry) throw retry
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
      const sub = await subscribeDevice(reg)
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
        // o aparelho já está desinscrito: falha ao apagar a linha só é registrada
        const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
        if (error) console.error('Falha ao apagar inscrição de push', error)
      }
      set({ status: 'off', error: null })
    } catch (e) {
      console.error('Falha ao desativar notificações push', e)
      set({ status: 'error', error: e instanceof Error ? e.message : String(e) })
    }
  },

  async releaseDevice() {
    try {
      if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (!sub) return
      // ainda autenticado: a RLS permite apagar a própria linha
      const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      if (error) console.error('Falha ao apagar inscrição de push', error)
      await sub.unsubscribe()
      set({ status: 'off', error: null })
    } catch (e) {
      console.error('Falha ao liberar o aparelho de push', e)
    }
  },

  async sendTest() {
    const fail = (): false => {
      set({ error: 'Não foi possível enviar o teste.' })
      return false
    }
    try {
      const uid = useAuth.getState().user?.id
      const ws = useWorkspace.getState().activeWorkspaceId
      if (!uid || !ws) return fail()
      const { error } = await supabase.from('notifications').insert({
        workspace_id: ws,
        user_id: uid,
        tipo: 'teste',
        titulo: 'Notificações ativadas',
        corpo: 'Este é um teste do Empar.',
      })
      if (error) throw error
      return true
    } catch (e) {
      console.error('Falha ao enviar teste de notificação', e)
      return fail()
    }
  },
}))
