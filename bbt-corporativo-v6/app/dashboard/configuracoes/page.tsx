'use client'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import { getCurrentUser, roleLabel, getAllUsers } from '@/lib/auth'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Settings, User as UserIcon, Database, Shield, Trash2, Download, RefreshCw, Palette } from 'lucide-react'
import { toast } from 'sonner'

export default function ConfiguracoesPage() {
  const user = typeof window !== 'undefined' ? getCurrentUser() : null
  const { empresas, funcionarios, hoteis, resetData } = useStore()
  const [confirmReset, setConfirmReset] = useState(false)

  function exportBackup() {
    const data = {
      version: 1,
      exported_at: new Date().toISOString(),
      empresas, funcionarios, hoteis,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bbt-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    toast.success('Backup exportado!')
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-bbt-primary dark:text-white flex items-center gap-3">
          <Settings className="w-8 h-8 text-bbt-accent" />
          Configurações
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Configurações do sistema e gerenciamento de dados.</p>
      </div>

      {/* Meu Perfil */}
      <div className="bbt-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <UserIcon className="w-5 h-5 text-bbt-accent" />
          <h2 className="font-semibold text-bbt-primary dark:text-white">Meu Perfil</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-bbt-primary to-bbt-primary-light flex items-center justify-center text-white font-bold text-xl">
            {user?.name.charAt(0)}
          </div>
          <div>
            <div className="font-medium text-bbt-primary dark:text-white">{user?.name}</div>
            <div className="text-sm text-slate-500">{user?.email}</div>
            <span className="bbt-badge bg-bbt-accent/10 text-bbt-primary dark:text-bbt-accent mt-1">
              {user ? roleLabel(user.role) : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Contas do sistema */}
      {user?.role === 'master' && (
        <div className="bbt-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-bbt-accent" />
            <h2 className="font-semibold text-bbt-primary dark:text-white">Contas do Sistema</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">Lista de perfis configurados no sistema (modo local).</p>
          <div className="space-y-2">
            {getAllUsers().map((u) => (
              <div key={u.email} className="flex items-center justify-between p-3 border border-bbt-gray-100 dark:border-slate-700 rounded-lg">
                <div>
                  <div className="font-medium text-sm text-bbt-text dark:text-slate-100">{u.name}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </div>
                <span className={`bbt-badge text-[10px] ${
                  u.role === 'master' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                  : u.role === 'company_admin' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                }`}>{roleLabel(u.role).toUpperCase()}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-3">
            💡 Para adicionar ou alterar contas, edite o arquivo <code className="bg-bbt-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">lib/auth.ts</code>.
          </p>
        </div>
      )}

      {/* Dados */}
      <div className="bbt-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-bbt-accent" />
          <h2 className="font-semibold text-bbt-primary dark:text-white">Dados do Sistema</h2>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="text-center p-3 border border-bbt-gray-100 dark:border-slate-700 rounded-lg">
            <div className="text-2xl font-bold text-bbt-primary dark:text-white">{empresas.length}</div>
            <div className="text-xs text-slate-500">Empresas</div>
          </div>
          <div className="text-center p-3 border border-bbt-gray-100 dark:border-slate-700 rounded-lg">
            <div className="text-2xl font-bold text-bbt-primary dark:text-white">{funcionarios.length}</div>
            <div className="text-xs text-slate-500">Funcionários</div>
          </div>
          <div className="text-center p-3 border border-bbt-gray-100 dark:border-slate-700 rounded-lg">
            <div className="text-2xl font-bold text-bbt-primary dark:text-white">{hoteis.length}</div>
            <div className="text-xs text-slate-500">Hotéis</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportBackup} className="bbt-button-ghost flex items-center gap-2">
            <Download className="w-4 h-4" /> Exportar backup JSON
          </button>
          {user?.role === 'master' && (
            <button onClick={() => setConfirmReset(true)} className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium transition">
              <RefreshCw className="w-4 h-4" /> Restaurar dados iniciais
            </button>
          )}
        </div>
      </div>

      {/* Aparência */}
      <div className="bbt-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-5 h-5 text-bbt-accent" />
          <h2 className="font-semibold text-bbt-primary dark:text-white">Aparência</h2>
        </div>
        <p className="text-sm text-slate-500">
          Alterne entre modo claro e escuro usando o botão ☀️/🌙 no cabeçalho do sistema.
          A preferência fica salva no seu navegador.
        </p>
      </div>

      {/* Info sobre Supabase */}
      <div className="bbt-card p-6 bg-blue-50 dark:bg-slate-800/60 border border-blue-100 dark:border-slate-700">
        <h3 className="font-semibold text-bbt-primary dark:text-white mb-2">🚀 Migração para Supabase (futuro)</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
          Este sistema está rodando em <strong>modo local</strong> (dados no seu navegador).
          Quando quiser migrar para banco na nuvem com multi-usuário real, siga o passo-a-passo no arquivo
          <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded mx-1">README.md</code> e execute o schema
          <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded mx-1">lib/supabase-schema.sql</code>.
        </p>
        <p className="text-xs text-slate-500">
          Recomendamos contratar um desenvolvedor para fazer essa migração, pois envolve configuração de autenticação e regras de segurança (RLS).
        </p>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          resetData()
          toast.success('Dados restaurados ao estado inicial!')
        }}
        title="Restaurar dados iniciais"
        message="Isto apagará TODAS as alterações (empresas, funcionários e hotéis criados) e voltará aos dados do seed original (125 hotéis). Confirma?"
        confirmLabel="Sim, restaurar"
        danger
      />
    </div>
  )
}
