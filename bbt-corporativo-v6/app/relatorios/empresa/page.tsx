'use client'
import { useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import { useStore } from '@/lib/store'
import { getAtendimentosFiltro, getEstatisticas, getEstatisticasPorTipo } from '@/lib/atendimentos-storage'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { StatusAtendimento, TipoServico } from '@/types'
import { STATUS_LABEL, calcularFinanceiro } from '@/types'
import { Printer, ArrowLeft } from 'lucide-react'

export default function RelatorioEmpresaPage() {
  const sp = useSearchParams()
  const empresaId = sp.get('empresa') || ''
  const inicio = sp.get('inicio') || '1970-01-01'
  const fim = sp.get('fim') || new Date().toISOString().slice(0, 10)

  const { empresas } = useStore()
  const empresa = empresas.find((e) => e.id === empresaId)

  const filtro = useMemo(() => ({ empresa_id: empresaId, data_inicio: inicio, data_fim: fim }), [empresaId, inicio, fim])
  const atendimentos = useMemo(() => getAtendimentosFiltro(filtro), [filtro])
  const stats = useMemo(() => getEstatisticas(filtro), [filtro])
  const statsTipo = useMemo(() => getEstatisticasPorTipo(filtro), [filtro])

  if (!empresa) return <div className="p-8 text-center">Empresa não encontrada.</div>

  function imprimir() { window.print() }

  return (
    <>
      <div className="print:hidden bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <button onClick={() => window.close()} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> Fechar
        </button>
        <div className="text-xs text-slate-500">Use "Imprimir" e escolha "Salvar como PDF"</div>
        <button onClick={imprimir} className="flex items-center gap-2 bg-bbt-primary text-white px-4 py-2 rounded-lg hover:bg-bbt-primary-mid transition shadow-md">
          <Printer className="w-4 h-4" /> Imprimir / Salvar PDF
        </button>
      </div>

      <div className="bbt-relatorio-folha max-w-5xl mx-auto p-8 bg-white text-black" style={{ minHeight: '100vh' }}>
        <div className="border-b-4 pb-4 mb-6" style={{ borderColor: '#0A2540' }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">BBT Corporativo</div>
              <h1 className="text-3xl font-bold mt-1" style={{ color: '#0A2540' }}>Relatório Financeiro por Empresa</h1>
              <div className="mt-3">
                <div className="text-2xl font-bold" style={{ color: '#0A2540' }}>{empresa.nome}</div>
                <div className="text-sm text-slate-600">CNPJ: {empresa.cnpj}</div>
              </div>
              <div className="text-sm text-slate-600 mt-2">
                Período: <strong>{formatDate(inicio)}</strong> até <strong>{formatDate(fim)}</strong>
              </div>
            </div>
            <div className="text-right text-xs text-slate-500 shrink-0">
              Emitido em<br />
              <strong>{new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR')}</strong>
            </div>
          </div>
        </div>

        <section className="mb-6">
          <H2>Quadro Executivo</H2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="p-5 rounded-lg text-white shadow-md" style={{ background: 'linear-gradient(135deg, #0A2540 0%, #1e4976 100%)' }}>
              <div className="text-xs uppercase tracking-wider opacity-80 font-semibold">💰 Total Faturado (cliente paga)</div>
              <div className="text-3xl font-bold mt-1">{formatCurrency(stats.faturado_total)}</div>
              <div className="text-xs opacity-80 mt-1">Venda ({formatCurrency(stats.venda_total)}) + Taxa ({formatCurrency(stats.taxa_total)})</div>
            </div>
            <div className="p-5 rounded-lg" style={{ background: '#fff7ed', border: '2px solid #fdba74' }}>
              <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: '#9a3412' }}>💸 Custo Total (BBT paga)</div>
              <div className="text-3xl font-bold mt-1" style={{ color: '#ea580c' }}>{formatCurrency(stats.custo_total)}</div>
              <div className="text-xs mt-1" style={{ color: '#9a3412' }}>Valor pago aos fornecedores</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-5 rounded-lg" style={{ background: '#f0fdf4', border: '2px solid #86efac' }}>
              <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: '#166534' }}>📈 Markup (Lucro da Operação)</div>
              <div className="text-3xl font-bold mt-1" style={{ color: '#16a34a' }}>{formatCurrency(stats.markup_total)}</div>
              <div className="text-xs mt-1" style={{ color: '#166534' }}>Venda − Custo · Margem {stats.margem_media_pct.toFixed(1)}%</div>
            </div>
            <div className="p-5 rounded-lg" style={{ background: '#faf5ff', border: '2px solid #d8b4fe' }}>
              <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: '#6b21a8' }}>💠 Taxas Cobradas</div>
              <div className="text-3xl font-bold mt-1" style={{ color: '#9333ea' }}>{formatCurrency(stats.taxa_total)}</div>
              <div className="text-xs mt-1" style={{ color: '#6b21a8' }}>Receita adicional não contabilizada no markup</div>
            </div>
          </div>

          <div className="mt-3 p-3 rounded-lg text-sm" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <strong>Lucro BBT consolidado neste período:</strong>{' '}
            <span style={{ color: '#16a34a', fontWeight: 'bold', fontSize: '1.1em' }}>{formatCurrency(stats.markup_total + stats.taxa_total)}</span>
            {' '}(Markup + Taxas)
          </div>
        </section>

        <section className="mb-6">
          <H2>Detalhamento por Categoria de Serviço</H2>
          <table className="w-full text-sm border-collapse">
            <thead><tr style={{ backgroundColor: '#f1f5f9' }}>
              <TH>Categoria</TH><TH align="right">Qtd</TH><TH align="right">Custo</TH><TH align="right">Venda</TH>
              <TH align="right">Markup</TH><TH align="right">Taxa</TH><TH align="right">Faturado</TH>
            </tr></thead>
            <tbody>
              {(Object.entries(statsTipo) as [TipoServico, any][]).filter(([, v]) => v.quantidade > 0).map(([tipo, v]) => (
                <tr key={tipo}>
                  <TD><strong>{tipo}</strong></TD>
                  <TD align="right">{v.quantidade}</TD>
                  <TD align="right" color="#ea580c">{formatCurrency(v.custo)}</TD>
                  <TD align="right">{formatCurrency(v.venda)}</TD>
                  <TD align="right" color="#16a34a"><strong>{formatCurrency(v.markup)}</strong></TD>
                  <TD align="right" color="#9333ea">{formatCurrency(v.taxa)}</TD>
                  <TD align="right"><strong>{formatCurrency(v.faturado)}</strong></TD>
                </tr>
              ))}
              <tr style={{ backgroundColor: '#0A2540', color: 'white' }}>
                <TD dark><strong>TOTAL</strong></TD>
                <TD dark align="right"><strong>{stats.total}</strong></TD>
                <TD dark align="right"><strong>{formatCurrency(stats.custo_total)}</strong></TD>
                <TD dark align="right"><strong>{formatCurrency(stats.venda_total)}</strong></TD>
                <TD dark align="right"><strong>{formatCurrency(stats.markup_total)}</strong></TD>
                <TD dark align="right"><strong>{formatCurrency(stats.taxa_total)}</strong></TD>
                <TD dark align="right"><strong>{formatCurrency(stats.faturado_total)}</strong></TD>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="mb-6">
          <H2>Situação das Demandas</H2>
          <table className="w-full text-sm border-collapse">
            <thead><tr style={{ backgroundColor: '#f1f5f9' }}>
              <TH>Status</TH><TH align="right">Quantidade</TH><TH align="right">% do Total</TH>
            </tr></thead>
            <tbody>
              {(Object.entries(stats.por_status) as [StatusAtendimento, number][]).filter(([, qtd]) => qtd > 0).map(([st, qtd]) => (
                <tr key={st}>
                  <TD>{STATUS_LABEL[st]}</TD>
                  <TD align="right"><strong>{qtd}</strong></TD>
                  <TD align="right">{stats.total > 0 ? ((qtd / stats.total) * 100).toFixed(1) : '0'}%</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mb-6">
          <H2>Detalhamento — Cada Demanda ({atendimentos.length})</H2>
          {atendimentos.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma demanda no período.</p>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead><tr style={{ backgroundColor: '#f1f5f9' }}>
                <TH>Data</TH><TH>Passageiro</TH><TH>Tipo</TH><TH>Localizador</TH>
                <TH align="right">Custo</TH><TH align="right">Venda</TH>
                <TH align="right">Markup</TH><TH align="right">Taxa</TH><TH align="right">Total</TH>
              </tr></thead>
              <tbody>
                {atendimentos.map((a) => {
                  const loc = a.detalhes_aereo?.localizador || a.detalhes_hotel?.localizador || a.detalhes_carro?.localizador || a.detalhes_pacote?.localizador || '—'
                  const calc = calcularFinanceiro(a)
                  return (
                    <tr key={a.id}>
                      <TD small>{formatDate(a.data_atendimento)}</TD>
                      <TD small><strong>{a.passageiro_nome}</strong></TD>
                      <TD small>{a.tipo_servico}</TD>
                      <TD small mono>{loc}</TD>
                      <TD small align="right" color="#ea580c">{formatCurrency(calc.custo)}</TD>
                      <TD small align="right">{formatCurrency(calc.venda)}</TD>
                      <TD small align="right" color="#16a34a"><strong>{formatCurrency(calc.markup)}</strong></TD>
                      <TD small align="right" color="#9333ea">{formatCurrency(calc.taxa_valor)}</TD>
                      <TD small align="right"><strong>{formatCurrency(calc.total_faturado)}</strong></TD>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>

        <div className="text-xs text-slate-500 text-center mt-8 pt-4 border-t border-slate-200">
          Relatório gerado automaticamente pelo sistema BBT Corporativo<br />
          Documento confidencial — uso interno
        </div>
      </div>
    </>
  )
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold mb-3 pb-1 border-b-2" style={{ color: '#0A2540', borderColor: '#00BFFF' }}>{children}</h2>
}
function TH({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return <th className="p-2 border border-slate-300 font-semibold text-[11px]" style={{ textAlign: align }}>{children}</th>
}
function TD({ children, align = 'left', small = false, mono = false, color, dark = false }: {
  children: React.ReactNode; align?: 'left' | 'right'; small?: boolean; mono?: boolean; color?: string; dark?: boolean
}) {
  return <td className={`${dark ? 'border-slate-600' : 'border-slate-300'} border ${small ? 'p-1.5 text-[11px]' : 'p-2'} ${mono ? 'font-mono' : ''}`}
    style={{ textAlign: align, color: dark ? 'white' : color }}>{children}</td>
}
