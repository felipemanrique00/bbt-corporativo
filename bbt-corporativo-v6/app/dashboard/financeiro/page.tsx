'use client'
import { useState, useMemo } from 'react'
import { useStore } from '@/lib/store'
import { getCurrentUser, hasPermission } from '@/lib/auth'
import {
  getAllLancamentos, calcularResumoFinanceiro, pagarLancamento,
  gerarLancamentosDoAtendimento,
  type LancamentoFinanceiro, type FormaPagamento,
} from '@/lib/financeiro'
import { getAllAtendimentos } from '@/lib/atendimentos-storage'
import { useFiltroPersistente } from '@/lib/filtros'
import { formatarValor, formatarData } from '@/lib/normalizers'
import { Modal } from '@/components/ui/modal'
import { toast } from 'sonner'
import {
  Wallet, ArrowDownCircle, ArrowUpCircle, AlertTriangle, TrendingUp,
  CheckCircle2, RefreshCw, DollarSign, Building2,
} from 'lucide-react'

type Aba = 'resumo' | 'receber' | 'pagar'

export default function FinanceiroPage() {
  const user = typeof window !== 'undefined' ? getCurrentUser() : null
  const { empresas } = useStore()
  const podeVer = hasPermission(user, 'ver_financeiro') || hasPermission(user, 'gerenciar_usuarios')

  const [aba, setAba] = useState<Aba>('resumo')
  const [reload, setReload] = useState(0)
  const [pagamento, setPagamento] = useState<LancamentoFinanceiro | null>(null)

  const [filtro, setFiltro] = useFiltroPersistente(user?.id, 'financeiro', {
    empresa_id: '',
    desde: '',
    ate: '',
    status: '',
  })

  const lancamentos = useMemo(() => {
    if (typeof window === 'undefined') return []
    let r = getAllLancamentos()
    if (filtro.empresa_id) r = r.filter((l) => l.empresa_id === filtro.empresa_id)
    if (filtro.desde) r = r.filter((l) => l.data_vencimento >= filtro.desde!)
    if (filtro.ate) r = r.filter((l) => l.data_vencimento <= filtro.ate!)
    if (filtro.status) r = r.filter((l) => l.status === filtro.status)
    return r.sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
  }, [filtro, reload])

  const resumo = useMemo(() => {
    if (typeof window === 'undefined') return null
    return calcularResumoFinanceiro({
      desde: filtro.desde || undefined,
      ate: filtro.ate || undefined,
      empresa_id: filtro.empresa_id || undefined,
    })
  }, [filtro, reload])

  const aReceber = lancamentos.filter((l) => l.tipo === 'receber')
  const aPagar = lancamentos.filter((l) => l.tipo === 'pagar')

  function refresh() { setReload((n) => n + 1) }

  function gerarRetroativos() {
    const atendimentos = getAllAtendimentos().filter((a) => a.status === 'finalizado')
    let total = 0
    for (const a of atendimentos) {
      const emp = empresas.find((e) => e.id === a.empresa_id)
      const r = gerarLancamentosDoAtendimento(a, emp)
      if (r.receber || r.pagar) total++
    }
    toast.success(`${total} atendimentos sincronizados com financeiro`)
    refresh()
  }

  if (!podeVer) {
    return (
      <div className="bbt-card p-10 text-center">
        <AlertTriangle className="w-10 h-10 mx-auto text-amber-500 mb-3" />
        <h3 className="font-semibold">Acesso restrito</h3>
        <p className="text-sm text-slate-500 mt-1">Você precisa da permissão "ver_financeiro" para acessar este módulo.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-bbt-primary dark:text-white flex items-center gap-3">
            <Wallet className="w-8 h-8 text-bbt-accent" /> Financeiro
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Contas a pagar, a receber, fluxo de caixa por empresa
          </p>
        </div>
        <button onClick={gerarRetroativos} className="bbt-button-ghost text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Sincronizar com atendimentos
        </button>
      </div>

      <div className="bbt-card p-3 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Empresa</label>
          <select value={filtro.empresa_id || ''} onChange={(e) => setFiltro({ empresa_id: e.target.value })} className="bbt-input text-sm">
            <option value="">Todas</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Desde</label>
          <input type="date" value={filtro.desde || ''} onChange={(e) => setFiltro({ desde: e.target.value })} className="bbt-input text-sm" />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Até</label>
          <input type="date" value={filtro.ate || ''} onChange={(e) => setFiltro({ ate: e.target.value })} className="bbt-input text-sm" />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Status</label>
          <select value={filtro.status || ''} onChange={(e) => setFiltro({ status: e.target.value })} className="bbt-input text-sm">
            <option value="">Todos</option>
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
            <option value="parcial">Parcial</option>
            <option value="atrasado">Atrasado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
        <button onClick={() => setFiltro({ empresa_id: '', desde: '', ate: '', status: '' })}
          className="text-xs text-bbt-accent hover:underline">Limpar filtros</button>
      </div>

      {resumo && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI icon={ArrowDownCircle} cor="text-green-600" label="A Receber" valor={formatarValor(resumo.total_a_receber)} sub={`Recebido: ${formatarValor(resumo.recebido)}`} />
          <KPI icon={ArrowUpCircle} cor="text-red-600" label="A Pagar" valor={formatarValor(resumo.total_a_pagar)} sub={`Pago: ${formatarValor(resumo.pago)}`} />
          <KPI icon={TrendingUp} cor={resumo.saldo_previsto >= 0 ? 'text-green-600' : 'text-red-600'} label="Saldo Previsto" valor={formatarValor(resumo.saldo_previsto)} />
          <KPI icon={AlertTriangle} cor="text-amber-600" label="Atrasados" valor={formatarValor(resumo.atrasados_receber + resumo.atrasados_pagar)} />
        </div>
      )}

      <div className="flex gap-1 bg-bbt-gray-50 dark:bg-slate-800 p-1 rounded-lg w-fit">
        <BtnAba active={aba === 'resumo'} onClick={() => setAba('resumo')} label="Resumo" />
        <BtnAba active={aba === 'receber'} onClick={() => setAba('receber')} label={`A Receber (${aReceber.length})`} />
        <BtnAba active={aba === 'pagar'} onClick={() => setAba('pagar')} label={`A Pagar (${aPagar.length})`} />
      </div>

      {aba === 'resumo' && resumo && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bbt-card p-4">
            <h3 className="font-semibold mb-3">Por categoria</h3>
            <div className="space-y-2">
              {Object.entries(resumo.por_categoria).map(([cat, vals]) => {
                const v = vals as { receber: number; pagar: number }
                return (
                  <div key={cat} className="flex items-center justify-between text-sm border-b border-bbt-gray-100 dark:border-slate-700 py-1.5">
                    <span>{cat}</span>
                    <div className="flex gap-3 text-xs">
                      <span className="text-green-600">+{formatarValor(v.receber)}</span>
                      <span className="text-red-600">-{formatarValor(v.pagar)}</span>
                    </div>
                  </div>
                )
              })}
              {Object.keys(resumo.por_categoria).length === 0 && (
                <p className="text-xs text-slate-400 text-center py-3">Sem dados</p>
              )}
            </div>
          </div>
          <div className="bbt-card p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-bbt-accent" /> Por empresa
            </h3>
            <div className="space-y-2">
              {Object.entries(resumo.por_empresa).map(([empId, vals]) => {
                const emp = empresas.find((e) => e.id === empId)
                const v = vals as { receber: number; pagar: number }
                return (
                  <div key={empId} className="flex items-center justify-between text-sm border-b border-bbt-gray-100 dark:border-slate-700 py-1.5">
                    <span className="truncate">{emp?.nome || empId}</span>
                    <div className="flex gap-3 text-xs whitespace-nowrap">
                      <span className="text-green-600">+{formatarValor(v.receber)}</span>
                      <span className="text-red-600">-{formatarValor(v.pagar)}</span>
                    </div>
                  </div>
                )
              })}
              {Object.keys(resumo.por_empresa).length === 0 && (
                <p className="text-xs text-slate-400 text-center py-3">Sem dados</p>
              )}
            </div>
          </div>
        </div>
      )}

      {(aba === 'receber' || aba === 'pagar') && (
        <div className="bbt-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bbt-gray-50 dark:bg-slate-900/30">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-slate-500">Vencimento</th>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-slate-500">Descrição</th>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-slate-500">{aba === 'receber' ? 'Cliente' : 'Fornecedor'}</th>
                <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-slate-500">Valor</th>
                <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-slate-500">Pago</th>
                <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(aba === 'receber' ? aReceber : aPagar).map((l) => {
                const emp = l.empresa_id ? empresas.find((e) => e.id === l.empresa_id) : null
                return (
                  <tr key={l.id} className="border-t border-bbt-gray-100 dark:border-slate-700 hover:bg-bbt-gray-50 dark:hover:bg-slate-900/30">
                    <td className="px-3 py-2 whitespace-nowrap text-xs">{formatarData(l.data_vencimento)}</td>
                    <td className="px-3 py-2 text-xs">{l.descricao}</td>
                    <td className="px-3 py-2 text-xs truncate max-w-[180px]">{emp?.nome || l.fornecedor_nome || '—'}</td>
                    <td className="px-3 py-2 text-right font-semibold text-sm">{formatarValor(l.valor)}</td>
                    <td className="px-3 py-2 text-right text-xs text-green-600">{formatarValor(l.valor_pago)}</td>
                    <td className="px-3 py-2 text-center"><StatusBadge status={l.status} /></td>
                    <td className="px-3 py-2">
                      {l.status !== 'pago' && l.status !== 'cancelado' && (
                        <button onClick={() => setPagamento(l)} className="text-xs bbt-button-primary py-1 px-2 flex items-center gap-1">
                          <DollarSign className="w-3 h-3" /> {l.tipo === 'pagar' ? 'Pagar' : 'Receber'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {(aba === 'receber' ? aReceber : aPagar).length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">Nenhum lançamento</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!pagamento} onClose={() => setPagamento(null)} title={pagamento ? `${pagamento.tipo === 'pagar' ? 'Pagar' : 'Receber'}: ${pagamento.descricao}` : ''} size="md">
        {pagamento && user && (
          <PagamentoForm lancamento={pagamento} userId={user.id} userName={user.name}
            onSucesso={() => { setPagamento(null); refresh() }} />
        )}
      </Modal>
    </div>
  )
}

function PagamentoForm({ lancamento, userId, userName, onSucesso }: any) {
  const restante = lancamento.valor - lancamento.valor_pago
  const [valor, setValor] = useState(restante)
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [forma, setForma] = useState<FormaPagamento>('PIX')

  function submit() {
    if (valor <= 0) { toast.error('Valor inválido'); return }
    if (pagarLancamento(lancamento.id, valor, data, forma, userId, userName)) {
      toast.success('Lançamento atualizado')
      onSucesso()
    } else { toast.error('Erro') }
  }

  return (
    <div className="space-y-3">
      <div className="text-sm bg-bbt-gray-50 dark:bg-slate-800 rounded-lg p-3">
        <div className="flex justify-between"><span>Valor total</span><strong>{formatarValor(lancamento.valor)}</strong></div>
        <div className="flex justify-between"><span>Já {lancamento.tipo === 'pagar' ? 'pago' : 'recebido'}</span><span className="text-green-600">{formatarValor(lancamento.valor_pago)}</span></div>
        <div className="flex justify-between border-t border-bbt-gray-200 dark:border-slate-700 mt-1 pt-1"><span>Restante</span><strong>{formatarValor(restante)}</strong></div>
      </div>
      <div>
        <label className="text-xs uppercase tracking-wider text-slate-500">Valor</label>
        <input type="number" step="0.01" value={valor} onChange={(e) => setValor(parseFloat(e.target.value) || 0)} className="bbt-input w-full" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs uppercase tracking-wider text-slate-500">Data</label>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="bbt-input w-full" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-slate-500">Forma</label>
          <select value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento)} className="bbt-input w-full">
            <option>PIX</option>
            <option>Boleto</option>
            <option>TED</option>
            <option>Cartão</option>
            <option>Dinheiro</option>
            <option>Faturamento</option>
            <option>Outro</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={submit} className="bbt-button-primary flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Confirmar
        </button>
      </div>
    </div>
  )
}

function KPI({ icon: Icon, cor, label, valor, sub }: any) {
  return (
    <div className="bbt-card p-3">
      <Icon className={`w-5 h-5 ${cor} mb-1`} />
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-lg font-bold">{valor}</div>
      {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}

function BtnAba({ active, onClick, label }: any) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
        active ? 'bg-white dark:bg-slate-700 text-bbt-primary dark:text-white shadow' : 'text-slate-500 hover:text-bbt-primary'
      }`}>{label}</button>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; label: string }> = {
    pendente: { bg: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300', label: 'Pendente' },
    pago: { bg: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: 'Pago' },
    parcial: { bg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', label: 'Parcial' },
    atrasado: { bg: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: 'Atrasado' },
    cancelado: { bg: 'bg-slate-100 text-slate-400 dark:bg-slate-800', label: 'Cancelado' },
  }
  const c = map[status] || map.pendente
  return <span className={`text-[10px] px-2 py-0.5 rounded ${c.bg}`}>{c.label}</span>
}
