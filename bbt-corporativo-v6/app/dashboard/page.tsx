'use client'
import { useStore } from '@/lib/store'
import { useMemo, useEffect, useState } from 'react'
import { getEstatisticas, seedAtendimentosDemo } from '@/lib/atendimentos-storage'
import { getCurrentUser, getAgentesBBT } from '@/lib/auth'
import {
  Building2, Users, Hotel as HotelIcon, TrendingUp, MapPin, DollarSign,
  FileText, Percent, ArrowUpRight,
} from 'lucide-react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import type { Cargo } from '@/types'

const CHART_COLORS = ['#00BFFF', '#0A2540', '#1e4976', '#86efac', '#fcd34d', '#d8b4fe']

export default function DashboardPage() {
  const { empresas, funcionarios, hoteis } = useStore()
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const user = getCurrentUser()
    if (user) {
      const agentesIds = getAgentesBBT().map((a) => a.id)
      seedAtendimentosDemo(empresas.map((e) => e.id), agentesIds)
      setReload((n) => n + 1)
    }
  }, [empresas])

  const stats = useMemo(() => getEstatisticas(), [reload])

  const funcsPorCargo = useMemo(() => {
    const count: Record<Cargo, number> = { Diretor: 0, Gerente: 0, Colaborador: 0 }
    funcionarios.forEach((f) => {
      const c = f.cargo as Cargo
      if (count[c] !== undefined) count[c]++
    })
    return [
      { name: 'Diretor', value: count.Diretor, color: '#9333ea' },
      { name: 'Gerente', value: count.Gerente, color: '#2563eb' },
      { name: 'Colaborador', value: count.Colaborador, color: '#16a34a' },
    ].filter((d) => d.value > 0)
  }, [funcionarios])

  const hoteisPorUF = useMemo(() => {
    const agg: Record<string, number> = {}
    hoteis.forEach((h) => { agg[h.uf] = (agg[h.uf] || 0) + 1 })
    return Object.entries(agg).map(([uf, total]) => ({ uf, total: total as number })).sort((a, b) => b.total - a.total).slice(0, 6)
  }, [hoteis])

  const topCidades = useMemo(() => {
    const agg: Record<string, number> = {}
    hoteis.forEach((h) => { const key = `${h.cidade} · ${h.uf}`; agg[key] = (agg[key] || 0) + 1 })
    return Object.entries(agg).map(([cidade, total]) => ({ cidade, total: total as number })).sort((a, b) => b.total - a.total).slice(0, 6)
  }, [hoteis])

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-bbt-primary dark:text-white">Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Visão geral do sistema e indicadores financeiros</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Empresas" value={empresas.length} icon={Building2} color="purple"
          trend={`${empresas.filter((e) => e.ativa).length} ativas`} href="/dashboard/empresas" />
        <KPICard label="Funcionários" value={funcionarios.length} icon={Users} color="blue"
          trend={`${funcionarios.filter((f) => f.ativo).length} ativos`} href="/dashboard/funcionarios" />
        <KPICard label="Hotéis" value={hoteis.length} icon={HotelIcon} color="green"
          trend={`${new Set(hoteis.map((h) => h.uf)).size} estados`} href="/dashboard/hoteis" />
        <KPICard label="Demandas" value={stats.total} icon={FileText} color="amber"
          trend={`${stats.por_status.finalizado} finalizadas`} href="/dashboard/meu-perfil" />
      </div>

      <div>
        <h2 className="text-lg font-bold text-bbt-primary dark:text-white mb-3 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-600" /> Indicadores Financeiros Consolidados
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <FinanceiroKPI label="Custo total (pagamos)" value={stats.custo_total} color="orange" />
          <FinanceiroKPI label="Markup (lucro)" value={stats.markup_total} color="green"
            subtitle={`${stats.margem_media_pct.toFixed(1)}% margem`} />
          <FinanceiroKPI label="Taxas cobradas" value={stats.taxa_total} color="purple" />
          <FinanceiroKPI label="Faturado total" value={stats.faturado_total} color="bbt" big />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bbt-card p-6">
          <h3 className="font-semibold text-bbt-primary dark:text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-bbt-accent" /> Funcionários por Cargo
          </h3>
          {funcsPorCargo.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Sem dados</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={funcsPorCargo} cx="50%" cy="50%" outerRadius={90} dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}>
                  {funcsPorCargo.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bbt-card p-6">
          <h3 className="font-semibold text-bbt-primary dark:text-white mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-bbt-accent" /> Hotéis por Estado
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={hoteisPorUF}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="uf" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
              <Bar dataKey="total" fill="#00BFFF" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bbt-card p-6">
          <h3 className="font-semibold text-bbt-primary dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-bbt-accent" /> Top Cidades com Hotéis
          </h3>
          {topCidades.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Sem dados</div>
          ) : (
            <div className="space-y-2">
              {topCidades.map((c, i) => {
                const max = topCidades[0].total
                const pct = (c.total / max) * 100
                return (
                  <div key={c.cidade}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-bbt-text dark:text-slate-200">{c.cidade}</span>
                      <span className="text-sm font-bold text-bbt-accent">{c.total}</span>
                    </div>
                    <div className="h-2 bg-bbt-gray-50 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${CHART_COLORS[i % CHART_COLORS.length]}, ${CHART_COLORS[(i + 1) % CHART_COLORS.length]})` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bbt-card p-6">
          <h3 className="font-semibold text-bbt-primary dark:text-white mb-4 flex items-center gap-2">
            <Percent className="w-5 h-5 text-bbt-accent" /> Demandas por Status
          </h3>
          {stats.total === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Nenhuma demanda registrada</div>
          ) : (
            <div className="space-y-2">
              {(Object.entries(stats.por_status) as [string, number][]).filter(([, v]) => v > 0).map(([st, v], i) => {
                const total = stats.total
                const pct = total > 0 ? (v / total) * 100 : 0
                const label = st === 'em_andamento' ? 'Em Andamento' : st === 'aguardando_cliente' ? 'Aguardando Cliente' : st === 'finalizado' ? 'Finalizado' : st === 'cancelado' ? 'Cancelado' : 'Pendente'
                return (
                  <div key={st}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-bbt-text dark:text-slate-200">{label}</span>
                      <span className="text-sm text-slate-500">{v} <span className="text-xs">({pct.toFixed(0)}%)</span></span>
                    </div>
                    <div className="h-2 bg-bbt-gray-50 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function KPICard({ label, value, icon: Icon, color, trend, href }: { label: string; value: number; icon: any; color: string; trend?: string; href?: string }) {
  const colors: Record<string, string> = {
    purple: 'from-purple-500 to-purple-700',
    blue: 'from-blue-500 to-blue-700',
    green: 'from-green-500 to-green-700',
    amber: 'from-amber-500 to-orange-600',
  }
  const content = (
    <div className="bbt-card p-5 relative overflow-hidden group hover:shadow-lg transition cursor-pointer">
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colors[color]} opacity-10 rounded-full -translate-y-8 translate-x-8 group-hover:scale-110 transition`} />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
          <div className="text-3xl font-bold text-bbt-primary dark:text-white mt-2">{value}</div>
          {trend && <div className="text-xs text-slate-500 mt-1">{trend}</div>}
        </div>
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center text-white shadow-md`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {href && <ArrowUpRight className="absolute bottom-3 right-3 w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-bbt-accent transition" />}
    </div>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

function FinanceiroKPI({ label, value, color, subtitle, big = false }: {
  label: string; value: number; color: string; subtitle?: string; big?: boolean
}) {
  const colors: Record<string, string> = {
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800/50',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/50',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/50',
    bbt: 'bg-gradient-to-br from-bbt-primary to-bbt-primary-light text-white shadow-lg border-transparent',
  }
  return (
    <div className={`rounded-xl p-5 border ${colors[color]}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider opacity-80">{label}</div>
      <div className={`${big ? 'text-3xl' : 'text-2xl'} font-bold mt-1`}>{formatCurrency(value)}</div>
      {subtitle && <div className="text-[11px] opacity-75 mt-0.5">{subtitle}</div>}
    </div>
  )
}
