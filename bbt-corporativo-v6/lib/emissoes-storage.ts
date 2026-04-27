// ============================================================
// Storage de Emissões (atendimentos hoteleiros)
// ============================================================
import type { Hotel, Empresa } from '@/types'

export interface Emissao {
  id: string
  hotel_id: number
  empresa_id: string
  funcionario_nome: string
  data_checkin: string
  data_checkout: string
  valor_total: number
  observacoes: string
  created_at: string
}

const STORAGE_KEY = 'bbt-emissoes'

function load(): Emissao[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function save(list: Emissao[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    return true
  } catch {
    return false
  }
}

export function getAllEmissoes(): Emissao[] {
  return load()
}

export function getEmissoesByEmpresa(empresaId: string): Emissao[] {
  return load().filter((e) => e.empresa_id === empresaId)
}

export function getEmissoesByHotel(hotelId: number): Emissao[] {
  return load().filter((e) => e.hotel_id === hotelId)
}

export function addEmissao(data: Omit<Emissao, 'id' | 'created_at'>): Emissao | null {
  const nova: Emissao = {
    ...data,
    id: `ems-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    created_at: new Date().toISOString(),
  }
  const list = load()
  list.push(nova)
  if (!save(list)) return null
  return nova
}

export function deleteEmissao(id: string): boolean {
  return save(load().filter((e) => e.id !== id))
}

/** Ranking de hotéis mais emitidos por empresa */
export function getRankingHoteisByEmpresa(empresaId: string): { hotel_id: number; total: number; valor_total: number }[] {
  const emissoes = getEmissoesByEmpresa(empresaId)
  const map = new Map<number, { total: number; valor_total: number }>()
  emissoes.forEach((e) => {
    const atual = map.get(e.hotel_id) || { total: 0, valor_total: 0 }
    map.set(e.hotel_id, { total: atual.total + 1, valor_total: atual.valor_total + (e.valor_total || 0) })
  })
  return Array.from(map.entries())
    .map(([hotel_id, v]) => ({ hotel_id, ...v }))
    .sort((a, b) => b.total - a.total)
}

/** Gera emissões DEMO - só executa se não existir nenhuma emissão ainda */
export function seedEmissoesDemo(empresas: Empresa[], hoteis: Hotel[]) {
  if (load().length > 0) return
  if (empresas.length === 0 || hoteis.length === 0) return

  const demos: Emissao[] = []
  // Gera emissões pras 3 primeiras empresas nos 15 primeiros hotéis
  const empresasDemo = empresas.slice(0, 3)
  const hoteisDemo = hoteis.slice(0, 15)

  empresasDemo.forEach((emp, idxEmp) => {
    hoteisDemo.forEach((h, idxHtl) => {
      // Algumas combinações têm mais emissões que outras
      const repeticoes = (idxEmp === 0 ? 3 : idxEmp === 1 ? 2 : 1) + (idxHtl % 3)
      for (let i = 0; i < repeticoes; i++) {
        const diasAtras = Math.floor(Math.random() * 90)
        const dataCheckin = new Date(Date.now() - diasAtras * 86400000)
        const dataCheckout = new Date(dataCheckin.getTime() + (1 + Math.floor(Math.random() * 4)) * 86400000)
        demos.push({
          id: `ems-demo-${idxEmp}-${idxHtl}-${i}`,
          hotel_id: h.id,
          empresa_id: emp.id,
          funcionario_nome: `Funcionário Demo ${i + 1}`,
          data_checkin: dataCheckin.toISOString().slice(0, 10),
          data_checkout: dataCheckout.toISOString().slice(0, 10),
          valor_total: (h.tarifa_sgl || h.tarifa_dbl || 300) * (1 + Math.floor(Math.random() * 3)),
          observacoes: 'Emissão demo para demonstração do sistema.',
          created_at: dataCheckin.toISOString(),
        })
      }
    })
  })
  save(demos)
}
