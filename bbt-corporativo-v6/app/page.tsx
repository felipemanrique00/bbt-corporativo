'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'

export default function HomePage() {
  const router = useRouter()
  useEffect(() => {
    const user = getCurrentUser()
    router.replace(user ? '/dashboard' : '/login')
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-bbt-gray-50 dark:bg-slate-900">
      <div className="text-bbt-primary dark:text-bbt-accent font-semibold text-lg">
        Carregando Sistema BBT Corporativo...
      </div>
    </div>
  )
}
