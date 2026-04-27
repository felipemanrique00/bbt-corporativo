// ============================================================
// PARSER PDF LAYOUT-AWARE
// Em vez de só extrair texto e regex, usamos as coordenadas X/Y
// dos itens do PDF pra reconstruir as colunas reais.
// Muito mais preciso que regex puro.
// ============================================================

export interface ItemPDF {
  texto: string
  x: number
  y: number
  width: number
  height: number
  pagina: number
}

export interface LinhaPDF {
  y: number
  pagina: number
  itens: ItemPDF[]
  texto: string // texto concatenado da linha
}

export interface ColunaDetectada {
  inicio_x: number
  fim_x: number
  cabecalho?: string
}

export interface PaginaPDFLayout {
  numero: number
  largura: number
  altura: number
  itens: ItemPDF[]
  linhas: LinhaPDF[]
  colunas?: ColunaDetectada[]
}

/**
 * Extrai itens com coordenadas reais do PDF.
 * Muito mais informação que só o texto plain.
 */
export async function extrairLayoutPDF(file: File): Promise<PaginaPDFLayout[]> {
  if (typeof window === 'undefined') throw new Error('Só funciona no navegador')

  const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs' as any)
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs`

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const paginas: PaginaPDFLayout[] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const viewport = page.getViewport({ scale: 1.0 })
    const content = await page.getTextContent()

    const itens: ItemPDF[] = []
    for (const item of content.items as any[]) {
      const transform = item.transform // [a, b, c, d, e, f] — e/f são x/y
      const x = transform[4]
      // PDF.js usa Y de baixo pra cima. Convertemos pra topo→baixo (mais natural).
      const y = viewport.height - transform[5]
      const width = item.width
      const height = item.height || Math.abs(transform[0])
      const texto = (item.str || '').trim()
      if (!texto) continue
      itens.push({ texto, x, y, width, height, pagina: p })
    }

    const linhas = agruparEmLinhas(itens)
    paginas.push({
      numero: p,
      largura: viewport.width,
      altura: viewport.height,
      itens,
      linhas,
    })
  }

  return paginas
}

/**
 * Agrupa itens com Y similar como uma "linha" só.
 * Tolerância: 3px (compensar pequena variação de altura).
 */
function agruparEmLinhas(itens: ItemPDF[]): LinhaPDF[] {
  if (itens.length === 0) return []

  // Ordena por Y (topo→baixo) e depois por X (esquerda→direita)
  const ordenados = [...itens].sort((a, b) => {
    if (Math.abs(a.y - b.y) < 3) return a.x - b.x
    return a.y - b.y
  })

  const linhas: LinhaPDF[] = []
  let atual: ItemPDF[] = [ordenados[0]]
  let yAtual = ordenados[0].y

  for (let i = 1; i < ordenados.length; i++) {
    const item = ordenados[i]
    if (Math.abs(item.y - yAtual) < 3) {
      atual.push(item)
    } else {
      linhas.push(criarLinha(atual))
      atual = [item]
      yAtual = item.y
    }
  }
  if (atual.length > 0) linhas.push(criarLinha(atual))

  return linhas
}

function criarLinha(itens: ItemPDF[]): LinhaPDF {
  const sorted = [...itens].sort((a, b) => a.x - b.x)
  return {
    y: sorted[0].y,
    pagina: sorted[0].pagina,
    itens: sorted,
    texto: sorted.map((i) => i.texto).join(' ').replace(/\s+/g, ' ').trim(),
  }
}

/**
 * Pega texto numa região (X, Y, largura, altura) específica.
 * Útil pra extrair valor que sempre fica em "tal posição" do voucher.
 */
export function textoEmRegiao(
  pagina: PaginaPDFLayout,
  x: number, y: number, largura: number, altura: number
): string {
  const dentro = pagina.itens.filter(
    (i) => i.x >= x && i.x <= x + largura && i.y >= y && i.y <= y + altura
  )
  return dentro.map((i) => i.texto).join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * Pega o texto IMEDIATAMENTE à direita de um label.
 * Ex: localizar "Hóspede:" e pegar o que vem na mesma linha após ele.
 */
export function valorAposLabel(
  paginas: PaginaPDFLayout[],
  label: string | RegExp,
  opts: { mesma_linha?: boolean; max_distancia_x?: number } = {}
): string | null {
  const re = typeof label === 'string' ? new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : label
  for (const pag of paginas) {
    for (const linha of pag.linhas) {
      const idx = linha.itens.findIndex((i) => re.test(i.texto))
      if (idx === -1) continue
      const labelItem = linha.itens[idx]
      const apos = linha.itens.slice(idx + 1)
      if (apos.length === 0) continue
      // Filtra só os que estão razoavelmente próximos
      const proximos = opts.max_distancia_x
        ? apos.filter((i) => i.x - (labelItem.x + labelItem.width) < opts.max_distancia_x!)
        : apos
      const texto = proximos.map((i) => i.texto).join(' ').trim()
      if (texto) {
        // Limpa o label que possa ter ficado preso (ex: "Hóspede: João" → label match já em outro item, mas pode ter ":")
        return texto.replace(/^[:\s]+/, '').trim()
      }
    }
  }
  return null
}

/**
 * Pega texto na linha imediatamente abaixo do label.
 * Útil pra layouts onde o valor fica embaixo do título da seção.
 */
export function valorAbaixoLabel(
  paginas: PaginaPDFLayout[],
  label: string | RegExp
): string | null {
  const re = typeof label === 'string' ? new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : label
  for (const pag of paginas) {
    for (let i = 0; i < pag.linhas.length - 1; i++) {
      const linha = pag.linhas[i]
      if (re.test(linha.texto)) {
        return pag.linhas[i + 1].texto
      }
    }
  }
  return null
}

/**
 * Detecta colunas automaticamente analisando posições X que se repetem.
 * Útil pra tabelas em PDFs (mapa de produção, planilhas escaneadas, etc).
 */
export function detectarColunas(linhas: LinhaPDF[], tolerancia = 5): ColunaDetectada[] {
  const xCount = new Map<number, number>()
  for (const linha of linhas) {
    for (const item of linha.itens) {
      const xRound = Math.round(item.x / tolerancia) * tolerancia
      xCount.set(xRound, (xCount.get(xRound) || 0) + 1)
    }
  }
  // Pega os X mais recorrentes (mais de 30% das linhas)
  const minOcorr = Math.max(3, Math.floor(linhas.length * 0.3))
  const colunasX = Array.from(xCount.entries())
    .filter(([, c]) => c >= minOcorr)
    .map(([x]) => x)
    .sort((a, b) => a - b)

  // Constrói os ranges de cada coluna
  const colunas: ColunaDetectada[] = []
  for (let i = 0; i < colunasX.length; i++) {
    colunas.push({
      inicio_x: colunasX[i],
      fim_x: colunasX[i + 1] !== undefined ? colunasX[i + 1] : 9999,
    })
  }
  return colunas
}
