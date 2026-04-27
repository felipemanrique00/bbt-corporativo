'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import { getCurrentUser } from '@/lib/auth'
import { getAllAtendimentos } from '@/lib/atendimentos-storage'
import {
  executarReconciliacao, resolverAlerta, contarAlertasPorSeveridade,
  type AlertaInconsistencia, type SeveridadeAlerta,
} from '@/lib/reconciliacao'
import {
  ShieldAlert, ShieldCheck, AlertCircle, AlertTriangle, Info,
  Play, CheckCircle2, ExternalLink, Building2, User as UserIcon, FileText,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'

const CORES: Record<SeveridadeAlerta, { bg: string; text: string; border: string; icon: any; label: string }> = {
  critico: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300', border: 'border-red-300 dark:border-red-700', icon: ShieldAlert, label: 'Crítico' },
  alto: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-300 dark:border-orange-700', icon: AlertTriangle, label: 'Alto' },
  medio: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-700', icon: AlertCircle, label: 'Médio' },
  baixo: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-700', icon: Info, label: 'Baixo' },
  info: { bg: 'bg-slate-50 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-300 dark:border-slate-600', icon: Info, label: 'Info' },
}

export default function ReconciliacaoPage() {
  const user = typeof window !== 'undefined' ? getCurrentUser() : null
  const { empresas, funcionarios } = useStore()
  const [alertas, setAlertas] = useState<AlertaInconsistencia[]>([])
  const [filtro, setFiltro] = useState<SeveridadeAlerta | 'todos'>('todos')
  const [contagem, setContagem] = useState({ critico: 0, alto: 0, medio: 0, baixo: 0, info: 0 })
  const [executando, setExecutando] = useState(false)

  function rodarReconciliacao() {
    setExecutando(true)
    const atendimentos = getAllAtendimentos()
    const lista = executarReconciliacao({ atendimentos, empresas, funcionarios })
    setAlertas(lista)
    setContagem(contarAlertasPorSeveridade())
    setExecutando(false)
    toast.success(`Análise concluída: ${lista.length} alerta(s)`)
  }

  useEffect(() => {
    rodarReconciliacao()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtrados = useMemo(() => {
    if (filtro === 'todos') return alertas
    return alertas.filter((a) => a.severidade === filtro)
  }, [alertas, filtro])

  function handleResolver(a: AlertaInconsistencia) {
    if (!user) return
    resolverAlerta(a.id, user.id, user.name)
    setAlertas((prev) => prev.filter((x) => x.id !== a.id))
    setContagem(contarAlertasPorSeveridade())
    toast.success('Alerta marcado como resolvido')
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-bbt-primary dark:text-white flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-bbt-accent" /> Reconciliação
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Detecta inconsistências entre demandas, vouchers, emissões e financeiro
          </p>
        </div>
        <button onClick={rodarReconciliacao} disabled={executando}
          className="bbt-button-primary flex items-center gap-2 text-sm">
          {executando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Rodar análise
        </button>
      </div>

      {/* Cards de severidade */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(['critico', 'alto', 'medio', 'baixo', 'info'] as SeveridadeAlerta[]).map((sev) => {
          const c = CORES[sev]
          const Icon = c.icon
          const count = contagem[sev]
          return (
            <button key={sev} onClick={() => setFiltro(sev)}
              className={`p-4 rounded-xl border-2 text-left transition ${
                filtro === sev ? `${c.border} ${c.bg}` : 'border-bbt-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-bbt-gray-200'
              }`}>
              <Icon className={`w-5 h-5 mb-2 ${c.text}`} />
              <div className="text-2xl font-bold">{count}</div>
              <div className={`text-xs uppercase tracking-wider ${c.text}`}>{c.label}</div>
            </button>
          )
        })}
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFiltro('todos')}
          className={`text-xs px-3 py-1.5 rounded-lg ${filtro === 'todos' ? 'bg-bbt-accent text-white' : 'bg-bbt-gray-50 dark:bg-slate-800 text-slate-600 hover:bg-bbt-gray-100'}`}>
          Todos ({alertas.length})
        </button>
        {(['critico', 'alto', 'medio', 'baixo'] as SeveridadeAlerta[]).map((s) => (
          <button key={s} onClick={() => setFiltro(s)}
            className={`text-xs px-3 py-1.5 rounded-lg ${filtro === s ? CORES[s].bg + ' ' + CORES[s].text + ' ring-2 ' + CORES[s].border : 'bg-bbt-gray-50 dark:bg-slate-800 text-slate-600'}`}>
            {CORES[s].label} ({contagem[s]})
          </button>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <div className="bbt-card p-12 text-center">
          <ShieldCheck className="w-14 h-14 mx-auto text-green-500 mb-3" />
          <h3 className="font-semibold text-lg text-slate-700 dark:text-slate-200">Tudo em ordem</h3>
          <p className="text-sm text-slate-500 mt-1">
            {alertas.length === 0
              ? 'Nenhuma inconsistência detectada.'
              : 'Nenhum alerta com este filtro.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((a) => {
            const c = CORES[a.severidade]
            const Icon = c.icon
            return (
              <div key={a.id} className={`bbt-card p-4 border-l-4 ${c.border}`}>
                <div className="flex items-start gap-3">
                  <Icon className={`w-5 h-5 ${c.text} shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <strong className="text-sm">{a.titulo}</strong>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${c.bg} ${c.text}`}>
                        {c.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">{a.descricao}</p>

                    {a.entidades.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {a.entidades.slice(0, 5).map((e, i) => {
                          const link = e.tipo === 'Empresa' ? `/dashboard/empresas/${e.id}`
                            : e.tipo === 'Funcionario' ? `/dashboard/funcionarios`
                            : null
                          const inner = (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 inline-flex items-center gap-1">
                              {e.tipo === 'Empresa' && <Building2 className="w-2.5 h-2.5" />}
                              {e.tipo === 'Funcionario' && <UserIcon className="w-2.5 h-2.5" />}
                              {e.tipo === 'Atendimento' && <FileText className="w-2.5 h-2.5" />}
                              {e.nome || e.id}
                              {link && <ExternalLink className="w-2.5 h-2.5 opacity-60" />}
                            </span>
                          )
                          return link
                            ? <Link key={i} href={link} className="hover:underline">{inner}</Link>
                            : <span key={i}>{inner}</span>
                        })}
                        {a.entidades.length > 5 && (
                          <span className="text-[10px] text-slate-400">+ {a.entidades.length - 5} mais</span>
                        )}
                      </div>
                    )}

                    {a.sugestao_acao && (
                      <div className="text-[11px] italic text-slate-500 dark:text-slate-400">
                        💡 {a.sugestao_acao}
                      </div>
                    )}
                  </div>
                  <button onClick={() => handleResolver(a)}
                    className="text-xs bbt-button-ghost flex items-center gap-1 shrink-0"
                    title="Marcar como resolvido (não aparecerá mais)">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Resolver
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
