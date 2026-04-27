'use client'
import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { getCurrentUser } from '@/lib/auth'
import { parseMensagem, type MensagemParsed } from '@/lib/mensagem-parser'
import { encontrarFuncionarioPorNome, encontrarFuncionarioPorCPF } from '@/lib/voucher-parser'
import { addAtendimento, registrarLog } from '@/lib/atendimentos-storage'
import { toast } from 'sonner'
import {
  Inbox, Sparkles, Clipboard, Send, User as UserIcon, Building2, Calendar,
  MapPin, Hotel as HotelIcon, Plane, Car, Package, CheckCircle2, AlertCircle,
  Tag, Clock, Edit3, Zap, Eraser,
} from 'lucide-react'
import type { Atendimento, TipoServico, Prioridade, Funcionario } from '@/types'
import { labelOcupante } from '@/types'
import { NovaDemandaModal } from '@/components/ui/nova-demanda-modal'

interface MatchFunc { id: string; nome: string; empresa_id: string; score: number }

export default function CaixaEntradaPage() {
  const router = useRouter()
  const { empresas, funcionarios } = useStore()

  const [texto, setTexto] = useState('')
  const [parsed, setParsed] = useState<MensagemParsed | null>(null)
  const [empresaId, setEmpresaId] = useState('')
  const [funcionarioId, setFuncionarioId] = useState<string | null>(null)
  const [passageiroNome, setPassageiroNome] = useState('')
  const [sugestoesFunc, setSugestoesFunc] = useState<MatchFunc[]>([])
  const [prioridade, setPrioridade] = useState<Prioridade>('media')
  const [tipoServico, setTipoServico] = useState<TipoServico>('Hotel')
  const [criandoRapido, setCriandoRapido] = useState(false)
  const [demandaCriada, setDemandaCriada] = useState<Atendimento | null>(null)
  const [modalAbrirParaEditar, setModalAbrirParaEditar] = useState<Atendimento | null>(null)

  // Analisa texto em tempo real (com debounce leve)
  useEffect(() => {
    if (!texto || texto.trim().length < 10) {
      setParsed(null)
      return
    }
    const timer = setTimeout(() => {
      const r = parseMensagem(texto)
      setParsed(r)

      // Auto-preenche
      if (r.passageiro_nome) setPassageiroNome(r.passageiro_nome)
      if (r.tipo_servico) setTipoServico(r.tipo_servico)
      if (r.urgente) setPrioridade('urgente')

      // Tentar match empresa por nome
      if (r.empresa_nome && !empresaId) {
        const en = r.empresa_nome.toLowerCase()
        const emp = empresas.find((e) =>
          e.nome.toLowerCase().includes(en) || en.includes(e.nome.toLowerCase().split(' ')[0])
        )
        if (emp) setEmpresaId(emp.id)
      }

      // Match funcionário por CPF primeiro
      if (r.cpf) {
        const porCpf = encontrarFuncionarioPorCPF(r.cpf, funcionarios)
        if (porCpf) {
          setFuncionarioId(porCpf.id)
          if (!empresaId) setEmpresaId(porCpf.empresa_id)
          setPassageiroNome(porCpf.nome)
          setSugestoesFunc([])
          return
        }
      }

      // Match por nome
      if (r.passageiro_nome) {
        const matches = encontrarFuncionarioPorNome(r.passageiro_nome, funcionarios, empresaId || undefined)
        setSugestoesFunc(matches)
        if (matches[0]?.score >= 85) {
          setFuncionarioId(matches[0].id)
          if (!empresaId) setEmpresaId(matches[0].empresa_id)
        }
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [texto, empresas, funcionarios, empresaId])

  async function colarDoClipboard() {
    try {
      const t = await navigator.clipboard.readText()
      setTexto(t)
      toast.success('Texto colado')
    } catch {
      toast.error('Não foi possível ler área de transferência. Cole com Ctrl+V.')
    }
  }

  function limparTudo() {
    setTexto(''); setParsed(null); setEmpresaId(''); setFuncionarioId(null)
    setPassageiroNome(''); setSugestoesFunc([]); setPrioridade('media'); setTipoServico('Hotel')
    setDemandaCriada(null)
  }

  async function criarDemandaRapida() {
    const user = getCurrentUser()
    if (!user) { toast.error('Faça login.'); return }
    if (!empresaId) { toast.error('Selecione uma empresa.'); return }
    if (!passageiroNome.trim()) { toast.error(`Preencha o nome do ${labelOcupante(tipoServico).toLowerCase()}.`); return }

    setCriandoRapido(true)

    const payload: Omit<Atendimento, 'id' | 'created_at' | 'updated_at'> = {
      empresa_id: empresaId,
      funcionario_id: funcionarioId,
      passageiro_nome: passageiroNome.trim(),
      tipo_servico: tipoServico,
      valor_cotacao: 0,
      agente_user_id: user.id,
      status: 'em_andamento',
      prioridade,
      origem: 'WhatsApp',
      observacoes: texto.trim().slice(0, 2000),
      data_atendimento: new Date().toISOString().slice(0, 10),
      detalhes_aereo: tipoServico === 'Aéreo' ? {
        origem: parsed?.cidade_origem, destino: parsed?.cidade_destino,
        data_ida: parsed?.data_ida, data_volta: parsed?.data_volta,
      } : undefined,
      detalhes_hotel: tipoServico === 'Hotel' ? {
        hotel_nome: parsed?.hotel_nome,
        cidade: parsed?.cidade_destino,
        data_checkin: parsed?.data_checkin,
        data_checkout: parsed?.data_checkout,
        num_hospedes: parsed?.num_hospedes || 1,
      } : undefined,
      origem_emissao: 'caixa_entrada',
    }

    await new Promise((r) => setTimeout(r, 400))
    const nova = addAtendimento(payload)
    if (!nova) { toast.error('Erro.'); setCriandoRapido(false); return }

    registrarLog({
      user_id: user.id, user_name: user.name, acao: 'criar',
      entidade: 'Atendimento', entidade_id: nova.id,
      descricao: `Criou via Caixa de Entrada: ${passageiroNome}`,
    })

    setDemandaCriada(nova)
    toast.success('Demanda criada! Abrindo para completar dados...')
    setCriandoRapido(false)
  }

  function abrirModalParaCompletar() {
    if (!demandaCriada) return
    setModalAbrirParaEditar(demandaCriada)
  }

  const TIPOS: { value: TipoServico; label: string; icon: any }[] = [
    { value: 'Hotel', label: 'Hotel', icon: HotelIcon },
    { value: 'Aéreo', label: 'Aéreo', icon: Plane },
    { value: 'Carro', label: 'Locação', icon: Car },
    { value: 'Pacote', label: 'Pacote', icon: Package },
  ]

  const ocupanteLabel = labelOcupante(tipoServico)
  const empresaSelecionada = empresas.find((e) => e.id === empresaId)

  const modoBadge = parsed?.modo === 'estruturado'
    ? { txt: 'Detecção estruturada', cor: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' }
    : parsed?.modo === 'conversacional'
      ? { txt: 'Detecção conversacional', cor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' }
      : null

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-bbt-primary dark:text-white flex items-center gap-3">
          <Inbox className="w-8 h-8 text-bbt-accent" /> Caixa de Entrada
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Cole uma mensagem de WhatsApp ou e-mail — o sistema extrai os dados e cria a demanda
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* LEFT: Texto */}
        <div className="space-y-3">
          <div className="bbt-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Clipboard className="w-4 h-4 text-bbt-accent" /> Mensagem recebida
              </h3>
              <div className="flex gap-2">
                <button onClick={colarDoClipboard} className="text-xs bbt-button-ghost flex items-center gap-1">
                  <Clipboard className="w-3 h-3" /> Colar
                </button>
                {texto && (
                  <button onClick={limparTudo} className="text-xs text-red-600 hover:underline flex items-center gap-1">
                    <Eraser className="w-3 h-3" /> Limpar
                  </button>
                )}
              </div>
            </div>

            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={`Cole aqui a mensagem. Exemplos:

MODO ESTRUTURADO (máxima precisão):
Nome: Felipe Manrique
CPF: 074.049.391-43
Cidade: Trindade
Hotel: Liguori
Check in: 15/03
Check out: 18/03
Empresa: Way

MODO CONVERSACIONAL:
"Oi Felipe boa tarde, preciso de hotel em Uberlândia pra Ana Silva do dia 28 ao 30. Vitamedic. Urgente!"`}
              rows={15}
              className="w-full p-3 text-sm rounded-lg border border-bbt-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 text-bbt-text dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-bbt-accent resize-none font-mono"
            />

            {modoBadge && (
              <div className="mt-2 flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${modoBadge.cor}`}>
                  <Sparkles className="w-3 h-3 inline mr-1" /> {modoBadge.txt}
                </span>
                {parsed?.urgente && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    <Zap className="w-3 h-3 inline mr-1" /> Urgência detectada
                  </span>
                )}
              </div>
            )}
          </div>

          {parsed && (
            <div className="bbt-card p-4 bg-gradient-to-br from-bbt-accent/5 to-transparent border-bbt-accent/30">
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-bbt-accent" /> Dados extraídos
              </h4>
              <div className="space-y-1 text-xs">
                {parsed.passageiro_nome && <DadoExtraido icon={UserIcon} label={ocupanteLabel} value={parsed.passageiro_nome} auto={parsed.fontes?.passageiro_nome === 'label'} />}
                {parsed.cpf && <DadoExtraido icon={Tag} label="CPF" value={parsed.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')} auto={parsed.fontes?.cpf === 'label'} />}
                {parsed.empresa_nome && <DadoExtraido icon={Building2} label="Empresa" value={parsed.empresa_nome} auto={parsed.fontes?.empresa_nome === 'label'} />}
                {parsed.hotel_nome && <DadoExtraido icon={HotelIcon} label="Hotel" value={parsed.hotel_nome} auto={parsed.fontes?.hotel_nome === 'label'} />}
                {parsed.cidade_destino && <DadoExtraido icon={MapPin} label="Cidade" value={parsed.cidade_destino} auto={parsed.fontes?.cidade_destino === 'label'} />}
                {parsed.data_checkin && <DadoExtraido icon={Calendar} label="Check-in" value={formatarData(parsed.data_checkin)} auto={parsed.fontes?.data_checkin === 'label'} />}
                {parsed.data_checkout && <DadoExtraido icon={Calendar} label="Check-out" value={formatarData(parsed.data_checkout)} auto={parsed.fontes?.data_checkout === 'label'} />}
                {parsed.data_ida && <DadoExtraido icon={Calendar} label="Ida" value={formatarData(parsed.data_ida)} auto={parsed.fontes?.data_ida === 'label'} />}
                {parsed.data_volta && <DadoExtraido icon={Calendar} label="Volta" value={formatarData(parsed.data_volta)} auto={parsed.fontes?.data_volta === 'label'} />}
                {parsed.num_hospedes && <DadoExtraido icon={UserIcon} label={tipoServico === 'Hotel' ? 'Hóspedes' : 'Pax'} value={String(parsed.num_hospedes)} />}
                {parsed.telefone && <DadoExtraido icon={Tag} label="Telefone" value={parsed.telefone} auto={parsed.fontes?.telefone === 'label'} />}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Form pra ajustar e criar */}
        <div className="space-y-3">
          <div className="bbt-card p-4">
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-4 h-4 text-green-500" /> Confirmar e criar
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1.5 tracking-wider">Empresa *</label>
                <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} className="bbt-input">
                  <option value="">Selecione...</option>
                  {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
                {empresaSelecionada && empresaSelecionada.config_cobranca && !empresaSelecionada.config_cobranca.aplicar_markup && (
                  <div className="text-[10px] text-orange-600 mt-1">⚠ Esta empresa está configurada SEM markup</div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1.5 tracking-wider">
                  {ocupanteLabel} *
                </label>
                <input
                  value={passageiroNome}
                  onChange={(e) => { setPassageiroNome(e.target.value); setFuncionarioId(null) }}
                  placeholder={`Nome do ${ocupanteLabel.toLowerCase()}`}
                  className="bbt-input"
                />
                {funcionarioId && (
                  <div className="text-[10px] text-green-700 dark:text-green-400 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Funcionário vinculado
                  </div>
                )}
                {!funcionarioId && sugestoesFunc.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="text-[10px] text-slate-500">Sugestões:</div>
                    {sugestoesFunc.slice(0, 3).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setFuncionarioId(m.id)
                          setPassageiroNome(m.nome)
                          setEmpresaId(m.empresa_id)
                        }}
                        className="w-full text-left text-xs px-2 py-1 rounded bg-bbt-accent/5 hover:bg-bbt-accent/15 border border-bbt-accent/20"
                      >
                        <span className="font-medium">{m.nome}</span>
                        <span className="ml-2 text-[10px] text-slate-500">({m.score}% match)</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-2 tracking-wider">Tipo</label>
                <div className="grid grid-cols-4 gap-2">
                  {TIPOS.map((t) => {
                    const Icon = t.icon
                    const active = tipoServico === t.value
                    return (
                      <button key={t.value} type="button" onClick={() => setTipoServico(t.value)}
                        className={`p-2 rounded-lg border-2 text-center transition ${
                          active ? 'border-bbt-accent bg-bbt-accent/10 text-bbt-primary dark:text-bbt-accent'
                          : 'border-bbt-gray-100 dark:border-slate-700 text-slate-500 hover:border-bbt-accent/50'
                        }`}>
                        <Icon className="w-4 h-4 mx-auto mb-0.5" />
                        <div className="text-[10px] font-semibold">{t.label}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-2 tracking-wider">Prioridade</label>
                <div className="flex gap-1">
                  {(['baixa', 'media', 'alta', 'urgente'] as const).map((p) => (
                    <button key={p} type="button" onClick={() => setPrioridade(p)}
                      className={`flex-1 px-2 py-1.5 text-xs font-semibold rounded transition ${
                        prioridade === p
                          ? p === 'urgente' ? 'bg-red-100 text-red-700 ring-2 ring-red-300'
                          : p === 'alta' ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300'
                          : p === 'media' ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-300'
                          : 'bg-slate-100 text-slate-700 ring-2 ring-slate-300'
                          : 'bg-slate-50 text-slate-500 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {!demandaCriada ? (
            <button onClick={criarDemandaRapida} disabled={criandoRapido || !empresaId || !passageiroNome}
              className="w-full bbt-button-primary h-12 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              {criandoRapido ? (<><Clock className="w-4 h-4 animate-spin" /> Criando...</>) : (<><Send className="w-4 h-4" /> Criar Demanda Rápida</>)}
            </button>
          ) : (
            <div className="bbt-card p-4 bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-700">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <h4 className="font-semibold text-green-700 dark:text-green-400">Demanda criada!</h4>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 mb-3">
                ID: <strong>{demandaCriada.id}</strong> · <strong>{demandaCriada.passageiro_nome}</strong>
              </div>
              <div className="flex gap-2">
                <button onClick={limparTudo} className="bbt-button-ghost text-xs flex-1">Nova mensagem</button>
                <button onClick={abrirModalParaCompletar} className="bbt-button-primary text-xs flex-1 flex items-center justify-center gap-1">
                  <Edit3 className="w-3 h-3" /> Completar dados
                </button>
                <button onClick={() => router.push('/dashboard/meu-perfil')} className="bbt-button-ghost text-xs">
                  Ver demandas
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de edição completa */}
      <NovaDemandaModal
        open={!!modalAbrirParaEditar}
        onClose={() => { setModalAbrirParaEditar(null); }}
        editing={modalAbrirParaEditar}
        onSaved={() => {
          toast.success('Demanda atualizada!')
          setModalAbrirParaEditar(null)
        }}
      />
    </div>
  )
}

function DadoExtraido({ icon: Icon, label, value, auto }: { icon: any; label: string; value: string; auto?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3 h-3 text-bbt-accent shrink-0" />
      <span className="text-slate-600 dark:text-slate-400">{label}:</span>
      <strong className="text-bbt-primary dark:text-white">{value}</strong>
      {auto && <span className="text-[9px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-1 rounded">label</span>}
    </div>
  )
}

function formatarData(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
