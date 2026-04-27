'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  FileSpreadsheet, FileText, Upload, CheckCircle2, AlertCircle, TrendingUp,
  Users, Building2, DollarSign, Loader2, Sparkles,
} from 'lucide-react'
import { parsePlanilhaEmissoes, type ResumoEmissao, type LinhaEmissao } from '@/lib/emissoes-parser'
import { parsePDFEmissoes, type ResumoEmissaoPDF, type LinhaEmissaoPDF } from '@/lib/emissoes-pdf-parser'
import { useStore } from '@/lib/store'
import { addAtendimento, updateAtendimento, getAllAtendimentos, registrarLog } from '@/lib/atendimentos-storage'
import { getCurrentUser, hasPermission, getAgentesBBT } from '@/lib/auth'
import { formatCurrency } from '@/lib/utils'
import { encontrarFuncionarioPorNome } from '@/lib/voucher-parser'
import type { Atendimento, Empresa } from '@/types'

// Tipo unificado para ambos os formatos
type ResumoUnif = {
  formato: 'xlsx' | 'pdf'
  total_vendas: number
  total_faturado?: number
  total_custo?: number
  total_markup?: number
  por_emissor: Record<string, { qtd: number; lucro: number }>
  por_cliente: Record<string, { qtd: number; lucro: number }>
  por_produto?: Record<string, { qtd: number; lucro: number }>
  periodo_detectado: { inicio?: string; fim?: string } | string
  linhasXLSX?: LinhaEmissao[]
  linhasPDF?: LinhaEmissaoPDF[]
}

export default function ImportarEmissoesPage() {
  const router = useRouter()
  const user = typeof window !== 'undefined' ? getCurrentUser() : null
  const { empresas, funcionarios } = useStore()

  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [resumo, setResumo] = useState<ResumoUnif | null>(null)
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState<{ criadas: number; atualizadas: number; ignoradas: number } | null>(null)

  // check permissão
  if (user && !hasPermission(user, 'importar_planilhas')) {
    return <div className="p-8 text-center text-red-600">Você não tem permissão para importar planilhas.</div>
  }

  async function handleFile(f: File) {
    setFile(f)
    setLoading(true)
    setResumo(null)
    setResultado(null)
    try {
      const ext = f.name.toLowerCase().split('.').pop()
      if (ext === 'pdf') {
        const r = await parsePDFEmissoes(f)
        setResumo({
          formato: 'pdf',
          total_vendas: r.total_vendas,
          total_faturado: r.total_faturado,
          total_custo: r.total_custo,
          total_markup: r.total_markup,
          por_emissor: r.por_emissor,
          por_cliente: r.por_cliente,
          por_produto: r.por_produto,
          periodo_detectado: r.periodo_detectado,
          linhasPDF: r.linhas,
        })
        toast.success(`${r.total_vendas} venda(s) detectada(s) no PDF`)
      } else {
        const r = await parsePlanilhaEmissoes(f)
        setResumo({
          formato: 'xlsx',
          total_vendas: r.total_vendas,
          por_emissor: r.por_emissor,
          por_cliente: r.por_cliente,
          periodo_detectado: r.periodo_detectado,
          linhasXLSX: r.linhas,
        })
        toast.success(`${r.total_vendas} venda(s) detectada(s) na planilha`)
      }
    } catch (e: any) {
      console.error(e)
      toast.error('Erro ao ler arquivo: ' + (e?.message || 'formato inválido'))
    } finally {
      setLoading(false)
    }
  }

  /**
   * Mapeia cada linha para:
   * - Empresa (pelo Cod. Cliente ou Nome Cliente)
   * - Funcionário (pelo nome do Pax)
   * - Agente (pelo código emissor)
   * E cria/atualiza o Atendimento
   */
  function importar() {
    if (!resumo || !user) return
    setImportando(true)

    const existentes = getAllAtendimentos()
    const agentes = getAgentesBBT()

    let criadas = 0, atualizadas = 0, ignoradas = 0

    try {
      // Unifica as linhas numa estrutura comum
      interface LinhaUnif {
        venda_numero: string
        data_venda: string
        passageiro: string
        tipo_servico: string
        empresa_nome: string
        cod_cliente?: string
        total: number
        custo: number
        markup: number
        cod_emissor?: string
        status: string
        descricao?: string
        produto?: string
      }

      const linhas: LinhaUnif[] = resumo.formato === 'pdf'
        ? (resumo.linhasPDF || []).map((l) => ({
            venda_numero: l.venda_numero,
            data_venda: l.data_venda,
            passageiro: l.passageiro,
            tipo_servico: l.tipo_servico,
            empresa_nome: l.cliente_nome,
            cod_cliente: l.cod_cliente,
            total: l.total,
            custo: l.custo,
            markup: l.markup,
            cod_emissor: l.emissor,
            status: l.status,
            descricao: l.rota_descricao,
            produto: l.produto,
          }))
        : (resumo.linhasXLSX || []).filter((l) => l.valido).map((l) => ({
            venda_numero: l.venda_numero,
            data_venda: l.data_venda,
            passageiro: l.pax,
            tipo_servico: l.tipo_servico === 'Outro' ? 'Hotel' : l.tipo_servico,
            empresa_nome: l.nome_cliente,
            cod_cliente: l.cod_cliente,
            total: l.total_tarifa,
            custo: l.saldo_pagar,
            markup: l.markup,
            cod_emissor: l.cod_emissor,
            status: l.status || 'CF',
            descricao: l.rota_resumida,
            produto: l.contrato,
          }))

      for (const linha of linhas) {
        if (!linha.passageiro || !linha.venda_numero) { ignoradas++; continue }

        // 1) Empresa: cod_cliente → nome
        let empresa: Empresa | undefined
        if (linha.cod_cliente) {
          empresa = empresas.find((e) =>
            (e.codigo_cliente || '').toLowerCase() === linha.cod_cliente!.toLowerCase()
          )
        }
        if (!empresa && linha.empresa_nome) {
          const nn = linha.empresa_nome.toLowerCase()
          empresa = empresas.find((e) => e.nome.toLowerCase().includes(nn.split(' ')[0]) || nn.includes(e.nome.toLowerCase().split(' ')[0]))
        }
        if (!empresa) { ignoradas++; continue }

        // 2) Funcionário: match pelo nome
        const matches = encontrarFuncionarioPorNome(linha.passageiro, funcionarios, empresa.id)
        const funcionarioId = matches[0]?.score >= 70 ? matches[0].id : null

        // 3) Agente: match pelo código emissor
        let agenteUserId = user.id
        if (linha.cod_emissor) {
          const emissorNorm = linha.cod_emissor.toLowerCase()
          const ag = agentes.find((a) =>
            a.name.toLowerCase().split(' ')[0] === emissorNorm ||
            a.name.toLowerCase().includes(emissorNorm)
          )
          if (ag) agenteUserId = ag.id
        }

        // 4) Verifica duplicata pelo venda_numero
        const existente = existentes.find((a) => a.venda_numero === linha.venda_numero)

        // Extrair datas do descricao se possível (pattern "DD/MM/YY a DD/MM/YY")
        let dataCheckin: string | undefined
        let dataCheckout: string | undefined
        if (linha.descricao) {
          const m = linha.descricao.match(/(\d{2}\/\d{2}\/\d{2,4})\s*a\s*(\d{2}\/\d{2}\/\d{2,4})/)
          if (m) {
            const parseD = (s: string) => {
              const [d, mo, y] = s.split('/')
              const yyyy = y.length === 2 ? '20' + y : y
              return `${yyyy}-${mo}-${d}`
            }
            dataCheckin = parseD(m[1])
            dataCheckout = parseD(m[2])
          }
        }

        const payload: Partial<Atendimento> = {
          empresa_id: empresa.id,
          funcionario_id: funcionarioId,
          passageiro_nome: linha.passageiro,
          tipo_servico: linha.tipo_servico as any,
          valor_cotacao: linha.total,
          valor_final: linha.total,
          valor_custo: linha.custo,
          valor_venda: linha.total,
          markup_valor: linha.markup,
          agente_user_id: agenteUserId,
          status: linha.status === 'CF' ? 'finalizado' : linha.status === 'ND' ? 'em_andamento' : 'finalizado',
          prioridade: 'media',
          origem: 'Portal',
          observacoes: `Importado via ${resumo.formato.toUpperCase()}. ${linha.descricao || ''}`.slice(0, 500),
          data_atendimento: linha.data_venda || new Date().toISOString().slice(0, 10),
          venda_numero: linha.venda_numero,
          emissor_codigo: linha.cod_emissor,
          origem_emissao: resumo.formato === 'pdf' ? 'pdf_emissao' : 'planilha',
          detalhes_hotel: linha.tipo_servico === 'Hotel' ? {
            hotel_nome: linha.produto || '',
            num_hospedes: 1,
            data_checkin: dataCheckin,
            data_checkout: dataCheckout,
          } : undefined,
          detalhes_aereo: linha.tipo_servico === 'Aéreo' ? {
            cia_aerea: linha.produto,
          } : undefined,
        }

        if (existente) {
          updateAtendimento(existente.id, payload)
          atualizadas++
        } else {
          const nova = addAtendimento(payload as any)
          if (nova) criadas++
          else ignoradas++
        }
      }

      registrarLog({
        user_id: user.id, user_name: user.name, acao: 'importar',
        entidade: 'Emissoes', entidade_id: typeof resumo.periodo_detectado === 'string' ? resumo.periodo_detectado : JSON.stringify(resumo.periodo_detectado),
        descricao: `Importou ${criadas} novas, atualizou ${atualizadas}, ignorou ${ignoradas} via ${resumo.formato.toUpperCase()}.`,
      })

      setResultado({ criadas, atualizadas, ignoradas })
      toast.success(`✅ ${criadas} novas · ${atualizadas} atualizadas · ${ignoradas} ignoradas`, { duration: 5000 })
    } catch (e: any) {
      console.error(e)
      toast.error('Erro na importação: ' + e?.message)
    } finally {
      setImportando(false)
    }
  }

  function resetar() {
    setFile(null); setResumo(null); setResultado(null)
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold text-bbt-primary dark:text-white flex items-center gap-3">
          <FileSpreadsheet className="w-8 h-8 text-bbt-accent" /> Importar Planilha de Emissões
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Alimenta o sistema com os dados do seu sistema de emissão (previsão de lucros)
        </p>
      </div>

      <div className="bbt-card p-4 bg-gradient-to-br from-bbt-accent/5 to-transparent border-bbt-accent/30">
        <div className="flex gap-3">
          <Sparkles className="w-5 h-5 text-bbt-accent shrink-0 mt-0.5" />
          <div className="text-sm space-y-1.5">
            <div className="font-semibold text-bbt-primary dark:text-white">Como funciona</div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              Exporte sua "previsão de lucros" do sistema de emissão em Excel (.xlsx), envie aqui.
              O sistema detecta automaticamente: venda nº, data, produto (HTL/TKT), cliente, passageiro,
              tarifa, markup, lucro e emissor.
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              <strong>Cada venda vira uma demanda finalizada</strong> com os valores reais. O sistema
              detecta duplicatas pelo Nº da Venda (se reimportar, atualiza em vez de duplicar).
            </div>
          </div>
        </div>
      </div>

      {!resumo ? (
        <label className="bbt-card p-10 text-center cursor-pointer hover:border-bbt-accent hover:bg-bbt-accent/5 transition block border-2 border-dashed border-bbt-gray-100 dark:border-slate-700">
          {loading ? (
            <>
              <Loader2 className="w-12 h-12 mx-auto text-bbt-accent mb-3 animate-spin" />
              <p className="font-semibold text-bbt-primary dark:text-white">Analisando arquivo...</p>
              <p className="text-xs text-slate-500 mt-1">Extraindo linhas de emissão</p>
            </>
          ) : (
            <>
              <div className="flex justify-center gap-3 mb-3">
                <FileSpreadsheet className="w-10 h-10 text-emerald-500" />
                <FileText className="w-10 h-10 text-red-500" />
              </div>
              <p className="font-semibold text-bbt-primary dark:text-white">Clique para selecionar o arquivo</p>
              <p className="text-xs text-slate-500 mt-1">.xlsx, .xls ou .pdf · extraído do seu sistema de emissão</p>
              <p className="text-[10px] text-slate-400 mt-2">PDF recomendado — mostra valores detalhados (Tarifa, Custo, Markup)</p>
            </>
          )}
          <input type="file" accept=".xlsx,.xls,.pdf" disabled={loading}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="hidden" />
        </label>
      ) : (
        <div className="space-y-5">
          {/* RESUMO */}
          <div className="bbt-card p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="font-semibold text-bbt-primary dark:text-white">
                📊 Resumo {resumo.formato === 'pdf' ? 'do PDF' : 'da planilha'}
                {resumo.periodo_detectado && typeof resumo.periodo_detectado === 'object' && resumo.periodo_detectado.inicio && (
                  <span className="ml-2 text-xs text-slate-500 font-normal">
                    Período: {resumo.periodo_detectado.inicio} → {resumo.periodo_detectado.fim}
                  </span>
                )}
                {typeof resumo.periodo_detectado === 'string' && (
                  <span className="ml-2 text-xs text-slate-500 font-normal">Período: {resumo.periodo_detectado}</span>
                )}
              </h3>
              <button onClick={resetar} className="text-xs text-red-600 hover:underline">Trocar arquivo</button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <Stat label="Vendas" value={String(resumo.total_vendas)} color="bbt" />
              <Stat label="Tarifa Total" value={formatCurrency(resumo.total_tarifa)} color="blue" />
              <Stat label="Custo Total" value={formatCurrency(resumo.total_custo)} color="orange" />
              <Stat label="Markup" value={formatCurrency(resumo.total_markup)} color="green" />
              <Stat label="Lucro Previsto" value={formatCurrency(resumo.total_lucro)} color="bbt" highlight />
            </div>

            {/* Por emissor */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2 flex items-center gap-1">
                  <Users className="w-3 h-3" /> Por Emissor
                </h4>
                <div className="space-y-1">
                  {(Object.entries(resumo.por_emissor) as Array<[string, {qtd: number; lucro: number}]>).sort((a, b) => b[1].lucro - a[1].lucro).slice(0, 6).map(([emissor, v]) => (
                    <div key={emissor} className="flex justify-between text-xs p-2 rounded bg-bbt-gray-50 dark:bg-slate-800">
                      <span className="font-medium">{emissor}</span>
                      <span className="text-slate-500">{v.qtd} · {formatCurrency(v.lucro)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2 flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> Top Clientes
                </h4>
                <div className="space-y-1">
                  {(Object.entries(resumo.por_cliente) as Array<[string, {qtd: number; lucro: number}]>).sort((a, b) => b[1].lucro - a[1].lucro).slice(0, 6).map(([cli, v]) => (
                    <div key={cli} className="flex justify-between text-xs p-2 rounded bg-bbt-gray-50 dark:bg-slate-800">
                      <span className="font-medium truncate">{cli}</span>
                      <span className="text-slate-500 shrink-0 ml-2">{v.qtd} · {formatCurrency(v.lucro)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* PREVIEW DE LINHAS */}
          <div className="bbt-card overflow-hidden">
            <div className="p-4 border-b border-bbt-gray-100 dark:border-slate-700">
              <h4 className="font-semibold text-sm">Preview — primeiras 10 linhas</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-bbt-gray-50 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-2 py-2 text-left font-semibold">Venda</th>
                    <th className="px-2 py-2 text-left font-semibold">Data</th>
                    <th className="px-2 py-2 text-left font-semibold">Cliente</th>
                    <th className="px-2 py-2 text-left font-semibold">Pax</th>
                    <th className="px-2 py-2 text-left font-semibold">Prod.</th>
                    <th className="px-2 py-2 text-right font-semibold">Tarifa</th>
                    <th className="px-2 py-2 text-right font-semibold">Custo</th>
                    <th className="px-2 py-2 text-right font-semibold">Lucro</th>
                    <th className="px-2 py-2 text-left font-semibold">Emissor</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Linhas unificadas pro preview (XLSX ou PDF)
                    const linhasPreview: Array<{
                      venda_numero: string
                      data_venda: string
                      cliente: string
                      pax: string
                      produto: string
                      total: number
                      custo: number
                      markup: number
                      emissor: string
                    }> = resumo.formato === 'pdf'
                      ? (resumo.linhasPDF || []).map((l) => ({
                          venda_numero: l.venda_numero,
                          data_venda: l.data_venda,
                          cliente: l.cliente_nome,
                          pax: l.passageiro,
                          produto: l.produto,
                          total: l.total,
                          custo: l.custo,
                          markup: l.markup,
                          emissor: l.emissor,
                        }))
                      : (resumo.linhasXLSX || []).map((l) => ({
                          venda_numero: l.venda_numero,
                          data_venda: l.data_venda,
                          cliente: l.nome_cliente,
                          pax: l.pax,
                          produto: l.produto,
                          total: l.total_tarifa,
                          custo: l.saldo_pagar,
                          markup: l.previsao_lucro,
                          emissor: l.cod_emissor,
                        }))
                    return linhasPreview.slice(0, 10).map((l, i) => (
                      <tr key={i} className="border-t border-bbt-gray-100 dark:border-slate-700">
                        <td className="px-2 py-1.5 font-mono">{l.venda_numero}</td>
                        <td className="px-2 py-1.5 text-slate-500">{l.data_venda}</td>
                        <td className="px-2 py-1.5 truncate max-w-[140px]">{l.cliente}</td>
                        <td className="px-2 py-1.5 font-medium truncate max-w-[140px]">{l.pax}</td>
                        <td className="px-2 py-1.5">
                          <span className="bbt-badge text-[9px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            {l.produto}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-right">{formatCurrency(l.total)}</td>
                        <td className="px-2 py-1.5 text-right text-orange-600">{formatCurrency(l.custo)}</td>
                        <td className="px-2 py-1.5 text-right text-green-600 font-semibold">{formatCurrency(l.markup)}</td>
                        <td className="px-2 py-1.5">{l.emissor}</td>
                      </tr>
                    ))
                  })()}
                </tbody>
              </table>
            </div>
            {(() => {
              const qtd = resumo.formato === 'pdf' ? (resumo.linhasPDF?.length || 0) : (resumo.linhasXLSX?.length || 0)
              if (qtd > 10) {
                return (
                  <div className="p-2 text-center text-xs text-slate-500 bg-bbt-gray-50 dark:bg-slate-900/40">
                    ... e mais {qtd - 10} linhas
                  </div>
                )
              }
              return null
            })()}
          </div>

          {/* AÇÃO */}
          {!resultado ? (
            <div className="flex justify-end gap-2">
              <button onClick={resetar} className="bbt-button-ghost">Cancelar</button>
              <button onClick={importar} disabled={importando}
                className="bbt-button-primary flex items-center gap-2">
                {importando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Importar {resumo.total_vendas} venda(s)
              </button>
            </div>
          ) : (
            <div className="bbt-card p-5 border-2 border-green-300 dark:border-green-700">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                <h3 className="font-semibold text-lg text-green-700 dark:text-green-400">Importação concluída!</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Criadas" value={String(resultado.criadas)} color="green" />
                <Stat label="Atualizadas" value={String(resultado.atualizadas)} color="blue" />
                <Stat label="Ignoradas" value={String(resultado.ignoradas)} color="slate" />
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={resetar} className="bbt-button-ghost">Importar outra planilha</button>
                <button onClick={() => router.push('/dashboard/meu-perfil')} className="bbt-button-primary">
                  Ver demandas importadas
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color = 'slate', highlight = false }: { label: string; value: string; color?: string; highlight?: boolean }) {
  const colors: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    bbt: 'bg-gradient-to-br from-bbt-primary to-bbt-primary-light text-white shadow-md',
  }
  return (
    <div className={`rounded-lg p-3 ${colors[color]} ${highlight ? 'ring-2 ring-bbt-accent ring-offset-2 dark:ring-offset-slate-900' : ''}`}>
      <div className="text-[10px] uppercase tracking-wider font-semibold opacity-80">{label}</div>
      <div className="text-lg font-bold mt-0.5">{value}</div>
    </div>
  )
}
