import { create } from 'zustand'
import { User } from '@/types'
import { authApi, userApi } from '@/lib/api'

interface AuthState {
  user: User | null
  loading: boolean
  init: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  init: async () => {
    const token = localStorage.getItem('access_token')
    if (!token) { set({ loading: false }); return }
    try {
      const { data } = await userApi.getMe()
      set({ user: data, loading: false })
    } catch {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      set({ loading: false })
    }
  },

  login: async (email, password) => {
    const { data } = await authApi.login(email, password)
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    const me = await userApi.getMe()
    set({ user: me.data })
  },

  register: async (email, password, name) => {
    const { data } = await authApi.register(email, password, name)
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    const me = await userApi.getMe()
    set({ user: me.data })
  },

  logout: () => {
    localStorage.clear()
    set({ user: null })
  },

  refreshUser: async () => {
    const { data } = await userApi.getMe()
    set({ user: data })
  },
}))
