'use client'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import { getCurrentUser, canEditGlobal } from '@/lib/auth'
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Download } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

export default function ImportarPage() {
  const user = typeof window !== 'undefined' ? getCurrentUser() : null
  const { importHoteis } = useStore()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  if (!canEditGlobal(user)) {
    return (
      <div className="bbt-card p-12 text-center">
        <AlertCircle className="w-10 h-10 mx-auto text-amber-500 mb-3" />
        <p className="text-slate-600 dark:text-slate-300 font-medium">Acesso restrito ao perfil Master.</p>
      </div>
    )
  }

  async function handleFile(f: File) {
    setFile(f)
    setLoading(true)
    try {
      if (f.name.endsWith('.csv')) {
        const text = await f.text()
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (res) => setPreview(res.data.slice(0, 10) as any[]),
        })
      } else {
        const buffer = await f.arrayBuffer()
        const wb = XLSX.read(buffer)
        const firstSheet = wb.SheetNames[0]
        const data = XLSX.utils.sheet_to_json(wb.Sheets[firstSheet])
        setPreview(data.slice(0, 10))
      }
      toast.success('Arquivo carregado! Revise e confirme.')
    } catch (err) {
      toast.error('Erro ao ler o arquivo. Verifique o formato.')
    } finally {
      setLoading(false)
    }
  }

  async function doImport() {
    if (!file) return
    setLoading(true)
    try {
      let rows: any[] = []
      if (file.name.endsWith('.csv')) {
        const text = await file.text()
        const res = Papa.parse(text, { header: true, skipEmptyLines: true })
        rows = res.data as any[]
      } else {
        const buffer = await file.arrayBuffer()
        const wb = XLSX.read(buffer)
        const firstSheet = wb.SheetNames[0]
        rows = XLSX.utils.sheet_to_json(wb.Sheets[firstSheet])
      }

      const hoteis = rows
        .filter((r: any) => r.nome || r.Nome || r['Nome do Hotel'])
        .map((r: any) => ({
          nome: r.nome || r.Nome || r['Nome do Hotel'] || '',
          cidade: r.cidade || r.Cidade || '',
          uf: (r.uf || r.UF || 'GO').toUpperCase().slice(0, 2),
          telefone: String(r.telefone || r.Telefone || '').replace(/\D/g, '') || null,
          observacoes: r.observacoes || r['OBSERVAÇÕES'] || null,
          faturado: /faturad/i.test(r.faturamento || r['Faturamento (R$)'] || '') && !/não/i.test(r.faturamento || r['Faturamento (R$)'] || ''),
          info_faturamento: r.info_faturamento || r['Informações sobre Faturamento'] || null,
          bebedouro: r.bebedouro || r.Bebedouro || null,
          valor_agua: parseFloat(r.valor_agua || r['Valor Água (R$)'] || '') || null,
          cafe_manha: r.cafe_manha || r['Café da Manhã'] || null,
          estacionamento: r.estacionamento || r.Estacionamento || null,
          tarifa_sgl: parseFloat(r.tarifa_sgl || r['Tarifa Individual c/ Ar (R$)'] || '') || null,
          tarifa_dbl: parseFloat(r.tarifa_dbl || r['Tarifa Duplo c/ Ar (R$)'] || '') || null,
          tarifa_tpl: parseFloat(r.tarifa_tpl || r['Tarifa Triplo c/ Ar (R$)'] || '') || null,
        }))

      const added = importHoteis(hoteis)
      toast.success(`${added} hotéis importados com sucesso!`)
      setFile(null)
      setPreview([])
    } catch (err) {
      toast.error('Erro durante a importação.')
    } finally {
      setLoading(false)
    }
  }

  function downloadTemplate() {
    const headers = ['nome', 'cidade', 'uf', 'telefone', 'observacoes', 'faturamento', 'cafe_manha', 'bebedouro', 'estacionamento', 'tarifa_sgl', 'tarifa_dbl', 'tarifa_tpl']
    const csv = headers.join(';') + '\nHotel Exemplo;Goiânia;GO;62999998888;Hotel novo;Faturado;SIM;SIM;Tem estacionamento;200;300;400'
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'modelo-hoteis.csv'
    a.click()
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-bbt-primary dark:text-white flex items-center gap-3">
          <Upload className="w-8 h-8 text-bbt-accent" />
          Importar Dados
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Importe hotéis a partir de arquivos Excel (.xlsx) ou CSV.
        </p>
      </div>

      <div className="bbt-card p-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-bbt-primary dark:text-white">Upload de arquivo</h3>
            <p className="text-sm text-slate-500">Formatos suportados: .xlsx, .xls, .csv</p>
          </div>
          <button onClick={downloadTemplate} className="bbt-button-ghost flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" /> Baixar modelo
          </button>
        </div>

        <label className="block border-2 border-dashed border-bbt-gray-100 dark:border-slate-700 rounded-xl p-10 text-center cursor-pointer hover:border-bbt-accent hover:bg-bbt-accent/5 transition">
          <FileSpreadsheet className="w-12 h-12 mx-auto text-bbt-accent mb-3" />
          <p className="font-medium text-bbt-primary dark:text-white">
            {file ? file.name : 'Clique para selecionar ou arraste um arquivo'}
          </p>
          <p className="text-xs text-slate-500 mt-1">.xlsx, .xls ou .csv — máx 10MB</p>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="hidden"
          />
        </label>

        {preview.length > 0 && (
          <div className="mt-6">
            <h4 className="font-medium text-bbt-primary dark:text-white mb-3">
              ✓ Pré-visualização (primeiras {preview.length} linhas):
            </h4>
            <div className="border border-bbt-gray-100 dark:border-slate-700 rounded-lg overflow-x-auto max-h-60">
              <table className="w-full text-xs">
                <thead className="bg-bbt-gray-50 dark:bg-slate-900/50 sticky top-0">
                  <tr>
                    {Object.keys(preview[0]).slice(0, 6).map((k) => (
                      <th key={k} className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-t border-bbt-gray-100 dark:border-slate-700">
                      {Object.values(row).slice(0, 6).map((v: any, j) => (
                        <td key={j} className="px-3 py-2 text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{String(v || '-')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => { setFile(null); setPreview([]) }} className="bbt-button-ghost">Cancelar</button>
              <button onClick={doImport} disabled={loading} className="bbt-button-primary flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                {loading ? 'Importando...' : 'Confirmar importação'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bbt-card p-6 bg-blue-50 dark:bg-slate-800/60 border border-blue-100 dark:border-slate-700">
        <h4 className="font-semibold text-bbt-primary dark:text-white mb-2">💡 Dicas de importação</h4>
        <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1 list-disc list-inside">
          <li>Use a primeira linha como cabeçalho com os nomes das colunas</li>
          <li>Colunas aceitas: nome, cidade, uf, telefone, tarifa_sgl, tarifa_dbl, tarifa_tpl, etc.</li>
          <li>O sistema também reconhece os nomes originais da planilha (ex: "Nome do Hotel", "Tarifa Individual c/ Ar (R$)")</li>
          <li>Baixe o modelo acima para começar com o formato correto</li>
        </ul>
      </div>
    </div>
  )
}
