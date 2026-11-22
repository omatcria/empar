import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export function OfflineBanner() {
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' && navigator.onLine === false,
  )

  useEffect(() => {
    const off = () => setOffline(true)
    const on = () => setOffline(false)
    window.addEventListener('offline', off)
    window.addEventListener('online', on)
    return () => {
      window.removeEventListener('offline', off)
      window.removeEventListener('online', on)
    }
  }, [])

  // Faixa em fluxo (sticky), para não cobrir o cabeçalho; o cabeçalho do app
  // desce pela altura dela via --offline-banner-h.
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!offline || !ref.current) return
    const root = document.documentElement
    root.style.setProperty('--offline-banner-h', `${ref.current.offsetHeight}px`)
    return () => {
      root.style.removeProperty('--offline-banner-h')
    }
  }, [offline])

  if (!offline) return null
  return (
    <div
      ref={ref}
      role="status"
      className="sticky top-0 z-[60] border-b border-warn/30 bg-app-surface px-4 pb-1.5 text-center text-xs font-medium text-warn backdrop-blur"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.375rem)' }}
    >
      Sem conexão — os dados podem estar desatualizados
    </div>
  )
}
