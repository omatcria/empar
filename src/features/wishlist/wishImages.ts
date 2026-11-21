import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ownerCols } from '@/store/owner'

const prefix = 'wishlist-storage:'
const bucket = 'wishlist-images'
const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export function validateWishImage(file: File): string | null {
  if (!allowed.has(file.type)) return 'Use uma imagem JPG, PNG, WebP ou GIF.'
  if (file.size > 5 * 1024 * 1024) return 'A imagem deve ter no máximo 5 MB.'
  return null
}
export async function uploadWishImage(file: File): Promise<string> {
  const error = validateWishImage(file)
  if (error) throw new Error(error)
  const { workspace_id } = ownerCols()
  const path = `${workspace_id}/${crypto.randomUUID()}`
  const result = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false })
  if (result.error) throw result.error
  return prefix + path
}
export async function removeWishImage(value: string): Promise<void> {
  if (!value.startsWith(prefix)) return
  const { error } = await supabase.storage.from(bucket).remove([value.slice(prefix.length)])
  if (error) throw error
}
export function useWishImage(value: string | null | undefined): string | null {
  const [signed, setSigned] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    setSigned(null)
    if (value?.startsWith(prefix)) {
      void supabase.storage.from(bucket).createSignedUrl(value.slice(prefix.length), 3600).then(({data}) => {
        if (active) setSigned(data?.signedUrl ?? null)
      })
    }
    return () => { active = false }
  }, [value])
  return value?.startsWith(prefix) ? signed : value ?? null
}
