import type { User } from '@supabase/supabase-js'
import { create } from 'zustand'
import { supabase } from '../lib/supabase'

interface AuthState {
  user: User | null
  initializing: boolean
  initialized: boolean
  init: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  initializing: true,
  initialized: false,

  init: () => {
    if (get().initialized) return
    set({ initialized: true })

    if (!supabase) {
      set({ initializing: false })
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      set({ user: data.session?.user ?? null, initializing: false })
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user ?? null, initializing: false })
    })
  },
}))
