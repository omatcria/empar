import { useEffect, useState } from 'react'

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

  if (!offline) return null
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[60] bg-warn/15 px-4 pb-1.5 text-center text-xs font-medium text-warn backdrop-blur"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.375rem)' }}
    >
      Sem conexão — os dados podem estar desatualizados
    </div>
  )
}
