export type PushEnv = {
  userAgent: string
  maxTouchPoints: number
  standalone: boolean
  hasServiceWorker: boolean
  hasPushManager: boolean
  hasNotification: boolean
}

export function pushSupport(env: PushEnv): 'ok' | 'ios-install' | 'unsupported' {
  const ios =
    /iPhone|iPad|iPod/i.test(env.userAgent) ||
    // iPadOS Safari se apresenta como Macintosh, mas tem toque
    (/Macintosh/i.test(env.userAgent) && env.maxTouchPoints > 1)
  if (ios && !env.standalone) return 'ios-install'
  if (!env.hasServiceWorker || !env.hasPushManager || !env.hasNotification) return 'unsupported'
  return 'ok'
}

export function currentPushEnv(): PushEnv {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined
  const win = typeof window !== 'undefined' ? window : undefined
  const standalone =
    (!!win && typeof win.matchMedia === 'function' && win.matchMedia('(display-mode: standalone)').matches) ||
    (nav as (Navigator & { standalone?: boolean }) | undefined)?.standalone === true
  return {
    userAgent: nav?.userAgent ?? '',
    maxTouchPoints: nav?.maxTouchPoints ?? 0,
    standalone,
    hasServiceWorker: !!nav && 'serviceWorker' in nav,
    hasPushManager: !!win && 'PushManager' in win,
    hasNotification: !!win && 'Notification' in win,
  }
}

export function urlBase64ToUint8Array(s: string): Uint8Array {
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4)
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}
