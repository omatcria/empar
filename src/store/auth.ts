import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthState {
  session: Session | null
  user: User | null
  initializing: boolean
  /** Assina o estado de auth do Supabase. Retorna unsubscribe. */
  init: () => () => void
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (
    email: string,
    password: string,
    nome: string,
  ) => Promise<{ error?: string; needsConfirmation?: boolean }>
  signOut: () => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  session: null,
  user: null,
  initializing: true,

  init: () => {
    supabase.auth.getSession().then(({ data }) => {
      set({
        session: data.session,
        user: data.session?.user ?? null,
        initializing: false,
      })
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null, initializing: false })
    })

    return () => sub.subscription.unsubscribe()
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message }
  },

  signUp: async (email, password, nome) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nome } },
    })
    if (error) return { error: error.message }
    // Se confirmação de e-mail estiver ativa, não haverá sessão imediata.
    return { needsConfirmation: !data.session }
  },

  signOut: async () => {
    // Libera o aparelho de push ainda autenticado; falhas nunca impedem o logout.
    try {
      const { usePush } = await import('./push')
      await usePush.getState().releaseDevice()
    } catch (e) {
      console.error('Falha ao liberar o aparelho de push', e)
    }
    await supabase.auth.signOut()
    set({ session: null, user: null })
  },
}))
