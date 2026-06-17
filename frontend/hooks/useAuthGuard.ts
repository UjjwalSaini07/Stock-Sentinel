'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'

export function useAuthGuard() {
  const { user, loading, init } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    init()
  }, [init])

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
    }
  }, [loading, user, router])

  return { user, loading }
}
