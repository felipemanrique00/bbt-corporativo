// ============================================================
// Parser de Mensagem V4
// Dois modos detectados automaticamente:
//
// 1) ESTRUTURADO (máxima precisão)
//    Nome: XXX
//    CPF: XXX
//    Cidade: XXX
//    Hotel: XXX
//    Check in: XX/XX
//    Check out: XX/XX
//    Empresa: XXX
//
// 2) CONVERSACIONAL (heurístico)
//    "Oi felipe, preciso de hotel em Uberlandia pra Ana Silva..."
// ============================================================

import type { TipoServico } from '@/types'

export interface MensagemParsed {
  tipo_servico?: TipoServico
  passageiro_nome?: string
  empresa_nome?: string
  cidade_origem?: string
  cidade_destino?: string
  hotel_nome?: string          // novo - quando mensagem indica hotel
  data_ida?: string
  data_volta?: string
  data_checkin?: string
  data_checkout?: string
  num_hospedes?: number
  cpf?: string
  telefone?: string
  observacoes?: string
  urgente?: boolean
  modo?: 'estruturado' | 'conversacional'
  /** Fonte de cada campo extraído (pra badge visual) */
  fontes?: Record<string, 'label' | 'heuristica'>
}

function norm(s: string): string {
  return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function parseDataBR(s: string, anoDefault?: number): string | undefined {
  if (!s) return undefined
  const m = s.trim().match(/(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?/)
  if (!m) return undefined
  let [, d, mes, a] = m
  if (!a) a = String(anoDefault || new Date().getFullYear())
  if (a.length === 2) a = (parseInt(a) > 50 ? '19' : '20') + a
  return `${a}-${mes.padStart(2, '0')}-${d.padStart(2, '0')}`
}

const MESES: Record<string, number> = {
  janeiro: 1, jan: 1, fevereiro: 2, fev: 2, março: 3, marco: 3, mar: 3,
  abril: 4, abr: 4, maio: 5, mai: 5, junho: 6, jun: 6, julho: 7, jul: 7,
  agosto: 8, ago: 8, setembro: 9, set: 9, outubro: 10, out: 10,
  novembro: 11, nov: 11, dezembro: 12, dez: 12,
}

function parseDataExtensa(texto: string): string | undefined {
  const m = texto.match(/(\d{1,2})\s+de\s+([a-zç]+)(?:\s+de\s+(\d{2,4}))?/i)
  if (!m) return undefined
  const dia = parseInt(m[1])
  const mes = MESES[norm(m[2])]
  if (!mes) return undefined
  let ano = m[3] ? parseInt(m[3]) : new Date().getFullYear()
  if (ano < 100) ano += 2000
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

// ============================================================
// MODO ESTRUTURADO (detectado por labels tipo "Nome:", "CPF:")
// ============================================================

function parseEstruturado(texto: string): MensagemParsed {
  const result: MensagemParsed = { modo: 'estruturado', fontes: {} }

  // Busca labels (case-insensitive, com ou sem ":" depois)
  // Formato: LABEL: valor
  const linhas = texto.split(/[\n\r]+/).map((l) => l.trim()).filter(Boolean)

  for (const linha of linhas) {
    // Tenta "LABEL: valor" ou "LABEL - valor"
    const m = linha.match(/^([a-zA-ZÀ-ÿ\s]{2,30}?)\s*[:\-]\s*(.+)$/)
    if (!m) continue
    const label = norm(m[1])
    const valor = m[2].trim()
    if (!valor || valor.length < 2) continue

    // Nome / Passageiro / Hóspede / Cliente
    if (/^(nome|passageiro|hospede|hospede|cliente|viajante)$/.test(label) && !result.passageiro_nome) {
      result.passageiro_nome = valor
      result.fontes!['passageiro_nome'] = 'label'
    }
    else if (/^cpf$/.test(label)) {
      const dig = valor.replace(/\D/g, '')
      if (dig.length === 11) {
        result.cpf = dig
        result.fontes!['cpf'] = 'label'
      }
    }
    else if (/^(cidade|cidade destino|destino)$/.test(label)) {
      result.cidade_destino = valor
      result.fontes!['cidade_destino'] = 'label'
    }
    else if (/^(origem|cidade origem|saida|saída)$/.test(label)) {
      result.cidade_origem = valor
      result.fontes!['cidade_origem'] = 'label'
    }
    else if (/^hotel$/.test(label)) {
      result.hotel_nome = valor
      result.fontes!['hotel_nome'] = 'label'
      if (!result.tipo_servico) result.tipo_servico = 'Hotel'
    }
    else if (/^(check.?in|entrada|chegada)$/.test(label)) {
      result.data_checkin = parseDataBR(valor)
      result.fontes!['data_checkin'] = 'label'
      if (!result.tipo_servico) result.tipo_servico = 'Hotel'
    }
    else if (/^(check.?out|saida|saída|partida)$/.test(label)) {
      result.data_checkout = parseDataBR(valor)
      result.fontes!['data_checkout'] = 'label'
      if (!result.tipo_servico) result.tipo_servico = 'Hotel'
    }
    else if (/^(ida|data ida|partida)$/.test(label)) {
      result.data_ida = parseDataBR(valor)
      result.fontes!['data_ida'] = 'label'
    }
    else if (/^(volta|data volta|retorno)$/.test(label)) {
      result.data_volta = parseDataBR(valor)
      result.fontes!['data_volta'] = 'label'
    }
    else if (/^(empresa|cliente empresa|razao social|razão social)$/.test(label)) {
      result.empresa_nome = valor
      result.fontes!['empresa_nome'] = 'label'
    }
    else if (/^(telefone|celular|fone|contato)$/.test(label)) {
      const dig = valor.replace(/\D/g, '')
      if (dig.length >= 10) {
        result.telefone = dig
        result.fontes!['telefone'] = 'label'
      }
    }
    else if (/^(hospedes|hóspedes|pax|pessoas|passageiros)$/.test(label)) {
      const n = parseInt(valor)
      if (!isNaN(n)) {
        result.num_hospedes = n
        result.fontes!['num_hospedes'] = 'label'
      }
    }
    else if (/^(servico|serviço|tipo)$/.test(label)) {
      const v = norm(valor)
      if (/hotel|hospedagem/.test(v)) result.tipo_servico = 'Hotel'
      else if (/aereo|aéreo|voo|passagem/.test(v)) result.tipo_servico = 'Aéreo'
      else if (/carro|loca/.test(v)) result.tipo_servico = 'Carro'
      else if (/pacote/.test(v)) result.tipo_servico = 'Pacote'
    }
  }

  // Detecta urgência no texto bruto
  if (/\b(urgente|urg[êe]ncia|hoje|agora|imediato|asap)\b/i.test(texto)) {
    result.urgente = true
  }

  // Se tipo não detectado mas tem hotel_nome/checkin → Hotel
  if (!result.tipo_servico && (result.hotel_nome || result.data_checkin)) {
    result.tipo_servico = 'Hotel'
  }

  result.observacoes = texto.trim().slice(0, 1000)
  return result
}

// ============================================================
// MODO CONVERSACIONAL
// ============================================================

function parseConversacional(texto: string): MensagemParsed {
  const result: MensagemParsed = { modo: 'conversacional', fontes: {} }
  const t = texto.replace(/\s+/g, ' ').trim()

  // Tipo serviço
  if (/\b(aereo|aéreo|passagem|passagens|voo|voos|bilhete)\b/i.test(t) && !/\bhotel|hospedagem/i.test(t)) {
    result.tipo_servico = 'Aéreo'
  } else if (/\b(hotel|hoteis|hospedagem|diaria|diária|pernoite|apartamento)\b/i.test(t) && !/\b(aereo|aéreo|voo)\b/i.test(t)) {
    result.tipo_servico = 'Hotel'
  } else if (/\b(carro|loca[çc][ãa]o|aluguel\s+de\s+carro|locadora)\b/i.test(t)) {
    result.tipo_servico = 'Carro'
  } else if (/\b(pacote|viagem\s+completa)\b/i.test(t)) {
    result.tipo_servico = 'Pacote'
  } else if (/\b(aereo|voo|passagem)\b/i.test(t) && /\b(hotel|hospedagem)\b/i.test(t)) {
    result.tipo_servico = 'Pacote'
  } else if (/hotel|hospedagem/i.test(t)) result.tipo_servico = 'Hotel'
  else if (/\b(aereo|voo|passagem)\b/i.test(t)) result.tipo_servico = 'Aéreo'

  // Urgência
  if (/\b(urgente|urg[êe]ncia|hoje|agora|imediato|asap)\b/i.test(t)) result.urgente = true

  // CPF
  const mCpf = t.match(/\b(\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2})\b/)
  if (mCpf) {
    result.cpf = mCpf[1].replace(/\D/g, '')
    result.fontes!['cpf'] = 'heuristica'
  }

  // Telefone
  const mTel = t.match(/\(?(\d{2})\)?\s*9?\s*(\d{4,5})[\s-]?(\d{4})/)
  if (mTel) {
    result.telefone = `${mTel[1]}${mTel[2]}${mTel[3]}`
    result.fontes!['telefone'] = 'heuristica'
  }

  // Passageiro
  const padroes = [
    /(?:passageiro|h[oó]spede|viajante|pax|cliente)\s*:?\s*([A-ZÀ-Ÿ][A-ZÀ-Ÿa-zà-ÿ]{2,}(?:\s+[A-ZÀ-Ÿ][A-ZÀ-Ÿa-zà-ÿ]{1,}){0,4})/i,
    /\bpara\s+(?:o\s+|a\s+)?(?:sr\.?|sra\.?|dr\.?|dra\.?)?\s*([A-ZÀ-Ÿ][A-ZÀ-Ÿa-zà-ÿ]{2,}(?:\s+[A-ZÀ-Ÿ][A-ZÀ-Ÿa-zà-ÿ]{1,}){1,4})/,
    /\b(?:sr\.?|sra\.?|dr\.?|dra\.?)\s+([A-ZÀ-Ÿ][A-ZÀ-Ÿa-zà-ÿ]{2,}(?:\s+[A-ZÀ-Ÿ][A-ZÀ-Ÿa-zà-ÿ]{1,}){1,4})/,
  ]
  for (const p of padroes) {
    const m = t.match(p)
    if (m) {
      const nome = m[1].trim().replace(/\s+/g, ' ')
      if (nome.length >= 5 && !/(?:hotel|cidade|data|check|voo|valor|di[áa]ria|empresa)/i.test(nome)) {
        result.passageiro_nome = nome
        result.fontes!['passageiro_nome'] = 'heuristica'
        break
      }
    }
  }

  // Cidades
  const mDePara = t.match(/\b(?:de|sair\s+de|saindo\s+de|voo\s+de)\s+([A-ZÀ-Ÿ][a-zà-ÿ]{2,20}(?:\s+[A-ZÀ-Ÿ]?[a-zà-ÿ]{2,20})?)\s+(?:para|pra|at[ée]|destino)\s+([A-ZÀ-Ÿ][a-zà-ÿ]{2,20}(?:\s+[A-ZÀ-Ÿ]?[a-zà-ÿ]{2,20})?)/i)
  if (mDePara) {
    result.cidade_origem = mDePara[1].trim()
    result.cidade_destino = mDePara[2].trim()
    result.fontes!['cidade_destino'] = 'heuristica'
  } else {
    const mEm = t.match(/\b(?:em|na\s+cidade\s+de|para|destino)\s+([A-ZÀ-Ÿ][a-zà-ÿ]{2,20}(?:\s+[A-ZÀ-Ÿ]?[a-zà-ÿ]{2,20})?)/i)
    if (mEm) {
      result.cidade_destino = mEm[1].trim()
      result.fontes!['cidade_destino'] = 'heuristica'
    }
  }

  // Datas
  const mCheckin = t.match(/(?:check-?in|entrada|chegada)\s*:?\s*(?:dia\s+)?(\d{1,2}[\/\-\.]\d{1,2}(?:[\/\-\.]\d{2,4})?)/i)
  const mCheckout = t.match(/(?:check-?out|saida|saída|partida)\s*:?\s*(?:dia\s+)?(\d{1,2}[\/\-\.]\d{1,2}(?:[\/\-\.]\d{2,4})?)/i)
  if (mCheckin) result.data_checkin = parseDataBR(mCheckin[1])
  if (mCheckout) result.data_checkout = parseDataBR(mCheckout[1])

  const mIda = t.match(/(?:ida|partida)\s*:?\s*(?:dia\s+)?(\d{1,2}[\/\-\.]\d{1,2}(?:[\/\-\.]\d{2,4})?)/i)
  const mVolta = t.match(/(?:volta|retorno)\s*:?\s*(?:dia\s+)?(\d{1,2}[\/\-\.]\d{1,2}(?:[\/\-\.]\d{2,4})?)/i)
  if (mIda) result.data_ida = parseDataBR(mIda[1])
  if (mVolta) result.data_volta = parseDataBR(mVolta[1])

  if (!result.data_checkin && !result.data_ida) {
    const mExt = Array.from(t.matchAll(/(\d{1,2})\s+de\s+([a-zç]+)(?:\s+de\s+(\d{2,4}))?/gi))
    if (mExt.length >= 1) {
      const d1 = parseDataExtensa(mExt[0][0])
      if (d1) {
        if (result.tipo_servico === 'Hotel') result.data_checkin = d1
        else result.data_ida = d1
      }
      if (mExt[1]) {
        const d2 = parseDataExtensa(mExt[1][0])
        if (d2) {
          if (result.tipo_servico === 'Hotel') result.data_checkout = d2
          else result.data_volta = d2
        }
      }
    }
  }

  if (!result.data_checkin && !result.data_ida) {
    const mDatas = Array.from(t.matchAll(/(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?/g))
    if (mDatas.length >= 1) {
      const d1 = parseDataBR(mDatas[0][0])
      if (d1) {
        if (result.tipo_servico === 'Hotel') result.data_checkin = d1
        else result.data_ida = d1
      }
      if (mDatas.length >= 2) {
        const d2 = parseDataBR(mDatas[1][0])
        if (d2) {
          if (result.tipo_servico === 'Hotel') result.data_checkout = d2
          else result.data_volta = d2
        }
      }
    }
  }

  const mPax = t.match(/(\d+)\s*(?:pax|passageiros?|hospedes?|h[óo]spedes?|pessoas?|adultos?)/i)
  if (mPax) result.num_hospedes = parseInt(mPax[1])

  const padroesEmpresa = [
    /(?:empresa|cliente\s+empresa|razao\s+social|raz[ãa]o\s+social|de\s+parte\s+da)\s*:?\s*([A-ZÀ-Ÿ][A-ZÀ-Ÿa-zà-ÿ0-9\s]{2,50})/i,
  ]
  for (const p of padroesEmpresa) {
    const m = t.match(p)
    if (m) {
      result.empresa_nome = m[1].trim().replace(/\s+/g, ' ')
      result.fontes!['empresa_nome'] = 'heuristica'
      break
    }
  }

  result.observacoes = texto.trim().slice(0, 1000)
  return result
}

// ============================================================
// PARSER PRINCIPAL — escolhe o modo
// ============================================================

/**
 * Detecta se a mensagem está estruturada (tem labels como "Nome:", "CPF:")
 */
function isEstruturada(texto: string): boolean {
  const linhas = texto.split(/[\n\r]+/).map((l) => l.trim()).filter(Boolean)
  if (linhas.length < 2) return false

  // Conta quantas linhas são no formato "label: valor"
  const linhasLabel = linhas.filter((l) =>
    /^(nome|passageiro|hospede|h[óo]spede|cliente|cpf|cidade|hotel|check.?in|check.?out|empresa|telefone|origem|destino|servi[çc]o|tipo|ida|volta|viajante)\s*[:\-]/i.test(l)
  ).length

  // Se pelo menos 2 linhas são labels, consideramos estruturado
  return linhasLabel >= 2
}

export function parseMensagem(texto: string): MensagemParsed {
  if (!texto || texto.trim().length < 5) return { fontes: {} }

  const estruturado = isEstruturada(texto)
  if (estruturado) {
    return parseEstruturado(texto)
  }
  return parseConversacional(texto)
}
