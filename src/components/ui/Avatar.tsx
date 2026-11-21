import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const avatarCache = new Map<string, string>()
const pendingRequests = new Map<string, Promise<string | null>>()

export interface AvatarProps {
  path?: string | null
  nome?: string | null
  className?: string
}

export function Avatar({ path, nome, className = 'size-8' }: AvatarProps) {
  const [url, setUrl] = useState<string | null>(path ? (avatarCache.get(path) ?? null) : null)

  useEffect(() => {
    if (!path) return
    if (avatarCache.has(path)) {
      setUrl(avatarCache.get(path)!)
      return
    }

    let isMounted = true

    async function loadSignedUrl() {
      if (!path) return
      
      let req = pendingRequests.get(path)
      if (!req) {
        req = supabase.storage
          .from('avatars')
          .createSignedUrl(path, 60 * 60 * 24) // 24 hours
          .then(({ data, error }) => {
            if (error || !data) return null
            return data.signedUrl
          })
        pendingRequests.set(path, req)
      }

      const signedUrl = await req
      if (signedUrl && isMounted) {
        avatarCache.set(path, signedUrl)
        setUrl(signedUrl)
      }
    }

    loadSignedUrl()

    return () => {
      isMounted = false
    }
  }, [path])

  const initial = nome ? nome.charAt(0).toUpperCase() : '?'

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-app-surface-2 text-app-fg border border-app-border ${className}`}
    >
      {url ? (
        <img src={url} alt={nome ?? 'Avatar'} className="h-full w-full object-cover" />
      ) : (
        <span className="font-medium">{initial}</span>
      )}
    </div>
  )
}
