import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error(
    'Configuração ausente: defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY em .env.local',
  )
}

/** Cliente Supabase tipado (schema public). RLS garante isolamento por usuário. */
export const supabase = createClient<Database>(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
