import { create } from 'zustand'

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallState = 'installed' | 'ios' | 'prompt' | 'unsupported'

export function detectInstallState(o: {
  standalone: boolean
  userAgent: string
  hasPrompt: boolean
  maxTouchPoints?: number
}): InstallState {
  if (o.standalone) return 'installed'
  if (/iPhone|iPad|iPod/i.test(o.userAgent)) return 'ios'
  // iPadOS Safari se apresenta como Macintosh, mas tem toque
  if (/Macintosh/i.test(o.userAgent) && (o.maxTouchPoints ?? 0) > 1) return 'ios'
  if (o.hasPrompt) return 'prompt'
  return 'unsupported'
}

interface PwaInstallState {
  deferred: BeforeInstallPromptEvent | null
  installed: boolean
  promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'>
}

export const usePwaInstall = create<PwaInstallState>((set, get) => ({
  deferred: null,
  installed: false,
  async promptInstall() {
    const ev = get().deferred
    if (!ev) return 'unavailable'
    await ev.prompt()
    const { outcome } = await ev.userChoice
    set({ deferred: null })
    return outcome
  },
}))

let registered = false

export function initPwaInstallListeners(): void {
  if (registered || typeof window === 'undefined') return
  registered = true
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    usePwaInstall.setState({ deferred: e as BeforeInstallPromptEvent })
  })
  window.addEventListener('appinstalled', () => {
    usePwaInstall.setState({ deferred: null, installed: true })
  })
}
