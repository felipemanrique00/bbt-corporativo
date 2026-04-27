'use client'
import { useState, useMemo } from 'react'
import { useStore } from '@/lib/store'
import { getCurrentUser, canEditGlobal } from '@/lib/auth'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { WhatsAppButton } from '@/components/ui/whatsapp-button'
import { ConfigCobrancaModal } from '@/components/ui/config-cobranca-modal'
import { SearchInput } from '@/components/ui/search-input'
import { maskCNPJ, maskPhone, formatDate, onlyDigits } from '@/lib/utils'
import { Building2, Plus, Search, Edit2, Trash2, Download, Eye, Users, DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import type { Empresa } from '@/types'

export default function EmpresasPage() {
  const user = typeof window !== 'undefined' ? getCurrentUser() : null
  const isMaster = canEditGlobal(user)
  const { empresas, funcionarios, addEmpresa, updateEmpresa, deleteEmpresa } = useStore()

  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Empresa | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Empresa | null>(null)
  const [configCobrancaEmpresa, setConfigCobrancaEmpresa] = useState<Empresa | null>(null)

  const visible = useMemo(() => {
    const filtered =
      user?.role === 'master'
        ? empresas
        : empresas.filter((e) => e.id === user?.company_id)
    if (!search.trim()) return filtered
    const q = search.toLowerCase()
    return filtered.filter(
      (e) =>
        e.nome.toLowerCase().includes(q) ||
        e.cnpj.includes(q) ||
        e.responsavel.toLowerCase().includes(q)
    )
  }, [empresas, search, user])

  function exportCSV() {
    const headers = ['Nome', 'CNPJ', 'Endereço', 'Responsável', 'E-mail', 'Telefone', 'Centro de Custo', 'Ativa']
    const rows = visible.map((e) => [
      e.nome,
      e.cnpj,
      e.endereco,
      e.responsavel,
      e.email_responsavel,
      maskPhone(e.telefone),
      e.centro_custo_padrao,
      e.ativa ? 'Sim' : 'Não',
    ])
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `empresas-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    toast.success('CSV exportado com sucesso!')
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-bbt-primary dark:text-white flex items-center gap-3">
            <Building2 className="w-8 h-8 text-bbt-accent" />
            Empresas
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {visible.length} {visible.length === 1 ? 'empresa cadastrada' : 'empresas cadastradas'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="bbt-button-ghost flex items-center gap-2">
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
          {isMaster && (
            <button
              onClick={() => {
                setEditing(null)
                setModalOpen(true)
              }}
              className="bbt-button-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Nova Empresa
            </button>
          )}
        </div>
      </div>

      {/* Busca */}
      <div className="bbt-card p-4">
        <SearchInput
          value={search}
          onChangeValue={setSearch}
          placeholder="Buscar por nome, CNPJ ou responsável..."
        />
      </div>

      {/* Tabela */}
      <div className="bbt-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bbt-gray-50 dark:bg-slate-900/50 border-b border-bbt-gray-100 dark:border-slate-700">
              <tr>
                <Th>Empresa</Th>
                <Th>CNPJ</Th>
                <Th>Responsável</Th>
                <Th>Telefone</Th>
                <Th>Funcionários</Th>
                <Th>Status</Th>
                <Th className="text-right">Ações</Th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400">
                    Nenhuma empresa encontrada.
                  </td>
                </tr>
              ) : (
                visible.map((e) => {
                  const totalFunc = funcionarios.filter((f) => f.company_id === e.id).length
                  return (
                    <tr
                      key={e.id}
                      className="border-b border-bbt-gray-100 dark:border-slate-700 last:border-0 hover:bg-bbt-gray-50 dark:hover:bg-slate-900/30 transition"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-bbt-text dark:text-slate-100">{e.nome}</div>
                        <div className="text-xs text-slate-500">{e.endereco}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-mono text-xs">{e.cnpj}</td>
                      <td className="px-4 py-3">
                        <div className="text-slate-700 dark:text-slate-200">{e.responsavel}</div>
                        <div className="text-xs text-slate-500">{e.email_responsavel}</div>
                      </td>
                      <td className="px-4 py-3">
                        <WhatsAppButton phone={e.telefone} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="bbt-badge bg-bbt-accent/10 text-bbt-primary dark:text-bbt-accent">
                          <Users className="w-3 h-3" />
                          {totalFunc}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {e.ativa ? (
                          <span className="bbt-badge bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Ativa</span>
                        ) : (
                          <span className="bbt-badge bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400">Inativa</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/dashboard/empresas/${e.id}`}
                            className="p-2 rounded-lg hover:bg-bbt-accent/10 text-slate-500 hover:text-bbt-accent transition"
                            title="Ver detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          {(isMaster || user?.company_id === e.id) && (
                            <button
                              onClick={() => {
                                setEditing(e)
                                setModalOpen(true)
                              }}
                              className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-500 hover:text-blue-600 transition"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {isMaster && (
                            <button
                              onClick={() => setConfigCobrancaEmpresa(e)}
                              className="p-2 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-slate-500 hover:text-green-600 transition"
                              title="Configurar cobrança (markup/taxa)"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                          )}
                          {isMaster && (
                            <button
                              onClick={() => setConfirmDelete(e)}
                              className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-500 hover:text-red-600 transition"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EmpresaModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        onSave={(data) => {
          if (editing) {
            updateEmpresa(editing.id, data)
            toast.success('Empresa atualizada!')
          } else {
            addEmpresa({ ...data, ativa: true } as any)
            toast.success('Empresa cadastrada!')
          }
          setModalOpen(false)
        }}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) {
            deleteEmpresa(confirmDelete.id)
            toast.success('Empresa excluída.')
          }
        }}
        title="Excluir empresa"
        message={`Tem certeza que deseja excluir "${confirmDelete?.nome}"? Todos os funcionários e políticas vinculados também serão removidos.`}
        confirmLabel="Sim, excluir"
        danger
      />

      <ConfigCobrancaModal
        open={!!configCobrancaEmpresa}
        onClose={() => setConfigCobrancaEmpresa(null)}
        empresa={configCobrancaEmpresa}
      />
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider ${className}`}>
      {children}
    </th>
  )
}

function EmpresaModal({
  open,
  onClose,
  editing,
  onSave,
}: {
  open: boolean
  onClose: () => void
  editing: Empresa | null
  onSave: (data: Partial<Empresa>) => void
}) {
  const [form, setForm] = useState<Partial<Empresa>>(
    editing || {
      nome: '',
      cnpj: '',
      endereco: '',
      responsavel: '',
      email_responsavel: '',
      telefone: '',
      centro_custo_padrao: '',
      ativa: true,
    }
  )

  // Reinicializa ao abrir
  useMemo(() => {
    if (open) {
      setForm(
        editing || {
          nome: '',
          cnpj: '',
          endereco: '',
          responsavel: '',
          email_responsavel: '',
          telefone: '',
          centro_custo_padrao: '',
          ativa: true,
        }
      )
    }
  }, [open, editing])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome || !form.cnpj) {
      toast.error('Preencha nome e CNPJ.')
      return
    }
    onSave({ ...form, telefone: onlyDigits(form.telefone || '') })
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar Empresa' : 'Nova Empresa'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nome *">
            <input
              required
              value={form.nome || ''}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="bbt-input"
            />
          </Field>
          <Field label="CNPJ *">
            <input
              required
              value={form.cnpj || ''}
              onChange={(e) => setForm({ ...form, cnpj: maskCNPJ(e.target.value) })}
              placeholder="00.000.000/0000-00"
              className="bbt-input"
            />
          </Field>
        </div>
        <Field label="Endereço">
          <input
            value={form.endereco || ''}
            onChange={(e) => setForm({ ...form, endereco: e.target.value })}
            className="bbt-input"
          />
        </Field>
        <Field label="Código do cliente (sistema de emissão — ex: WAY153)">
          <input
            value={form.codigo_cliente || ''}
            onChange={(e) => setForm({ ...form, codigo_cliente: e.target.value.toUpperCase() })}
            placeholder="Usado pra vincular com a planilha de emissões"
            className="bbt-input uppercase"
          />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Responsável">
            <input
              value={form.responsavel || ''}
              onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
              className="bbt-input"
            />
          </Field>
          <Field label="E-mail do responsável">
            <input
              type="email"
              value={form.email_responsavel || ''}
              onChange={(e) => setForm({ ...form, email_responsavel: e.target.value })}
              className="bbt-input"
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Telefone">
            <input
              value={maskPhone(form.telefone || '')}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              placeholder="(00) 00000-0000"
              className="bbt-input"
            />
          </Field>
          <Field label="Centro de Custo Padrão">
            <input
              value={form.centro_custo_padrao || ''}
              onChange={(e) => setForm({ ...form, centro_custo_padrao: e.target.value })}
              className="bbt-input"
            />
          </Field>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="ativa"
            checked={form.ativa !== false}
            onChange={(e) => setForm({ ...form, ativa: e.target.checked })}
            className="rounded"
          />
          <label htmlFor="ativa" className="text-sm text-slate-700 dark:text-slate-300">
            Empresa ativa
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t border-bbt-gray-100 dark:border-slate-700">
          <button type="button" onClick={onClose} className="bbt-button-ghost">Cancelar</button>
          <button type="submit" className="bbt-button-primary">{editing ? 'Salvar alterações' : 'Cadastrar empresa'}</button>
        </div>
      </form>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  )
}
