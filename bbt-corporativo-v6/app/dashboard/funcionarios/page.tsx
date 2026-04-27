'use client'
import { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useStore } from '@/lib/store'
import { getCurrentUser, canEditCompany } from '@/lib/auth'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { WhatsAppButton } from '@/components/ui/whatsapp-button'
import { SearchInput } from '@/components/ui/search-input'
import { maskCPF, maskPhone, formatDate, onlyDigits } from '@/lib/utils'
import { Users, Plus, Edit2, Trash2, Download, Eye } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import type { Funcionario, Cargo } from '@/types'

const CARGOS: Cargo[] = ['Diretor', 'Gerente', 'Colaborador']

/** Normaliza texto: sem acento, lowercase, trim - para busca tolerante */
function norm(s: string): string {
  return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export default function FuncionariosPage() {
  const user = typeof window !== 'undefined' ? getCurrentUser() : null
  const searchParams = useSearchParams()
  const empresaFiltroURL = searchParams.get('empresa')

  const { empresas, funcionarios, addFuncionario, updateFuncionario, deleteFuncionario } = useStore()

  const [search, setSearch] = useState('')
  const [cargoFilter, setCargoFilter] = useState<Cargo | 'Todos'>('Todos')
  const [empresaFilter, setEmpresaFilter] = useState<string>(empresaFiltroURL || 'Todas')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Funcionario | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Funcionario | null>(null)

  const visible = useMemo(() => {
    let base =
      user?.role === 'master'
        ? funcionarios
        : funcionarios.filter((f) => f.company_id === user?.company_id)

    if (cargoFilter !== 'Todos') base = base.filter((f) => f.cargo === cargoFilter)
    if (empresaFilter !== 'Todas' && user?.role === 'master') {
      base = base.filter((f) => f.company_id === empresaFilter)
    }

    // ====== BUSCA CORRIGIDA ======
    const q = search.trim()
    if (q) {
      const qNorm = norm(q)
      const qDigits = onlyDigits(q) // para buscar por CPF

      base = base.filter((f) => {
        // Nome (normalizado - aceita com/sem acento)
        if (norm(f.nome).includes(qNorm)) return true
        // E-mail
        if (f.email && norm(f.email).includes(qNorm)) return true
        // CPF (só compara se o que usuário digitou tem dígitos)
        if (qDigits.length >= 3 && f.cpf && f.cpf.includes(qDigits)) return true
        // Centro de custo
        if (f.centro_custo && norm(f.centro_custo).includes(qNorm)) return true
        // Cargo original
        if (f.cargo_original && norm(f.cargo_original).includes(qNorm)) return true
        // Matrícula
        if (f.matricula && norm(f.matricula).includes(qNorm)) return true
        // Lotação
        if (f.lotacao && norm(f.lotacao).includes(qNorm)) return true
        // Telefone (se digitou número)
        if (qDigits.length >= 3 && f.telefone && f.telefone.includes(qDigits)) return true
        return false
      })
    }
    return base
  }, [funcionarios, search, cargoFilter, empresaFilter, user])

  function exportCSV() {
    const headers = ['Nome', 'CPF', 'E-mail', 'Telefone', 'Cargo', 'Empresa', 'Centro Custo', 'Nascimento', 'Matrícula', 'Lotação']
    const rows = visible.map((f) => {
      const emp = empresas.find((e) => e.id === f.company_id)
      return [
        f.nome, f.cpf ? maskCPF(f.cpf) : '', f.email || '',
        f.telefone ? maskPhone(f.telefone) : '', f.cargo, emp?.nome || '',
        f.centro_custo || '', formatDate(f.data_nascimento), f.matricula || '', f.lotacao || '',
      ]
    })
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `funcionarios-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    toast.success('CSV exportado!')
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-bbt-primary dark:text-white flex items-center gap-3">
            <Users className="w-8 h-8 text-bbt-accent" /> Funcionários
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {visible.length} de {funcionarios.length} funcionário(s)
            {empresaFilter !== 'Todas' && (
              <> · {empresas.find((e) => e.id === empresaFilter)?.nome}</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="bbt-button-ghost flex items-center gap-2">
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
          {user?.role === 'master' && (
            <button
              onClick={() => { setEditing(null); setModalOpen(true) }}
              className="bbt-button-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Novo Funcionário
            </button>
          )}
        </div>
      </div>

      {/* FILTROS - USANDO SearchInput QUE JÁ CORRIGE O BUG */}
      <div className="bbt-card p-4 flex flex-wrap gap-3 items-center">
        <SearchInput
          value={search}
          onChangeValue={setSearch}
          placeholder="Buscar por nome, CPF, e-mail, centro de custo, matrícula, lotação..."
          className="flex-1 min-w-[280px]"
        />
        <select value={cargoFilter} onChange={(e) => setCargoFilter(e.target.value as any)} className="bbt-input w-auto">
          <option>Todos</option>
          {CARGOS.map((c) => <option key={c}>{c}</option>)}
        </select>
        {user?.role === 'master' && (
          <select value={empresaFilter} onChange={(e) => setEmpresaFilter(e.target.value)} className="bbt-input w-auto">
            <option value="Todas">Todas empresas</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        )}
        {search && (
          <button onClick={() => setSearch('')} className="text-xs text-bbt-accent hover:underline">
            Limpar busca
          </button>
        )}
      </div>

      {/* TABELA */}
      <div className="bbt-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bbt-gray-50 dark:bg-slate-900/50 border-b border-bbt-gray-100 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">Funcionário</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">CPF</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">Cargo</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">Empresa</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">Centro de Custo</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">Telefone</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400">
                    {search || cargoFilter !== 'Todos' || empresaFilter !== 'Todas'
                      ? 'Nenhum funcionário encontrado com os filtros aplicados.'
                      : 'Nenhum funcionário cadastrado.'}
                  </td>
                </tr>
              ) : visible.slice(0, 100).map((f) => {
                const emp = empresas.find((e) => e.id === f.company_id)
                return (
                  <tr key={f.id} className="border-b border-bbt-gray-100 dark:border-slate-700 last:border-0 hover:bg-bbt-gray-50 dark:hover:bg-slate-900/30 transition">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/funcionarios/${f.id}`} className="flex items-center gap-3 hover:text-bbt-accent">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-bbt-primary to-bbt-primary-light flex items-center justify-center text-white font-bold text-xs shrink-0">
                          {f.nome.split(' ').slice(0, 2).map((n) => n[0]).join('')}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-bbt-text dark:text-slate-100 truncate">{f.nome}</div>
                          {f.matricula && <div className="text-[10px] text-slate-400">Matr: {f.matricula}</div>}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{f.cpf ? maskCPF(f.cpf) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`bbt-badge text-xs ${
                        f.cargo === 'Diretor' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                        : f.cargo === 'Gerente' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      }`}>{f.cargo}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 truncate max-w-[200px]">{emp?.nome || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 truncate max-w-[180px]">{f.centro_custo || '—'}</td>
                    <td className="px-4 py-3"><WhatsAppButton phone={f.telefone} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/dashboard/funcionarios/${f.id}`} className="p-2 rounded-lg hover:bg-bbt-accent/10 text-slate-500 hover:text-bbt-accent transition" title="Ver detalhes">
                          <Eye className="w-4 h-4" />
                        </Link>
                        {user && canEditCompany(user, f.company_id) && (
                          <>
                            <button onClick={() => { setEditing(f); setModalOpen(true) }} className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-500 hover:text-blue-600 transition" title="Editar">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setConfirmDelete(f)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-500 hover:text-red-600 transition" title="Excluir">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {visible.length > 100 && (
            <div className="p-3 bg-bbt-gray-50 dark:bg-slate-900/40 text-xs text-center text-slate-500 border-t border-bbt-gray-100 dark:border-slate-700">
              Mostrando 100 de {visible.length} funcionários. Refine a busca para ver mais.
            </div>
          )}
        </div>
      </div>

      {/* MODAL */}
      {modalOpen && (
        <FuncionarioModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditing(null) }}
          editing={editing}
          empresas={empresas}
          onSave={(data) => {
            if (editing) {
              updateFuncionario(editing.id, { ...data, cpf: onlyDigits(data.cpf || ''), telefone: onlyDigits(data.telefone || '') })
              toast.success('Funcionário atualizado!')
            } else {
              addFuncionario({ ...data, cpf: onlyDigits(data.cpf || ''), telefone: onlyDigits(data.telefone || ''), ativo: true } as any)
              toast.success('Funcionário cadastrado!')
            }
            setModalOpen(false); setEditing(null)
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => { if (confirmDelete) { deleteFuncionario(confirmDelete.id); toast.success('Funcionário excluído.') } }}
        title="Excluir funcionário"
        message={`Confirma a exclusão de "${confirmDelete?.nome}"?`}
        confirmLabel="Excluir"
        danger
      />
    </div>
  )
}

// Modal simples de cadastro/edição
function FuncionarioModal({ open, onClose, editing, empresas, onSave }: {
  open: boolean
  onClose: () => void
  editing: Funcionario | null
  empresas: any[]
  onSave: (data: Partial<Funcionario>) => void
}) {
  const [form, setForm] = useState<Partial<Funcionario>>(editing || {
    nome: '', cpf: '', email: '', telefone: '', data_nascimento: '',
    cargo: 'Colaborador', company_id: empresas[0]?.id || '',
    centro_custo: '', passaporte: '', passaporte_validade: '', milhagem: '', preferencias: '',
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome || !form.company_id) { toast.error('Preencha nome e empresa.'); return }
    onSave(form)
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar Funcionário' : 'Novo Funcionário'} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nome *"><input required value={form.nome || ''} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="bbt-input" autoFocus /></Field>
          <Field label="CPF"><input value={form.cpf || ''} onChange={(e) => setForm({ ...form, cpf: e.target.value })} className="bbt-input" /></Field>
          <Field label="E-mail"><input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bbt-input" /></Field>
          <Field label="Telefone"><input value={form.telefone || ''} onChange={(e) => setForm({ ...form, telefone: e.target.value })} className="bbt-input" /></Field>
          <Field label="Data de Nascimento"><input type="date" value={form.data_nascimento || ''} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} className="bbt-input" /></Field>
          <Field label="Cargo *">
            <select value={form.cargo || 'Colaborador'} onChange={(e) => setForm({ ...form, cargo: e.target.value as Cargo })} className="bbt-input">
              {CARGOS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Empresa *">
            <select required value={form.company_id || ''} onChange={(e) => setForm({ ...form, company_id: e.target.value })} className="bbt-input">
              <option value="">Selecione...</option>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </Field>
          <Field label="Centro de Custo"><input value={form.centro_custo || ''} onChange={(e) => setForm({ ...form, centro_custo: e.target.value })} className="bbt-input" /></Field>
          <Field label="Passaporte"><input value={form.passaporte || ''} onChange={(e) => setForm({ ...form, passaporte: e.target.value })} className="bbt-input" /></Field>
          <Field label="Validade Passaporte"><input type="date" value={form.passaporte_validade || ''} onChange={(e) => setForm({ ...form, passaporte_validade: e.target.value })} className="bbt-input" /></Field>
        </div>
        <Field label="Preferências"><textarea value={form.preferencias || ''} onChange={(e) => setForm({ ...form, preferencias: e.target.value })} rows={2} className="bbt-input" /></Field>
        <div className="flex justify-end gap-2 pt-4 border-t border-bbt-gray-100 dark:border-slate-700">
          <button type="button" onClick={onClose} className="bbt-button-ghost">Cancelar</button>
          <button type="submit" className="bbt-button-primary">{editing ? 'Salvar' : 'Cadastrar'}</button>
        </div>
      </form>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}
