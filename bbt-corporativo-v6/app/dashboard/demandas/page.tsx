'use client'
import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { getCurrentUser, getAllUsers, hasPermission } from '@/lib/auth'
import { getAllAtendimentos } from '@/lib/atendimentos-storage'
import {
  analisarRepasses, executarRepasse, pegarDemanda,
  calcularPrioridadeAuto, diasAteCheckin, formatarDiasCheckin, corPrioridade, scorePrioridade,
} from '@/lib/priorizacao'
import type { Atendimento, Prioridade, StatusAtendimento } from '@/types'
import { labelOcupante } from '@/types'
import {
  ListChecks, Users as UsersIcon, Clock, AlertTriangle, Zap, Hand,
  ArrowRightLeft, CheckCircle2, Calendar, Hotel as HotelIcon, Plane, Car,
  Package, Filter, RefreshCw, UserCheck, Award, TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/modal'
import { SearchInput } from '@/components/ui/search-input'

type Aba = 'fila' | 'minhas' | 'balanceamento' | 'kanban'

export default function DemandasPage() {
  const router = useRouter()
  const { empresas } = useStore()
  const user = typeof window !== 'undefined' ? getCurrentUser() : null
  const podeVerTudo = hasPermission(user, 'ver_produtividade_todos')

  const [aba, setAba] = useState<Aba>('fila')
  const [reload, setReload] = useState(0)
  const [filtroEmpresa, setFiltroEmpresa] = useState('')
  const [busca, setBusca] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'Hotel' | 'Aéreo' | 'Carro' | 'Pacote'>('todos')
  const [repasseModal, setRepasseModal] = useState<Atendimento | null>(null)

  const agentes = useMemo(() => {
    if (typeof window === 'undefined') return []
    return getAllUsers().filter((u) => u.perfil_bbt && u.ativo !== false)
  }, [reload])

  const atendimentos = useMemo(() => {
    if (typeof window === 'undefined') return []
    const all = getAllAtendimentos()

    let filtrados = all.filter((a) => ['em_andamento', 'aguardando_cliente', 'pendente'].includes(a.status))

    if (!podeVerTudo && user) {
      filtrados = filtrados.filter((a) => a.agente_user_id === user.id || !a.agente_user_id)
    }

    if (filtroEmpresa) filtrados = filtrados.filter((a) => a.empresa_id === filtroEmpresa)
    if (tipoFiltro !== 'todos') filtrados = filtrados.filter((a) => a.tipo_servico === tipoFiltro)
    if (busca.trim()) {
      const q = busca.toLowerCase()
      filtrados = filtrados.filter((a) =>
        a.passageiro_nome.toLowerCase().includes(q) ||
        empresas.find((e) => e.id === a.empresa_id)?.nome.toLowerCase().includes(q)
      )
    }

    // Enriquecer com prioridade calculada e dias
    return filtrados.map((a) => ({
      ...a,
      _prioridade: calcularPrioridadeAuto(a),
      _dias: diasAteCheckin(a),
      _score: scorePrioridade(a),
    }))
  }, [reload, filtroEmpresa, tipoFiltro, busca, empresas, podeVerTudo, user])

  const analise = useMemo(() => {
    if (typeof window === 'undefined') return { sugestoes: [], carga_por_agente: {} }
    return analisarRepasses(getAllAtendimentos())
  }, [reload])

  const minhas = useMemo(() => {
    return atendimentos.filter((a) => a.agente_user_id === user?.id).sort((a: any, b: any) => b._score - a._score)
  }, [atendimentos, user])

  const fila = useMemo(() => {
    return atendimentos
      .filter((a) => !a.agente_user_id || a.em_atendimento === false)
      .sort((a: any, b: any) => b._score - a._score)
  }, [atendimentos])

  function refresh() { setReload((n) => n + 1) }

  function handlePegar(a: Atendimento) {
    if (!user) return
    if (pegarDemanda(a, user.id, user.name)) {
      toast.success(`Demanda "${a.passageiro_nome}" agora é sua`)
      refresh()
    } else {
      toast.error('Erro ao pegar demanda')
    }
  }

  function handleRepassar(a: Atendimento, novoAgenteId: string) {
    if (!user) return
    const ag = agentes.find((x) => x.id === novoAgenteId)
    if (!ag) return
    if (executarRepasse(a, ag.id, ag.name, user.id, user.name, repasseModal ? 'Repasse manual' : 'Redistribuição')) {
      toast.success(`Repassado para ${ag.name}`)
      setRepasseModal(null)
      refresh()
    }
  }

  function handleAplicarSugestao(sug: any) {
    if (!user) return
    const ag = agentes.find((x) => x.id === sug.agente_sugerido)
    if (!ag) return
    if (executarRepasse(sug.atendimento, ag.id, ag.name, user.id, user.name, sug.motivo)) {
      toast.success(`Demanda "${sug.atendimento.passageiro_nome}" → ${ag.name}`)
      refresh()
    }
  }

  function aplicarTodasSugestoes() {
    if (!user) return
    let ok = 0
    for (const sug of analise.sugestoes.slice(0, 20)) {
      const ag = agentes.find((x) => x.id === sug.agente_sugerido)
      if (!ag) continue
      if (executarRepasse(sug.atendimento, ag.id, ag.name, user.id, user.name, sug.motivo)) ok++
    }
    toast.success(`${ok} demandas redistribuídas`)
    refresh()
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-bbt-primary dark:text-white flex items-center gap-3">
            <ListChecks className="w-8 h-8 text-bbt-accent" /> Demandas da Equipe
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Fluxo inteligente de distribuição por prioridade
          </p>
        </div>
        <button onClick={refresh} className="bbt-button-ghost flex items-center gap-2 text-sm">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-bbt-gray-50 dark:bg-slate-800 p-1 rounded-lg w-fit overflow-x-auto">
        <BtnAba active={aba === 'fila'} onClick={() => setAba('fila')} icon={Hand} label={`Fila (${fila.length})`} />
        <BtnAba active={aba === 'minhas'} onClick={() => setAba('minhas')} icon={UserCheck} label={`Minhas (${minhas.length})`} />
        {podeVerTudo && (
          <>
            <BtnAba active={aba === 'balanceamento'} onClick={() => setAba('balanceamento')} icon={ArrowRightLeft}
              label={`Balanceamento${analise.sugestoes.length > 0 ? ` (${analise.sugestoes.length})` : ''}`}
              badge={analise.sugestoes.length > 0} />
            <BtnAba active={aba === 'kanban'} onClick={() => setAba('kanban')} icon={UsersIcon} label="Equipe" />
          </>
        )}
      </div>

      {/* Filtros */}
      <div className="bbt-card p-3 flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px]">
          <SearchInput value={busca} onChangeValue={setBusca} placeholder="Buscar passageiro..." />
        </div>
        <select value={filtroEmpresa} onChange={(e) => setFiltroEmpresa(e.target.value)} className="bbt-input max-w-xs">
          <option value="">Todas empresas</option>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
        <div className="flex gap-1">
          {(['todos', 'Hotel', 'Aéreo', 'Carro', 'Pacote'] as const).map((t) => (
            <button key={t} onClick={() => setTipoFiltro(t)}
              className={`text-xs px-3 py-1.5 rounded-lg transition ${
                tipoFiltro === t ? 'bg-bbt-accent text-white' : 'bg-bbt-gray-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-bbt-gray-100'
              }`}>{t}</button>
          ))}
        </div>
      </div>

      {/* ABA: FILA (demandas sem agente) */}
      {aba === 'fila' && (
        <div>
          {fila.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Nenhuma demanda na fila"
              subtitle="Todas as demandas têm agente responsável" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {fila.map((a) => (
                <DemandaCard key={a.id} demanda={a as any} empresas={empresas} agentes={agentes}
                  onPegar={() => handlePegar(a)}
                  onRepassar={() => setRepasseModal(a)}
                  showAgente />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ABA: MINHAS */}
      {aba === 'minhas' && (
        <div>
          {minhas.length === 0 ? (
            <EmptyState icon={UserCheck} title="Você não tem demandas abertas"
              subtitle="Veja a Fila pra pegar as que estão disponíveis" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {minhas.map((a) => (
                <DemandaCard key={a.id} demanda={a as any} empresas={empresas} agentes={agentes}
                  onRepassar={() => setRepasseModal(a)}
                  isOwn />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ABA: BALANCEAMENTO (só master/supervisor) */}
      {aba === 'balanceamento' && podeVerTudo && (
        <div className="space-y-4">
          {/* Carga por agente */}
          <div className="bbt-card p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-bbt-accent" /> Carga da equipe
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(analise.carga_por_agente).map(([uid, c]: any) => (
                <div key={uid} className="p-3 rounded-lg border border-bbt-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{c.nome}</span>
                    <span className="text-xs font-bold text-bbt-primary dark:text-white">{c.total}</span>
                  </div>
                  <div className="flex gap-1 text-[10px] flex-wrap">
                    {c.urgentes > 0 && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">🚨 {c.urgentes} urg</span>}
                    {c.altas > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">⚡ {c.altas} alta</span>}
                    {c.medias > 0 && <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">📅 {c.medias} média</span>}
                    {c.baixas > 0 && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-700">📆 {c.baixas} baixa</span>}
                  </div>
                  {c.mais_urgente_dias !== null && c.mais_urgente_dias <= 3 && (
                    <div className="mt-2 text-[10px] text-red-600 dark:text-red-400 font-semibold">
                      ⚠ Check-in mais próximo: {formatarDiasCheckin(c.mais_urgente_dias)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Sugestões de repasse */}
          {analise.sugestoes.length > 0 ? (
            <div className="bbt-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Sugestões de repasse ({analise.sugestoes.length})
                </h3>
                <button onClick={aplicarTodasSugestoes} className="bbt-button-primary text-xs flex items-center gap-1">
                  <ArrowRightLeft className="w-3 h-3" /> Aplicar todas
                </button>
              </div>
              <div className="space-y-2">
                {analise.sugestoes.map((sug) => {
                  const agAtual = agentes.find((x) => x.id === sug.agente_atual)
                  const agNovo = agentes.find((x) => x.id === sug.agente_sugerido)
                  const empresa = empresas.find((e) => e.id === sug.atendimento.empresa_id)
                  return (
                    <div key={sug.atendimento.id} className="p-3 rounded-lg border border-bbt-accent/30 bg-bbt-accent/5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-sm truncate">{sug.atendimento.passageiro_nome}</strong>
                          <span className="text-[10px] px-1.5 rounded bg-bbt-gray-100 dark:bg-slate-700">{empresa?.nome || '—'}</span>
                          <span className="text-[10px] font-semibold text-bbt-accent">{formatarDiasCheckin(sug.dias_checkin)}</span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                          <span className="text-red-600">{agAtual?.name || 'Sem agente'}</span>
                          <ArrowRightLeft className="w-3 h-3" />
                          <span className="text-green-600 font-semibold">{agNovo?.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 italic mt-0.5">{sug.motivo}</div>
                      </div>
                      <button onClick={() => handleAplicarSugestao(sug)}
                        className="bbt-button-primary text-xs whitespace-nowrap">
                        Aplicar
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <EmptyState icon={CheckCircle2} title="Tudo equilibrado"
              subtitle="Não há sugestões de repasse. A carga está bem distribuída" />
          )}
        </div>
      )}

      {/* ABA: KANBAN por agente */}
      {aba === 'kanban' && podeVerTudo && (
        <div className="overflow-x-auto">
          <div className="flex gap-3 min-w-max pb-3">
            {agentes.filter((u) => u.perfil_bbt !== 'gestor_financeiro').map((ag) => {
              const minhasAg = atendimentos.filter((a) => a.agente_user_id === ag.id)
                .sort((a: any, b: any) => b._score - a._score)
              return (
                <div key={ag.id} className="w-80 shrink-0">
                  <div className="bbt-card p-3 mb-2 flex items-center justify-between bg-bbt-primary text-white">
                    <div>
                      <div className="font-semibold text-sm">{ag.name}</div>
                      <div className="text-[10px] opacity-80">{minhasAg.length} demandas</div>
                    </div>
                    {(analise.carga_por_agente[ag.id]?.urgentes || 0) > 0 && (
                      <div className="bbt-badge bg-red-500 text-white text-[10px]">
                        {analise.carga_por_agente[ag.id].urgentes} urg
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                    {minhasAg.length === 0 ? (
                      <div className="text-xs text-slate-400 text-center p-6 border border-dashed rounded-lg border-bbt-gray-100 dark:border-slate-700">
                        Sem demandas
                      </div>
                    ) : (
                      minhasAg.map((a) => (
                        <DemandaCardMini key={a.id} demanda={a as any} empresas={empresas}
                          onClick={() => setRepasseModal(a)} />
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal de repasse manual */}
      <Modal open={!!repasseModal} onClose={() => setRepasseModal(null)}
        title={repasseModal ? `Repassar: ${repasseModal.passageiro_nome}` : ''}
        size="md">
        {repasseModal && (
          <div className="space-y-3">
            <div className="text-sm text-slate-600 dark:text-slate-400 p-3 rounded-lg bg-bbt-gray-50 dark:bg-slate-800">
              <div><strong>{repasseModal.passageiro_nome}</strong> · {repasseModal.tipo_servico}</div>
              <div className="text-xs mt-1">Check-in: {formatarDiasCheckin(diasAteCheckin(repasseModal))}</div>
              <div className="text-xs">Agente atual: {agentes.find((x) => x.id === repasseModal.agente_user_id)?.name || 'Sem agente'}</div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">Repassar para:</label>
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {agentes.filter((u) => u.id !== repasseModal.agente_user_id).map((ag) => {
                  const carga = analise.carga_por_agente[ag.id]
                  return (
                    <button key={ag.id} onClick={() => handleRepassar(repasseModal, ag.id)}
                      className="w-full flex items-center justify-between p-2 rounded-lg border border-bbt-gray-100 dark:border-slate-700 hover:bg-bbt-accent/5 hover:border-bbt-accent text-left transition">
                      <div>
                        <div className="text-sm font-medium">{ag.name}</div>
                        <div className="text-[10px] text-slate-500">{carga?.total || 0} demandas · {carga?.urgentes || 0} urgentes</div>
                      </div>
                      <ArrowRightLeft className="w-4 h-4 text-bbt-accent" />
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ============ Componentes auxiliares ============

function BtnAba({ active, onClick, icon: Icon, label, badge }: any) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition whitespace-nowrap relative ${
        active ? 'bg-white dark:bg-slate-700 text-bbt-primary dark:text-white shadow'
        : 'text-slate-500 dark:text-slate-400 hover:text-bbt-primary dark:hover:text-white'
      }`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
      {badge && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
    </button>
  )
}

function DemandaCard({ demanda, empresas, agentes, onPegar, onRepassar, isOwn, showAgente }: any) {
  const empresa = empresas.find((e: any) => e.id === demanda.empresa_id)
  const agente = agentes.find((x: any) => x.id === demanda.agente_user_id)
  const cor = corPrioridade(demanda._prioridade)
  const Icon = demanda.tipo_servico === 'Hotel' ? HotelIcon
    : demanda.tipo_servico === 'Aéreo' ? Plane
    : demanda.tipo_servico === 'Carro' ? Car : Package

  return (
    <div className={`bbt-card p-3 border-l-4 ${cor.border} ${cor.bg}`}>
      <div className="flex items-start gap-2 mb-2">
        <Icon className="w-4 h-4 text-bbt-accent shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <strong className="text-sm truncate">{demanda.passageiro_nome}</strong>
            <span className={`text-[10px] px-1.5 rounded font-semibold ${cor.text}`}>
              {demanda._prioridade.toUpperCase()}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{empresa?.nome || '—'}</div>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300 mb-2">
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {formatarDiasCheckin(demanda._dias)}
        </span>
        {showAgente && agente && (
          <span className="flex items-center gap-1">
            <UserCheck className="w-3 h-3" /> {agente.name}
          </span>
        )}
      </div>

      <div className="flex gap-1">
        {onPegar && !demanda.agente_user_id && (
          <button onClick={onPegar} className="flex-1 bbt-button-primary text-[11px] py-1.5 flex items-center justify-center gap-1">
            <Hand className="w-3 h-3" /> Pegar
          </button>
        )}
        {onRepassar && (
          <button onClick={onRepassar} className="flex-1 bbt-button-ghost text-[11px] py-1.5 flex items-center justify-center gap-1">
            <ArrowRightLeft className="w-3 h-3" /> Repassar
          </button>
        )}
      </div>
    </div>
  )
}

function DemandaCardMini({ demanda, empresas, onClick }: any) {
  const empresa = empresas.find((e: any) => e.id === demanda.empresa_id)
  const cor = corPrioridade(demanda._prioridade)
  return (
    <button onClick={onClick} className={`w-full text-left p-2 rounded-lg border-l-4 ${cor.border} ${cor.bg} hover:shadow transition`}>
      <div className="text-xs font-medium truncate">{demanda.passageiro_nome}</div>
      <div className="text-[10px] text-slate-500 truncate">{empresa?.nome || '—'}</div>
      <div className="text-[10px] font-semibold mt-0.5" style={{ color: cor.text.includes('red') ? '#dc2626' : cor.text.includes('amber') ? '#d97706' : cor.text.includes('blue') ? '#2563eb' : '#64748b' }}>
        {formatarDiasCheckin(demanda._dias)}
      </div>
    </button>
  )
}

function EmptyState({ icon: Icon, title, subtitle }: any) {
  return (
    <div className="bbt-card p-12 text-center">
      <Icon className="w-12 h-12 mx-auto text-bbt-gray-200 dark:text-slate-600 mb-3" />
      <h3 className="font-semibold text-slate-600 dark:text-slate-300">{title}</h3>
      <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
    </div>
  )
}
