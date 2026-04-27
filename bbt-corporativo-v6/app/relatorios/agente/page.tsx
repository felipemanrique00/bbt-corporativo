'use client'
import { useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import { useStore } from '@/lib/store'
import { getAtendimentosFiltro, getEstatisticas, getEstatisticasPorTipo } from '@/lib/atendimentos-storage'
import { getAllUsers, perfilBBTLabel } from '@/lib/auth'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { StatusAtendimento, TipoServico } from '@/types'
import { STATUS_LABEL, calcularFinanceiro } from '@/types'
import { Printer, ArrowLeft } from 'lucide-react'

export default function RelatorioAgentePage() {
  const sp = useSearchParams()
  const inicio = sp.get('inicio') || '1970-01-01'
  const fim = sp.get('fim') || new Date().toISOString().slice(0, 10)
  const agenteId = sp.get('agente') || ''
  const { empresas } = useStore()

  const agenteInfo = useMemo(() => getAllUsers().find((u) => u.id === agenteId), [agenteId])

  const atendimentos = useMemo(() => getAtendimentosFiltro({ agente_user_id: agenteId || undefined, data_inicio: inicio, data_fim: fim }), [agenteId, inicio, fim])
  const stats = useMemo(() => getEstatisticas({ agente_user_id: agenteId || undefined, data_inicio: inicio, data_fim: fim }), [agenteId, inicio, fim])
  const statsTipo = useMemo(() => getEstatisticasPorTipo({ agente_user_id: agenteId || undefined, data_inicio: inicio, data_fim: fim }), [agenteId, inicio, fim])

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

      <div className="bbt-relatorio-folha max-w-4xl mx-auto p-8 bg-white text-black" style={{ minHeight: '100vh' }}>
        <div className="border-b-4 pb-4 mb-6" style={{ borderColor: '#0A2540' }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">BBT Corporativo</div>
              <h1 className="text-3xl font-bold mt-1" style={{ color: '#0A2540' }}>Relatório de Produtividade</h1>
              <div className="text-sm text-slate-600 mt-1">
                Período: <strong>{formatDate(inicio)}</strong> até <strong>{formatDate(fim)}</strong>
              </div>
            </div>
            <div className="text-right text-xs text-slate-500">
              Emitido em<br />
              <strong>{new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR')}</strong>
            </div>
          </div>
        </div>

        {agenteInfo && (
          <div className="mb-6 p-4 border border-slate-300 rounded-lg bg-slate-50">
            <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Agente</div>
            <div className="flex items-center justify-between mt-1">
              <div>
                <div className="text-xl font-bold" style={{ color: '#0A2540' }}>{agenteInfo.name}</div>
                <div className="text-sm text-slate-600">{agenteInfo.email}</div>
              </div>
              {agenteInfo.perfil_bbt && (
                <div className="text-right">
                  <div className="text-xs text-slate-500">Perfil</div>
                  <div className="font-semibold" style={{ color: '#0A2540' }}>{perfilBBTLabel(agenteInfo.perfil_bbt)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        <section className="mb-6">
          <H2>Resumo</H2>
          <div className="grid grid-cols-4 gap-3">
            <Stat label="Total" value={String(stats.total)} />
            <Stat label="Em Andamento" value={String(stats.por_status.em_andamento)} />
            <Stat label="Finalizadas" value={String(stats.por_status.finalizado)} />
            <Stat label="Canceladas" value={String(stats.por_status.cancelado)} />
          </div>
        </section>

        <section className="mb-6">
          <H2>Financeiro Consolidado</H2>
          <div className="grid grid-cols-4 gap-3">
            <Stat label="Custo (pagamos)" value={formatCurrency(stats.custo_total)} color="#ea580c" />
            <Stat label="Markup (lucro)" value={formatCurrency(stats.markup_total)} color="#16a34a" subtext={`${stats.margem_media_pct.toFixed(1)}% margem`} />
            <Stat label="Taxas" value={formatCurrency(stats.taxa_total)} color="#9333ea" />
            <Stat label="Faturado" value={formatCurrency(stats.faturado_total)} color="#0A2540" big />
          </div>
        </section>

        <section className="mb-6">
          <H2>Produtividade por Categoria</H2>
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
                  <TD align="right">{formatCurrency(v.custo)}</TD>
                  <TD align="right">{formatCurrency(v.venda)}</TD>
                  <TD align="right" color="#16a34a"><strong>{formatCurrency(v.markup)}</strong></TD>
                  <TD align="right" color="#9333ea">{formatCurrency(v.taxa)}</TD>
                  <TD align="right"><strong>{formatCurrency(v.faturado)}</strong></TD>
                </tr>
              ))}
              <tr style={{ backgroundColor: '#f1f5f9' }}>
                <TD><strong>TOTAL</strong></TD><TD align="right"><strong>{stats.total}</strong></TD>
                <TD align="right"><strong>{formatCurrency(stats.custo_total)}</strong></TD>
                <TD align="right"><strong>{formatCurrency(stats.venda_total)}</strong></TD>
                <TD align="right" color="#16a34a"><strong>{formatCurrency(stats.markup_total)}</strong></TD>
                <TD align="right" color="#9333ea"><strong>{formatCurrency(stats.taxa_total)}</strong></TD>
                <TD align="right"><strong>{formatCurrency(stats.faturado_total)}</strong></TD>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="mb-6">
          <H2>Detalhamento — {atendimentos.length} demanda(s)</H2>
          {atendimentos.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma demanda no período.</p>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead><tr style={{ backgroundColor: '#f1f5f9' }}>
                <TH>Data</TH><TH>Passageiro</TH><TH>Empresa</TH><TH>Tipo</TH><TH>Loc.</TH>
                <TH align="right">Custo</TH><TH align="right">Venda</TH>
                <TH align="right">Mark.</TH><TH align="right">Taxa</TH><TH align="right">Faturado</TH>
              </tr></thead>
              <tbody>
                {atendimentos.map((a) => {
                  const empresa = empresas.find((e) => e.id === a.empresa_id)
                  const loc = a.detalhes_aereo?.localizador || a.detalhes_hotel?.localizador || a.detalhes_carro?.localizador || a.detalhes_pacote?.localizador || '—'
                  const calc = calcularFinanceiro(a)
                  return (
                    <tr key={a.id}>
                      <TD small>{formatDate(a.data_atendimento)}</TD>
                      <TD small><strong>{a.passageiro_nome}</strong></TD>
                      <TD small>{empresa?.nome || '—'}</TD>
                      <TD small>{a.tipo_servico}</TD>
                      <TD small mono>{loc}</TD>
                      <TD small align="right">{formatCurrency(calc.custo)}</TD>
                      <TD small align="right">{formatCurrency(calc.venda)}</TD>
                      <TD small align="right" color="#16a34a">{formatCurrency(calc.markup)}</TD>
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
          Relatório gerado automaticamente pelo sistema BBT Corporativo · Documento confidencial
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
function TD({ children, align = 'left', small = false, mono = false, color }: {
  children: React.ReactNode; align?: 'left' | 'right'; small?: boolean; mono?: boolean; color?: string
}) {
  return <td className={`border border-slate-300 ${small ? 'p-1.5 text-[11px]' : 'p-2'} ${mono ? 'font-mono' : ''}`} style={{ textAlign: align, color }}>{children}</td>
}
function Stat({ label, value, big = false, color, subtext }: { label: string; value: string; big?: boolean; color?: string; subtext?: string }) {
  return (
    <div className="border border-slate-300 rounded p-3 bg-white text-center">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className={`font-bold mt-1 ${big ? 'text-2xl' : 'text-xl'}`} style={{ color: color || '#0A2540' }}>{value}</div>
      {subtext && <div className="text-[10px] text-slate-500 mt-0.5">{subtext}</div>}
    </div>
  )
}
