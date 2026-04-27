'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import type { User } from '@/types'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const u = getCurrentUser()
    if (!u) {
      router.replace('/login')
    } else {
      setUser(u)
      setLoading(false)
    }
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bbt-gray-50 dark:bg-slate-900">
        <div className="space-y-3 text-center">
          <div className="w-12 h-12 border-4 border-bbt-accent border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-sm text-slate-500">Carregando sistema...</div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
