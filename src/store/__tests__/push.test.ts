import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  from: vi.fn(),
  upsert: vi.fn(),
  insert: vi.fn(),
  del: vi.fn(),
  eq: vi.fn(),
  support: { v: 'ok' as string },
}))

vi.mock('@/lib/supabase', () => ({ supabase: { from: h.from } }))
vi.mock('@/store/auth', () => ({ useAuth: { getState: () => ({ user: { id: 'me' } }) } }))
vi.mock('@/store/workspace', () => ({ useWorkspace: { getState: () => ({ activeWorkspaceId: 'ws' }) } }))
vi.mock('@/lib/push', async (orig) => {
  const real = await orig<typeof import('@/lib/push')>()
  return { ...real, pushSupport: () => h.support.v }
})

import { usePush } from '../push'

const sub = {
  endpoint: 'https://push.example/abc',
  toJSON: () => ({ endpoint: 'https://push.example/abc', keys: { p256dh: 'P', auth: 'A' } }),
  unsubscribe: vi.fn(),
}
const pushManager = { subscribe: vi.fn(), getSubscription: vi.fn() }

function setPermission(p: NotificationPermission) {
  vi.stubGlobal('Notification', { permission: p, requestPermission: vi.fn(async () => p) })
}

beforeEach(() => {
  vi.clearAllMocks()
  h.support.v = 'ok'
  usePush.setState({ status: 'checking', error: null })
  h.upsert.mockResolvedValue({ error: null })
  h.insert.mockResolvedValue({ error: null })
  h.eq.mockResolvedValue({ error: null })
  h.del.mockReturnValue({ eq: h.eq })
  h.from.mockImplementation((t: string) => {
    if (t === 'push_subscriptions') return { upsert: h.upsert, delete: h.del }
    if (t === 'notifications') return { insert: h.insert }
    throw new Error('tabela inesperada ' + t)
  })
  sub.unsubscribe.mockResolvedValue(true)
  pushManager.subscribe.mockResolvedValue(sub)
  pushManager.getSubscription.mockResolvedValue(sub)
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager }) },
  })
})

describe('usePush', () => {
  it('enable com permissão negada vira blocked sem lançar', async () => {
    setPermission('denied')
    await usePush.getState().enable()
    expect(usePush.getState().status).toBe('blocked')
    expect(pushManager.subscribe).not.toHaveBeenCalled()
    expect(h.upsert).not.toHaveBeenCalled()
  })

  it('enable concedido inscreve e grava', async () => {
    setPermission('granted')
    await usePush.getState().enable()
    expect(pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true, applicationServerKey: expect.anything() }),
    )
    expect(h.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'me', endpoint: sub.endpoint, p256dh: 'P', auth: 'A' }),
      { onConflict: 'endpoint' },
    )
    expect(usePush.getState().status).toBe('on')
  })

  it('disable cancela a inscrição e apaga a linha', async () => {
    setPermission('granted')
    await usePush.getState().disable()
    expect(sub.unsubscribe).toHaveBeenCalled()
    expect(h.eq).toHaveBeenCalledWith('endpoint', sub.endpoint)
    expect(usePush.getState().status).toBe('off')
  })

  it('disable termina em off mesmo se apagar a linha falhar', async () => {
    setPermission('granted')
    h.eq.mockResolvedValue({ error: { message: 'x' } })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await usePush.getState().disable()
    expect(usePush.getState().status).toBe('off')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('inscrição sem chaves vira error e não grava', async () => {
    setPermission('granted')
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    pushManager.subscribe.mockResolvedValue({ ...sub, toJSON: () => ({ endpoint: sub.endpoint }) })
    await usePush.getState().enable()
    expect(usePush.getState().status).toBe('error')
    expect(h.upsert).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('sem service worker registrado, refresh e enable terminam em error após 5 s', async () => {
    vi.useFakeTimers()
    try {
      setPermission('granted')
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: { ready: new Promise(() => {}) },
      })
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const p1 = usePush.getState().refresh()
      await vi.advanceTimersByTimeAsync(5000)
      await p1
      expect(usePush.getState().status).toBe('error')
      expect(usePush.getState().error).toBe('O app ainda não está pronto para notificações. Recarregue a página.')
      usePush.setState({ status: 'checking', error: null })
      const p2 = usePush.getState().enable()
      await vi.advanceTimersByTimeAsync(5000)
      await p2
      expect(usePush.getState().status).toBe('error')
      spy.mockRestore()
    } finally {
      vi.useRealTimers()
    }
  })

  it('sendTest grava notificação de teste para si e devolve true', async () => {
    expect(await usePush.getState().sendTest()).toBe(true)
    expect(h.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace_id: 'ws',
        user_id: 'me',
        tipo: 'teste',
        titulo: 'Notificações ativadas',
        corpo: 'Este é um teste do Empar.',
      }),
    )
  })

  it('sendTest devolve false com erro definido se o insert falhar', async () => {
    h.insert.mockResolvedValue({ error: { message: 'x' } })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await usePush.getState().sendTest()).toBe(false)
    expect(usePush.getState().error).toBe('Não foi possível enviar o teste.')
    spy.mockRestore()
  })

  it('refresh com permissão e inscrição existente re-grava e fica on', async () => {
    setPermission('granted')
    await usePush.getState().refresh()
    expect(h.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: sub.endpoint }),
      { onConflict: 'endpoint' },
    )
    expect(usePush.getState().status).toBe('on')
  })

  it('upsert com 42501 re-inscreve e grava com o novo endpoint', async () => {
    setPermission('granted')
    const sub2 = {
      endpoint: 'https://push.example/novo',
      toJSON: () => ({ endpoint: 'https://push.example/novo', keys: { p256dh: 'P2', auth: 'A2' } }),
      unsubscribe: vi.fn(),
    }
    h.upsert.mockResolvedValueOnce({ error: { code: '42501' } }).mockResolvedValueOnce({ error: null })
    pushManager.subscribe.mockResolvedValueOnce(sub).mockResolvedValueOnce(sub2)
    await usePush.getState().enable()
    expect(sub.unsubscribe).toHaveBeenCalled()
    expect(pushManager.subscribe).toHaveBeenCalledTimes(2)
    expect(h.upsert).toHaveBeenCalledTimes(2)
    expect(h.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ endpoint: 'https://push.example/novo', p256dh: 'P2' }),
      { onConflict: 'endpoint' },
    )
    expect(usePush.getState().status).toBe('on')
  })

  it('42501 persistente depois de re-inscrever termina em error', async () => {
    setPermission('granted')
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    h.upsert.mockResolvedValue({ error: { code: '42501' } })
    await usePush.getState().enable()
    expect(h.upsert).toHaveBeenCalledTimes(2)
    expect(usePush.getState().status).toBe('error')
    spy.mockRestore()
  })

  it('releaseDevice apaga a linha e cancela a inscrição; falhas não lançam', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration: async () => ({ pushManager }) },
    })
    await usePush.getState().releaseDevice()
    expect(h.eq).toHaveBeenCalledWith('endpoint', sub.endpoint)
    expect(sub.unsubscribe).toHaveBeenCalled()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    pushManager.getSubscription.mockRejectedValue(new Error('x'))
    await expect(usePush.getState().releaseDevice()).resolves.toBeUndefined()
    spy.mockRestore()
  })

  it('refresh sem suporte reflete o estado', async () => {
    h.support.v = 'ios-install'
    await usePush.getState().refresh()
    expect(usePush.getState().status).toBe('ios-install')
  })
})
