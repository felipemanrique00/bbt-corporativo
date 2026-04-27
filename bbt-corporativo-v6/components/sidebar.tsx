'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Building2, Users, Hotel as HotelIcon, Settings,
  Plane, ChevronLeft, ChevronRight, UserCircle2, FileBarChart, Inbox,
  TrendingUp, FileSpreadsheet, Shield, ListChecks,
  ShieldAlert, Wallet, History,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getCurrentUser, hasPermission } from '@/lib/auth'
import type { User } from '@/types'

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => { setUser(getCurrentUser()) }, [])

  const showMeuPerfil = user?.role === 'master'
  const podeGerenciarUsuarios = hasPermission(user, 'gerenciar_usuarios')
  const podeImportarPlanilhas = hasPermission(user, 'importar_planilhas')
  const podeGerarRelatorios = hasPermission(user, 'gerar_relatorios')

  const podeFinanceiro = hasPermission(user, 'ver_financeiro') || hasPermission(user, 'gerenciar_usuarios')
  const NAV_BASE: { href: string; label: string; icon: any; highlight?: boolean; hidden?: boolean }[] = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/caixa-entrada', label: 'Caixa de Entrada', icon: Inbox, highlight: true },
    { href: '/dashboard/demandas', label: 'Demandas', icon: ListChecks, highlight: true },
    { href: '/dashboard/produtividade', label: 'Produtividade', icon: TrendingUp },
    { href: '/dashboard/empresas', label: 'Empresas', icon: Building2 },
    { href: '/dashboard/funcionarios', label: 'Funcionários', icon: Users },
    { href: '/dashboard/hoteis', label: 'Hotéis', icon: HotelIcon },
    { href: '/dashboard/financeiro', label: 'Financeiro', icon: Wallet, hidden: !podeFinanceiro },
    { href: '/dashboard/reconciliacao', label: 'Reconciliação', icon: ShieldAlert, hidden: !podeGerenciarUsuarios },
    { href: '/dashboard/relatorios', label: 'Relatórios', icon: FileBarChart, hidden: !podeGerarRelatorios },
    { href: '/dashboard/emissoes', label: 'Importar Emissões', icon: FileSpreadsheet, hidden: !podeImportarPlanilhas },
    { href: '/dashboard/auditoria', label: 'Auditoria', icon: History, hidden: !podeGerenciarUsuarios },
    { href: '/dashboard/usuarios', label: 'Usuários', icon: Shield, hidden: !podeGerenciarUsuarios },
    { href: '/dashboard/configuracoes', label: 'Configurações', icon: Settings },
  ]

  return (
    <aside
      className={cn(
        'h-screen sticky top-0 flex flex-col text-white transition-all duration-300 shadow-xl z-30',
        collapsed ? 'w-20' : 'w-64'
      )}
      style={{ background: 'linear-gradient(180deg, #0A2540 0%, #0e3a63 50%, #1e4976 100%)' }}
    >
      <div className="px-5 py-6 border-b border-white/10 flex items-center gap-3">
        <div className="bg-bbt-accent/20 p-2 rounded-xl shrink-0 ring-1 ring-bbt-accent/30">
          <Plane className="w-6 h-6 text-bbt-accent" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in min-w-0">
            <div className="font-bold text-sm leading-tight truncate">Sistema BBT</div>
            <div className="text-xs text-blue-100/70 truncate">Corporativo</div>
          </div>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {showMeuPerfil && (
          <>
            <Link href="/dashboard/meu-perfil"
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group mb-2 relative',
                pathname.startsWith('/dashboard/meu-perfil')
                  ? 'bg-bbt-accent text-bbt-primary font-semibold shadow-lg'
                  : 'bg-bbt-accent/20 text-white hover:bg-bbt-accent/30 border border-bbt-accent/30'
              )}
              title={collapsed ? 'Meu Perfil' : undefined}>
              <UserCircle2 className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="font-semibold text-sm animate-fade-in">Meu Perfil</span>}
            </Link>
            {!collapsed && <div className="border-t border-white/10 my-2" />}
          </>
        )}

        {NAV_BASE.filter((item) => !item.hidden).map((item) => {
          const Icon = item.icon
          const active = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          const isHighlight = item.highlight
          return (
            <Link key={item.href} href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative',
                active ? 'bg-bbt-accent/20 text-white shadow-inner' : 'text-blue-100/80 hover:bg-white/10 hover:text-white',
                isHighlight && !active && 'ring-1 ring-bbt-accent/40'
              )}
              title={collapsed ? item.label : undefined}>
              <Icon className={cn('w-5 h-5 shrink-0 transition', active && 'text-bbt-accent', isHighlight && !active && 'text-bbt-accent')} />
              {!collapsed && (
                <>
                  <span className="font-medium text-sm animate-fade-in">{item.label}</span>
                  {isHighlight && !active && (
                    <span className="ml-auto text-[9px] bg-bbt-accent text-bbt-primary px-1.5 py-0.5 rounded-full font-bold">NOVO</span>
                  )}
                </>
              )}
              {active && !collapsed && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-bbt-accent" />}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-white/10">
        <button onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-blue-100/80 hover:bg-white/10 hover:text-white transition text-sm">
          {collapsed ? <ChevronRight className="w-4 h-4" /> : (
            <><ChevronLeft className="w-4 h-4" /><span className="text-xs">Recolher</span></>
          )}
        </button>
      </div>
    </aside>
  )
}
