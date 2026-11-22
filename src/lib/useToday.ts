import { useEffect, useState } from 'react'
import { todayISO } from '@/lib/cn'

/** Data de hoje (YYYY-MM-DD) que se atualiza quando o dia vira (aba visível ou a cada 60 s). */
export function useToday(): string {
  const [hoje, setHoje] = useState(todayISO)

  useEffect(() => {
    const atualizar = () => setHoje((atual) => {
      const novo = todayISO()
      return novo === atual ? atual : novo
    })
    const onVisible = () => {
      if (document.visibilityState === 'visible') atualizar()
    }
    document.addEventListener('visibilitychange', onVisible)
    const id = window.setInterval(atualizar, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(id)
    }
  }, [])

  return hoje
}
