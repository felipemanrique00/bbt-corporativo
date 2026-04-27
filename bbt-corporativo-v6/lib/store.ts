// ============================================================
// Store Global (Zustand) V4 — persistido em localStorage
// Todas as operações são CRUD em memória + salvas no navegador.
// ============================================================
'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Empresa, Funcionario, Hotel, PoliticaCargo, Cargo, ConfigCobrancaEmpresa } from '@/types'
import { CONFIG_COBRANCA_PADRAO } from '@/types'
import { HOTEIS_SEED } from './data/hoteis'
import { EMPRESAS_SEED } from './data/empresas'
import { FUNCIONARIOS_SEED } from './data/funcionarios'

function seedPoliticas(): PoliticaCargo[] {
  const cargos: Cargo[] = ['Diretor', 'Gerente', 'Colaborador']
  const result: PoliticaCargo[] = []
  EMPRESAS_SEED.forEach((emp) => {
    cargos.forEach((cargo) => {
      const isDir = cargo === 'Diretor'
      const isGer = cargo === 'Gerente'
      result.push({
        id: `pol-${emp.id}-${cargo}`,
        company_id: emp.id,
        cargo,
        titulo: isDir ? 'Diretoria' : isGer ? 'Gerência' : 'Colaboradores',
        escalao: isDir ? 'Alto Escalão' : isGer ? 'Gestão' : 'Operacional',
        limite_diaria_hotel: isDir ? 800 : isGer ? 500 : 300,
        hoteis_max_estrelas: isDir ? 5 : isGer ? 4 : 3,
        antecedencia_hotel_dias: isDir ? 3 : isGer ? 7 : 10,
        classe_aerea: isDir ? 'Executiva' : 'Econômica',
        classe_aerea_internacional: isDir ? 'Executiva' : isGer ? 'Econômica Premium' : 'Econômica',
        valor_maximo_aereo_domestico: isDir ? 3000 : isGer ? 1800 : 1200,
        valor_maximo_aereo_internacional: isDir ? 15000 : isGer ? 8000 : 5000,
        antecedencia_aereo_domestico_dias: isDir ? 3 : isGer ? 7 : 10,
        antecedencia_aereo_internacional_dias: isDir ? 10 : isGer ? 15 : 21,
        aprovacao_automatica: isDir,
        observacoes: '',
        politica_hotel_texto: isDir
          ? 'Preferência por hotéis com estrutura corporativa (sala de reunião/business center), localização central ou executiva, café da manhã incluso.'
          : isGer
          ? 'Hotel com Wi-Fi de qualidade, boa avaliação, localização funcional, check-in ágil (redes conhecidas).'
          : 'Obrigatório: boa cama + banheiro funcional. Prioridade: redes econômicas confiáveis (ex: Ibis, B&B). Evitar localizações de risco.',
        politica_aerea_texto: isDir
          ? 'Bagagem despachada liberada. Acesso a salas VIP quando possível.'
          : isGer
          ? 'Preferência por voos diretos quando possível. Bagagem despachada 1x23kg.'
          : 'Somente voos econômicos. Bagagem somente de mão quando possível.',
      })
    })
  })
  return result
}

interface DataState {
  empresas: Empresa[]
  funcionarios: Funcionario[]
  hoteis: Hotel[]
  politicas: PoliticaCargo[]

  addEmpresa: (e: Omit<Empresa, 'id' | 'created_at'>) => Empresa | null
  updateEmpresa: (id: string, patch: Partial<Empresa>) => void
  deleteEmpresa: (id: string) => void
  updateConfigCobranca: (empresaId: string, config: ConfigCobrancaEmpresa) => void

  addFuncionario: (f: Omit<Funcionario, 'id' | 'created_at'>) => Funcionario | null
  updateFuncionario: (id: string, patch: Partial<Funcionario>) => void
  deleteFuncionario: (id: string) => void

  addHotel: (h: Omit<Hotel, 'id'>) => void
  updateHotel: (id: number, patch: Partial<Hotel>) => void
  deleteHotel: (id: number) => void
  importHoteis: (hoteis: Omit<Hotel, 'id'>[]) => number

  updatePolitica: (id: string, patch: Partial<PoliticaCargo>) => void
  addPolitica: (p: Omit<PoliticaCargo, 'id'>) => void
  deletePolitica: (id: string) => void

  resetarParaSeeds: () => void
}

export const useStore = create<DataState>()(
  persist(
    (set, get) => ({
      empresas: EMPRESAS_SEED,
      funcionarios: FUNCIONARIOS_SEED,
      hoteis: HOTEIS_SEED,
      politicas: seedPoliticas(),

      addEmpresa: (e) => {
        const novo: Empresa = {
          ...e,
          id: `emp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          created_at: new Date().toISOString(),
          config_cobranca: e.config_cobranca || { ...CONFIG_COBRANCA_PADRAO },
        }
        set((s) => ({ empresas: [...s.empresas, novo] }))
        return novo
      },
      updateEmpresa: (id, patch) => {
        set((s) => ({
          empresas: s.empresas.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        }))
      },
      deleteEmpresa: (id) => {
        set((s) => ({
          empresas: s.empresas.filter((e) => e.id !== id),
          funcionarios: s.funcionarios.filter((f) => f.company_id !== id),
          politicas: s.politicas.filter((p) => p.company_id !== id),
        }))
      },
      updateConfigCobranca: (empresaId, config) => {
        set((s) => ({
          empresas: s.empresas.map((e) => (e.id === empresaId ? { ...e, config_cobranca: config } : e)),
        }))
      },

      addFuncionario: (f) => {
        const novo: Funcionario = {
          ...f,
          id: `func-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          created_at: new Date().toISOString(),
        }
        set((s) => ({ funcionarios: [...s.funcionarios, novo] }))
        return novo
      },
      updateFuncionario: (id, patch) => {
        set((s) => ({
          funcionarios: s.funcionarios.map((f) => (f.id === id ? { ...f, ...patch } : f)),
        }))
      },
      deleteFuncionario: (id) => {
        set((s) => ({ funcionarios: s.funcionarios.filter((f) => f.id !== id) }))
      },

      addHotel: (h) => {
        const maxId = Math.max(0, ...get().hoteis.map((x) => x.id))
        set((s) => ({ hoteis: [...s.hoteis, { ...h, id: maxId + 1 }] }))
      },
      updateHotel: (id, patch) => {
        set((s) => ({ hoteis: s.hoteis.map((h) => (h.id === id ? { ...h, ...patch } : h)) }))
      },
      deleteHotel: (id) => {
        set((s) => ({ hoteis: s.hoteis.filter((h) => h.id !== id) }))
      },
      importHoteis: (hoteis) => {
        let maxId = Math.max(0, ...get().hoteis.map((x) => x.id))
        const novos: Hotel[] = hoteis.map((h) => ({ ...h, id: ++maxId }))
        set((s) => ({ hoteis: [...s.hoteis, ...novos] }))
        return novos.length
      },

      updatePolitica: (id, patch) => {
        set((s) => ({ politicas: s.politicas.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
      },
      addPolitica: (p) => {
        const novo: PoliticaCargo = {
          ...p,
          id: `pol-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        }
        set((s) => ({ politicas: [...s.politicas, novo] }))
      },
      deletePolitica: (id) => {
        set((s) => ({ politicas: s.politicas.filter((p) => p.id !== id) }))
      },

      resetarParaSeeds: () => {
        set({
          empresas: EMPRESAS_SEED,
          funcionarios: FUNCIONARIOS_SEED,
          hoteis: HOTEIS_SEED,
          politicas: seedPoliticas(),
        })
      },
    }),
    {
      name: 'bbt-data-v4',
      version: 1,
    }
  )
)
