'use client'
import { useState, useMemo } from 'react'
import { useStore } from '@/lib/store'
import { FileBarChart, Building2, User, Calendar, ArrowRight, Download, TrendingUp } from 'lucide-react'
import { getAgentesBBT, perfilBBTLabel } from '@/lib/auth'
import { SearchInput } from '@/components/ui/search-input'
import { getEstatisticas } from '@/lib/atendimentos-storage'
import { formatCurrency } from '@/lib/utils'

export default function RelatoriosPage() {
  const { empresas } = useStore()

  const hoje = new Date().toISOString().slice(0, 10)
  const trintaDias = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

  const [dataInicio, setDataInicio] = useState(trintaDias)
  const [dataFim, setDataFim] = useState(hoje)
  const [busca, setBusca] = useState('')

  const agentesBBT = useMemo(() => {
    if (typeof window === 'undefined') return []
    return getAgentesBBT()
  }, [])

  const filteredEmpresas = useMemo(() => {
    if (!busca.trim()) return empresas
    const q = busca.toLowerCase()
    return empresas.filter((e) => e.nome.toLowerCase().includes(q) || e.cnpj.includes(q))
  }, [empresas, busca])

  function abrirRelatorioEmpresa(empresaId: string) {
    window.open(`/relatorios/empresa?empresa=${empresaId}&inicio=${dataInicio}&fim=${dataFim}`, '_blank')
  }
  function abrirRelatorioAgente(agenteId: string) {
    window.open(`/relatorios/agente?agente=${agenteId}&inicio=${dataInicio}&fim=${dataFim}`, '_blank')
  }
  function setPeriodoRapido(dias: number) {
    setDataInicio(new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10))
    setDataFim(hoje)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-bbt-primary dark:text-white flex items-center gap-3">
          <FileBarChart className="w-8 h-8 text-bbt-accent" /> Relatórios
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Gere relatórios PDF por empresa ou por agente, com filtro de período
        </p>
      </div>

      <div className="bbt-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-5 h-5 text-bbt-accent" />
          <h3 className="font-semibold text-bbt-primary dark:text-white">Período do relatório</h3>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="bbt-input w-auto" />
          <span className="text-slate-400">até</span>
          <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="bbt-input w-auto" />
          <div className="flex gap-1 ml-2">
            <button onClick={() => setPeriodoRapido(7)} className="bbt-button-ghost text-xs px-2 py-1">7 dias</button>
            <button onClick={() => setPeriodoRapido(30)} className="bbt-button-ghost text-xs px-2 py-1">30 dias</button>
            <button onClick={() => setPeriodoRapido(90)} className="bbt-button-ghost text-xs px-2 py-1">90 dias</button>
            <button onClick={() => setPeriodoRapido(365)} className="bbt-button-ghost text-xs px-2 py-1">1 ano</button>
          </div>
        </div>
      </div>

      <div className="bbt-card overflow-hidden">
        <div className="p-5 border-b border-bbt-gray-100 dark:border-slate-700 bg-gradient-to-r from-bbt-primary/5 to-transparent dark:from-bbt-accent/10">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-semibold text-bbt-primary dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-bbt-accent" /> Relatório por Empresa
              </h3>
              <p className="text-xs text-slate-500 mt-1">Custos, markup, taxas e faturado detalhados por empresa cliente</p>
            </div>
            <div className="w-72">
              <SearchInput value={busca} onChangeValue={setBusca} placeholder="Filtrar empresa..." size="sm" />
            </div>
          </div>
        </div>
        <div className="divide-y divide-bbt-gray-100 dark:divide-slate-700 max-h-[500px] overflow-y-auto">
          {filteredEmpresas.length === 0 ? (
            <div className="p-8 text-center text-slate-400">Nenhuma empresa encontrada.</div>
          ) : filteredEmpresas.map((emp) => {
            const stats = getEstatisticas({ empresa_id: emp.id, data_inicio: dataInicio, data_fim: dataFim })
            return (
              <button key={emp.id} onClick={() => abrirRelatorioEmpresa(emp.id)}
                className="w-full p-4 hover:bg-bbt-gray-50 dark:hover:bg-slate-900/30 transition flex items-center gap-4 text-left group">
                <div className="w-11 h-11 rounded-lg bg-bbt-accent/10 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-bbt-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-bbt-primary dark:text-white truncate">{emp.nome}</div>
                  <div className="text-xs text-slate-500">{emp.cnpj}</div>
                  {stats.total > 0 && (
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] flex-wrap">
                      <span className="text-slate-500">{stats.total} demanda{stats.total > 1 ? 's' : ''}</span>
                      {stats.markup_total > 0 && (
                        <span className="text-green-600 dark:text-green-400 font-semibold flex items-center gap-0.5">
                          <TrendingUp className="w-3 h-3" /> Markup {formatCurrency(stats.markup_total)}
                        </span>
                      )}
                      {stats.faturado_total > 0 && (
                        <span className="text-bbt-primary dark:text-bbt-accent font-semibold">
                          Faturado {formatCurrency(stats.faturado_total)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 text-bbt-accent opacity-0 group-hover:opacity-100 transition">
                  <Download className="w-4 h-4" />
                  <span className="text-xs font-semibold">Gerar PDF</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="bbt-card overflow-hidden">
        <div className="p-5 border-b border-bbt-gray-100 dark:border-slate-700 bg-gradient-to-r from-bbt-primary/5 to-transparent dark:from-bbt-accent/10">
          <h3 className="font-semibold text-bbt-primary dark:text-white flex items-center gap-2">
            <User className="w-5 h-5 text-bbt-accent" /> Relatório por Agente
          </h3>
          <p className="text-xs text-slate-500 mt-1">Produtividade individual dos agentes BBT</p>
        </div>
        <div className="divide-y divide-bbt-gray-100 dark:divide-slate-700">
          {agentesBBT.map((a) => {
            const stats = getEstatisticas({ agente_user_id: a.id, data_inicio: dataInicio, data_fim: dataFim })
            return (
              <button key={a.id} onClick={() => abrirRelatorioAgente(a.id)}
                className="w-full p-4 hover:bg-bbt-gray-50 dark:hover:bg-slate-900/30 transition flex items-center gap-4 text-left group">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-bbt-primary to-bbt-primary-light flex items-center justify-center text-white font-bold shrink-0">
                  {a.name.split(' ').slice(0, 2).map((n) => n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-bbt-primary dark:text-white truncate">{a.name}</div>
                  <div className="text-xs text-slate-500">{a.email} · {perfilBBTLabel(a.perfil_bbt)}</div>
                  {stats.total > 0 && (
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] flex-wrap">
                      <span className="text-slate-500">{stats.total} demanda{stats.total > 1 ? 's' : ''}</span>
                      {stats.markup_total > 0 && (
                        <span className="text-green-600 dark:text-green-400 font-semibold">
                          Markup {formatCurrency(stats.markup_total)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 text-bbt-accent opacity-0 group-hover:opacity-100 transition">
                  <Download className="w-4 h-4" />
                  <span className="text-xs font-semibold">Gerar PDF</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
