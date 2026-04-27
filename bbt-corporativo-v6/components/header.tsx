'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Search, Moon, Sun, LogOut, Settings, ChevronDown,
  Building2, Users, Hotel as HotelIcon, UserCircle2,
} from 'lucide-react'
import { getCurrentUser, logout, roleLabel, perfilBBTLabel } from '@/lib/auth'
import { useStore } from '@/lib/store'
import Fuse from 'fuse.js'
import type { User } from '@/types'

export function Header() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [darkMode, setDarkMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  const { empresas, funcionarios, hoteis } = useStore()

  useEffect(() => { setUser(getCurrentUser()) }, [])

  useEffect(() => {
    const saved = localStorage.getItem('bbt-theme')
    const isDark = saved === 'dark'
    setDarkMode(isDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const toggleDark = () => {
    const next = !darkMode
    setDarkMode(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('bbt-theme', next ? 'dark' : 'light')
  }

  const handleLogout = () => { logout(); router.push('/login') }

  type SearchItem = { id: string; type: 'empresa' | 'funcionario' | 'hotel'; nome: string; sub: string; href: string }
  const searchItems: SearchItem[] = useMemo(() => {
    const out: SearchItem[] = []
    empresas.forEach((e) => out.push({ id: e.id, type: 'empresa', nome: e.nome, sub: e.cnpj, href: `/dashboard/empresas/${e.id}` }))
    funcionarios.forEach((f) => {
      const emp = empresas.find((e) => e.id === f.company_id)?.nome || ''
      out.push({ id: f.id, type: 'funcionario', nome: f.nome, sub: `${f.cargo}${emp ? ' · ' + emp : ''}`, href: `/dashboard/funcionarios/${f.id}` })
    })
    hoteis.forEach((h) => out.push({ id: String(h.id), type: 'hotel', nome: h.nome, sub: `${h.cidade} · ${h.uf}`, href: `/dashboard/hoteis/${h.id}` }))
    return out
  }, [empresas, funcionarios, hoteis])

  const fuse = useMemo(() => new Fuse(searchItems, { keys: ['nome', 'sub'], threshold: 0.35, includeScore: true }), [searchItems])
  const results = useMemo(() => searchQuery.trim() ? fuse.search(searchQuery).slice(0, 8).map((r) => r.item) : [], [fuse, searchQuery])

  function goTo(href: string) {
    setSearchOpen(false); setSearchQuery('')
    router.push(href)
  }

  if (!user) return null

  return (
    <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-bbt-gray-100 dark:border-slate-800">
      <div className="px-6 py-3 grid grid-cols-[1fr_auto_1fr] items-center gap-4">

        {/* Esquerda — Busca global */}
        <div ref={searchRef} className="relative justify-self-start w-full max-w-md">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400 pointer-events-none z-10" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true) }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Busca global: empresas, funcionários, hotéis..."
              autoComplete="off"
              className="w-full h-10 pl-11 pr-9 rounded-lg border border-bbt-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 text-bbt-text dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-bbt-accent focus:border-transparent transition text-sm"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setSearchOpen(false) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 z-10"
                aria-label="Limpar">
                <span className="text-lg leading-none">×</span>
              </button>
            )}
          </div>

          {searchOpen && searchQuery.trim() && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-bbt-gray-100 dark:border-slate-700 overflow-hidden z-50 max-h-96 overflow-y-auto">
              {results.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-400">Nada encontrado para "{searchQuery}"</div>
              ) : (
                results.map((r) => {
                  const TypeIcon = r.type === 'empresa' ? Building2 : r.type === 'funcionario' ? Users : HotelIcon
                  return (
                    <button key={r.type + r.id} onClick={() => goTo(r.href)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-bbt-gray-50 dark:hover:bg-slate-900/50 transition text-left">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        r.type === 'empresa' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600'
                        : r.type === 'funcionario' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                        : 'bg-green-100 dark:bg-green-900/30 text-green-600'
                      }`}>
                        <TypeIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-bbt-text dark:text-slate-100 truncate">{r.nome}</div>
                        <div className="text-xs text-slate-500 truncate">{r.sub}</div>
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{r.type}</span>
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* CENTRO — Perfil (CENTRALIZADO) */}
        <div ref={profileRef} className="relative justify-self-center">
          <button onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-bbt-gray-50 dark:hover:bg-slate-800 transition border border-transparent hover:border-bbt-gray-100 dark:hover:border-slate-700">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-bbt-primary to-bbt-primary-light flex items-center justify-center text-white font-bold text-sm shrink-0 ring-2 ring-bbt-accent/20">
              {user.name.split(' ').slice(0, 2).map((n) => n[0]).join('')}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-sm font-semibold text-bbt-primary dark:text-white leading-tight">{user.name}</div>
              <div className="text-[11px] text-slate-500 leading-tight">
                {user.perfil_bbt ? perfilBBTLabel(user.perfil_bbt) : roleLabel(user.role)}
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition ${profileOpen ? 'rotate-180' : ''}`} />
          </button>

          {profileOpen && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-bbt-gray-100 dark:border-slate-700 overflow-hidden z-50">
              <div className="p-4 bg-gradient-to-br from-bbt-primary to-bbt-primary-light text-white">
                <div className="font-semibold truncate">{user.name}</div>
                <div className="text-xs opacity-90 truncate">{user.email}</div>
                <div className="mt-1 flex gap-1 flex-wrap">
                  <span className="text-[10px] bg-white/20 backdrop-blur px-2 py-0.5 rounded-full">
                    {user.perfil_bbt ? perfilBBTLabel(user.perfil_bbt) : roleLabel(user.role)}
                  </span>
                </div>
              </div>
              <div className="p-1">
                {user.role === 'master' && (
                  <Link href="/dashboard/meu-perfil" onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-bbt-gray-50 dark:hover:bg-slate-900 text-bbt-text dark:text-slate-200 transition">
                    <UserCircle2 className="w-4 h-4 text-bbt-accent" /> Meu Perfil (minhas demandas)
                  </Link>
                )}
                <Link href="/dashboard/configuracoes" onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-bbt-gray-50 dark:hover:bg-slate-900 text-bbt-text dark:text-slate-200 transition">
                  <Settings className="w-4 h-4 text-slate-500" /> Configurações
                </Link>
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition">
                  <LogOut className="w-4 h-4" /> Sair
                </button>
              </div>
            </div>
          )}
        </div>

        {/* DIREITA — Ações rápidas */}
        <div className="flex items-center gap-2 justify-self-end">
          <button onClick={toggleDark}
            className="p-2.5 rounded-lg hover:bg-bbt-gray-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
            title={darkMode ? 'Modo claro' : 'Modo escuro'}>
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  )
}
