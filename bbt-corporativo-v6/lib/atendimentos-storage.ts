// ============================================================
// Storage de Atendimentos + Logs + Estatísticas Financeiras
// ============================================================
import type {
  Atendimento, LogAuditoria, StatusAtendimento, Prioridade, TipoServico,
} from '@/types'
import { calcularFinanceiro } from '@/types'

const STORAGE_ATENDIMENTOS = 'bbt-atendimentos'
const STORAGE_LOGS = 'bbt-auditoria'

function loadAtendimentos(): Atendimento[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_ATENDIMENTOS) || '[]')
    return raw.map((a: any) => ({
      prioridade: a.prioridade || 'media',
      ...a,
    }))
  } catch {
    return []
  }
}

function saveAtendimentos(list: Atendimento[]) {
  try {
    localStorage.setItem(STORAGE_ATENDIMENTOS, JSON.stringify(list))
    return true
  } catch (e) {
    console.error('Erro ao salvar atendimentos:', e)
    return false
  }
}

export function getAllAtendimentos(): Atendimento[] { return loadAtendimentos() }
export function getAtendimentosByAgente(userId: string): Atendimento[] {
  return loadAtendimentos().filter((a) => a.agente_user_id === userId)
}
export function getAtendimentosByEmpresa(empresaId: string): Atendimento[] {
  return loadAtendimentos().filter((a) => a.empresa_id === empresaId)
}
export function getAtendimentosByFuncionario(funcionarioId: string): Atendimento[] {
  return loadAtendimentos().filter((a) => a.funcionario_id === funcionarioId)
}

export interface FiltroAtendimento {
  agente_user_id?: string
  empresa_id?: string
  status?: StatusAtendimento
  tipo_servico?: TipoServico
  prioridade?: Prioridade
  data_inicio?: string
  data_fim?: string
}

export function getAtendimentosFiltro(f: FiltroAtendimento = {}): Atendimento[] {
  let list = loadAtendimentos()
  if (f.agente_user_id) list = list.filter((a) => a.agente_user_id === f.agente_user_id)
  if (f.empresa_id) list = list.filter((a) => a.empresa_id === f.empresa_id)
  if (f.status) list = list.filter((a) => a.status === f.status)
  if (f.tipo_servico) list = list.filter((a) => a.tipo_servico === f.tipo_servico)
  if (f.prioridade) list = list.filter((a) => a.prioridade === f.prioridade)
  if (f.data_inicio) list = list.filter((a) => a.data_atendimento >= f.data_inicio!)
  if (f.data_fim) list = list.filter((a) => a.data_atendimento <= f.data_fim!)
  return list.sort((a, b) => b.data_atendimento.localeCompare(a.data_atendimento))
}

export function addAtendimento(data: Omit<Atendimento, 'id' | 'created_at' | 'updated_at'>): Atendimento | null {
  const novo: Atendimento = {
    ...data,
    id: `atd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  const list = loadAtendimentos()
  list.push(novo)
  if (!saveAtendimentos(list)) return null
  return novo
}

export function updateAtendimento(id: string, patch: Partial<Atendimento>): boolean {
  const list = loadAtendimentos()
  const idx = list.findIndex((a) => a.id === id)
  if (idx === -1) return false
  list[idx] = {
    ...list[idx],
    ...patch,
    updated_at: new Date().toISOString(),
    finalizado_em: patch.status === 'finalizado' ? new Date().toISOString() : list[idx].finalizado_em,
  }
  return saveAtendimentos(list)
}

export function deleteAtendimento(id: string): boolean {
  return saveAtendimentos(loadAtendimentos().filter((a) => a.id !== id))
}

export function anexarVoucherAtendimento(atendimentoId: string, voucherId: string): boolean {
  const list = loadAtendimentos()
  const idx = list.findIndex((a) => a.id === atendimentoId)
  if (idx === -1) return false
  const atual = list[idx].voucher_ids || []
  if (!atual.includes(voucherId)) atual.push(voucherId)
  list[idx] = { ...list[idx], voucher_ids: atual, updated_at: new Date().toISOString() }
  return saveAtendimentos(list)
}

// ========= ESTATÍSTICAS =========

export interface EstatisticasAtendimentos {
  total: number
  por_status: Record<StatusAtendimento, number>
  por_agente: { agente_user_id: string; total: number }[]
  por_empresa: { empresa_id: string; total: number }[]
  por_tipo: Record<TipoServico, number>
  por_prioridade: Record<Prioridade, number>
  valor_total: number
  valor_finalizado: number
  // ========= FINANCEIRO =========
  custo_total: number
  venda_total: number
  markup_total: number
  taxa_total: number
  faturado_total: number
  margem_media_pct: number
}

export function getEstatisticas(filtro: FiltroAtendimento = {}): EstatisticasAtendimentos {
  const base = getAtendimentosFiltro(filtro)

  const por_status: Record<StatusAtendimento, number> = {
    em_andamento: 0, aguardando_cliente: 0, finalizado: 0, cancelado: 0, pendente: 0,
  }
  const por_tipo: Record<TipoServico, number> = {
    'Aéreo': 0, 'Hotel': 0, 'Carro': 0, 'Pacote': 0, 'Outro': 0,
  }
  const por_prioridade: Record<Prioridade, number> = {
    baixa: 0, media: 0, alta: 0, urgente: 0,
  }

  let custo_total = 0
  let venda_total = 0
  let markup_total = 0
  let taxa_total = 0

  base.forEach((a) => {
    if (por_status[a.status] !== undefined) por_status[a.status]++
    if (por_tipo[a.tipo_servico] !== undefined) por_tipo[a.tipo_servico]++
    const p: Prioridade = a.prioridade || 'media'
    if (por_prioridade[p] !== undefined) por_prioridade[p]++

    const calc = calcularFinanceiro(a)
    custo_total += calc.custo
    venda_total += calc.venda
    markup_total += calc.markup
    taxa_total += calc.taxa_valor
  })

  const mapAgente = new Map<string, number>()
  const mapEmpresa = new Map<string, number>()
  base.forEach((a) => {
    mapAgente.set(a.agente_user_id, (mapAgente.get(a.agente_user_id) || 0) + 1)
    mapEmpresa.set(a.empresa_id, (mapEmpresa.get(a.empresa_id) || 0) + 1)
  })

  return {
    total: base.length,
    por_status,
    por_agente: Array.from(mapAgente.entries())
      .map(([agente_user_id, total]) => ({ agente_user_id, total }))
      .sort((a, b) => b.total - a.total),
    por_empresa: Array.from(mapEmpresa.entries())
      .map(([empresa_id, total]) => ({ empresa_id, total }))
      .sort((a, b) => b.total - a.total),
    por_tipo,
    por_prioridade,
    valor_total: base.reduce((s, a) => s + (a.valor_cotacao || 0), 0),
    valor_finalizado: base
      .filter((a) => a.status === 'finalizado')
      .reduce((s, a) => s + (a.valor_final || a.valor_cotacao || 0), 0),
    custo_total,
    venda_total,
    markup_total,
    taxa_total,
    faturado_total: venda_total + taxa_total,
    margem_media_pct: venda_total > 0 ? (markup_total / venda_total) * 100 : 0,
  }
}

/**
 * Estatísticas financeiras quebradas por tipo de serviço - usado no relatório por empresa
 */
export function getEstatisticasPorTipo(filtro: FiltroAtendimento = {}): Record<TipoServico, {
  quantidade: number
  custo: number
  venda: number
  markup: number
  taxa: number
  faturado: number
}> {
  const base = getAtendimentosFiltro(filtro)
  const result: Record<TipoServico, any> = {
    'Aéreo': { quantidade: 0, custo: 0, venda: 0, markup: 0, taxa: 0, faturado: 0 },
    'Hotel': { quantidade: 0, custo: 0, venda: 0, markup: 0, taxa: 0, faturado: 0 },
    'Carro': { quantidade: 0, custo: 0, venda: 0, markup: 0, taxa: 0, faturado: 0 },
    'Pacote': { quantidade: 0, custo: 0, venda: 0, markup: 0, taxa: 0, faturado: 0 },
    'Outro': { quantidade: 0, custo: 0, venda: 0, markup: 0, taxa: 0, faturado: 0 },
  }
  base.forEach((a) => {
    const calc = calcularFinanceiro(a)
    const r = result[a.tipo_servico]
    r.quantidade++
    r.custo += calc.custo
    r.venda += calc.venda
    r.markup += calc.markup
    r.taxa += calc.taxa_valor
    r.faturado += calc.total_faturado
  })
  return result
}

export function seedAtendimentosDemo(empresasIds: string[], agentesIds: string[]) {
  if (loadAtendimentos().length > 0) return
  if (empresasIds.length === 0 || agentesIds.length === 0) return

  const tipos: TipoServico[] = ['Aéreo', 'Hotel', 'Carro', 'Pacote']
  const statuses: StatusAtendimento[] = ['em_andamento', 'aguardando_cliente', 'finalizado', 'cancelado', 'pendente']
  const prios: Prioridade[] = ['baixa', 'media', 'alta', 'urgente']
  const passageiros = ['Isabella Santos', 'João Pereira', 'Maria Oliveira', 'Pedro Souza', 'Ana Ferreira', 'Bruno Lima', 'Clara Mendes', 'Diego Costa']

  const demo: Atendimento[] = []
  for (let i = 0; i < 35; i++) {
    const diasAtras = Math.floor(Math.random() * 45)
    const data = new Date(Date.now() - diasAtras * 86400000)
    const tipo = tipos[i % tipos.length]
    const custo = 300 + Math.floor(Math.random() * 2500)
    const markup = Math.floor(custo * (0.15 + Math.random() * 0.35))
    const venda = custo + markup

    demo.push({
      id: `atd-demo-${i}`,
      empresa_id: empresasIds[i % empresasIds.length],
      funcionario_id: null,
      passageiro_nome: passageiros[i % passageiros.length],
      tipo_servico: tipo,
      valor_cotacao: venda,
      valor_final: venda,
      valor_custo: custo,
      valor_venda: venda,
      taxa_percentual: 10,
      taxa_ativa: Math.random() > 0.3,
      agente_user_id: agentesIds[i % agentesIds.length],
      status: statuses[i % statuses.length],
      prioridade: prios[i % prios.length],
      origem: 'WhatsApp',
      observacoes: 'Atendimento de exemplo para demonstração.',
      data_atendimento: data.toISOString().slice(0, 10),
      created_at: data.toISOString(),
      updated_at: data.toISOString(),
    })
  }
  saveAtendimentos(demo)
}

// ========= LOGS =========

function loadLogs(): LogAuditoria[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(STORAGE_LOGS) || '[]') } catch { return [] }
}

function saveLogs(list: LogAuditoria[]) {
  try {
    const trimmed = list.slice(-500)
    localStorage.setItem(STORAGE_LOGS, JSON.stringify(trimmed))
    return true
  } catch { return false }
}

export function getAllLogs(): LogAuditoria[] {
  return loadLogs().sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

export function registrarLog(data: Omit<LogAuditoria, 'id' | 'timestamp'>) {
  const log: LogAuditoria = {
    ...data,
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  }
  const list = loadLogs()
  list.push(log)
  saveLogs(list)
}
