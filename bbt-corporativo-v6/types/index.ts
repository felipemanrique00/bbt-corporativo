// ============================================================
// Tipos TypeScript do Sistema BBT Corporativo
// V4: Config markup/taxa por empresa, users dinâmicos, produtividade
// ============================================================

export type UserRole = 'master' | 'company_admin' | 'colaborador'
export type PerfilBBT = 'agente' | 'lider' | 'gestor_financeiro' | 'operacional' | 'supervisor'

export interface Permissoes {
  ver_financeiro: boolean
  editar_financeiro: boolean
  cadastrar_empresas: boolean
  cadastrar_funcionarios: boolean
  cadastrar_hoteis: boolean
  editar_politicas: boolean
  gerar_relatorios: boolean
  importar_planilhas: boolean
  ver_produtividade_todos: boolean
  gerenciar_usuarios: boolean
  excluir_demandas: boolean
}

export const PERMISSOES_PADRAO_POR_PERFIL: Record<PerfilBBT, Permissoes> = {
  lider: {
    ver_financeiro: true, editar_financeiro: true,
    cadastrar_empresas: true, cadastrar_funcionarios: true, cadastrar_hoteis: true,
    editar_politicas: true, gerar_relatorios: true, importar_planilhas: true,
    ver_produtividade_todos: true, gerenciar_usuarios: true, excluir_demandas: true,
  },
  gestor_financeiro: {
    ver_financeiro: true, editar_financeiro: true,
    cadastrar_empresas: false, cadastrar_funcionarios: false, cadastrar_hoteis: false,
    editar_politicas: false, gerar_relatorios: true, importar_planilhas: true,
    ver_produtividade_todos: true, gerenciar_usuarios: false, excluir_demandas: false,
  },
  supervisor: {
    ver_financeiro: true, editar_financeiro: false,
    cadastrar_empresas: true, cadastrar_funcionarios: true, cadastrar_hoteis: true,
    editar_politicas: true, gerar_relatorios: true, importar_planilhas: true,
    ver_produtividade_todos: true, gerenciar_usuarios: false, excluir_demandas: false,
  },
  agente: {
    ver_financeiro: false, editar_financeiro: false,
    cadastrar_empresas: false, cadastrar_funcionarios: true, cadastrar_hoteis: false,
    editar_politicas: false, gerar_relatorios: false, importar_planilhas: false,
    ver_produtividade_todos: false, gerenciar_usuarios: false, excluir_demandas: false,
  },
  operacional: {
    ver_financeiro: false, editar_financeiro: false,
    cadastrar_empresas: false, cadastrar_funcionarios: false, cadastrar_hoteis: false,
    editar_politicas: false, gerar_relatorios: false, importar_planilhas: false,
    ver_produtividade_todos: false, gerenciar_usuarios: false, excluir_demandas: false,
  },
}

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  company_id: string | null
  perfil_bbt?: PerfilBBT
  permissoes?: Permissoes
  avatar?: string
  ativo?: boolean
  created_at?: string
}

export type Cargo = 'Diretor' | 'Gerente' | 'Colaborador'

export interface ConfigCobrancaEmpresa {
  aplicar_markup: boolean
  markup_padrao_pct: number
  aplicar_taxa: boolean
  taxa_padrao_pct: number
  taxa_fixa_ativa: boolean
  taxa_valor_fixo: number
  observacoes: string
}

export const CONFIG_COBRANCA_PADRAO: ConfigCobrancaEmpresa = {
  aplicar_markup: true,
  markup_padrao_pct: 10,
  aplicar_taxa: true,
  taxa_padrao_pct: 10,
  taxa_fixa_ativa: false,
  taxa_valor_fixo: 0,
  observacoes: '',
}

export interface Empresa {
  id: string
  nome: string
  cnpj: string
  codigo_cliente?: string
  endereco: string
  responsavel: string
  email_responsavel: string
  telefone: string
  centro_custo_padrao: string
  ativa: boolean
  is_master_holding?: boolean
  config_cobranca?: ConfigCobrancaEmpresa
  created_at: string
}

export interface Funcionario {
  id: string
  company_id: string
  nome: string
  cpf: string
  data_nascimento: string
  telefone: string
  email: string
  passaporte: string
  passaporte_validade: string
  milhagem: string
  preferencias: string
  cargo: Cargo
  cargo_original?: string
  centro_custo: string
  matricula?: string
  lotacao?: string
  ativo: boolean
  created_at: string
}

export type FormaPagamento = 'IV' | 'PX' | 'CP' | 'CC'

export const FORMAS_PAGAMENTO_LABEL: Record<FormaPagamento, string> = {
  IV: 'Faturado',
  PX: 'Pix',
  CP: 'Cartão da agência',
  CC: 'Cartão do cliente',
}

export interface Hotel {
  id: number
  nome: string
  cidade: string
  uf: string
  categoria?: '1' | '2' | '3' | '4' | '5'
  observacoes: string | null
  telefone: string | null
  faturado: boolean
  info_faturamento: string | null
  bebedouro: string | null
  valor_agua: number | null
  cafe_manha: string | null
  estacionamento: string | null
  tarifa_sgl: number | null
  tarifa_dbl: number | null
  tarifa_tpl: number | null
  formas_pagamento?: FormaPagamento[]
}

export type ClasseAerea = 'Econômica' | 'Econômica Premium' | 'Executiva' | 'Primeira'

export interface PoliticaCargo {
  id: string
  company_id: string
  cargo: Cargo
  titulo?: string
  escalao?: string
  limite_diaria_hotel: number
  hoteis_max_estrelas: number
  antecedencia_hotel_dias: number
  politica_hotel_texto?: string
  classe_aerea: ClasseAerea
  classe_aerea_internacional?: ClasseAerea
  valor_maximo_aereo_domestico: number
  valor_maximo_aereo_internacional: number
  antecedencia_aereo_domestico_dias: number
  antecedencia_aereo_internacional_dias: number
  politica_aerea_texto?: string
  aprovacao_automatica: boolean
  autorizador_user_id?: string
  observacoes: string
}

export type StatusAtendimento =
  | 'em_andamento' | 'aguardando_cliente' | 'finalizado' | 'cancelado' | 'pendente'

export const STATUS_LABEL: Record<StatusAtendimento, string> = {
  em_andamento: 'Em Andamento',
  aguardando_cliente: 'Aguardando Cliente',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
  pendente: 'Pendente',
}

export type Prioridade = 'baixa' | 'media' | 'alta' | 'urgente'

export const PRIORIDADE_LABEL: Record<Prioridade, string> = {
  baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente',
}

export type TipoServico = 'Aéreo' | 'Hotel' | 'Carro' | 'Pacote' | 'Outro'
export type OrigemAtendimento = 'WhatsApp' | 'E-mail' | 'Telefone' | 'Indicação' | 'Portal' | 'Outro'

/** Hóspede/Passageiro/Viajante adaptativo */
export function labelOcupante(tipo: TipoServico): string {
  switch (tipo) {
    case 'Hotel': return 'Hóspede'
    case 'Aéreo': return 'Passageiro'
    case 'Carro': return 'Passageiro'
    case 'Pacote': return 'Viajante'
    default: return 'Cliente'
  }
}

export interface DetalhesAereo {
  origem?: string
  destino?: string
  data_ida?: string
  data_volta?: string
  cia_aerea?: string
  classe?: ClasseAerea
  localizador?: string
  internacional?: boolean
  numero_bilhete?: string
}

export interface DetalhesHotel {
  hotel_id?: number
  hotel_nome?: string
  cidade?: string
  data_checkin?: string
  data_checkout?: string
  num_hospedes?: number
  tipo_apto?: 'SGL' | 'DBL' | 'TPL'
  noites?: number
  tarifa_unitaria?: number
  localizador?: string
}

export interface DetalhesCarro {
  locadora?: string
  cidade_retirada?: string
  data_retirada?: string
  data_devolucao?: string
  categoria?: string
  localizador?: string
}

export interface DetalhesPacote {
  destino?: string
  data_ida?: string
  data_volta?: string
  descricao?: string
  localizador?: string
}

export interface Atendimento {
  id: string
  empresa_id: string
  funcionario_id: string | null
  passageiro_nome: string
  tipo_servico: TipoServico
  valor_cotacao: number
  valor_final?: number
  agente_user_id: string
  status: StatusAtendimento
  prioridade: Prioridade
  origem?: OrigemAtendimento
  observacoes: string
  data_atendimento: string
  detalhes_aereo?: DetalhesAereo
  detalhes_hotel?: DetalhesHotel
  detalhes_carro?: DetalhesCarro
  detalhes_pacote?: DetalhesPacote
  voucher_ids?: string[]
  motivo?: string

  valor_custo?: number
  valor_venda?: number
  taxa_percentual?: number
  taxa_ativa?: boolean
  taxa_valor_fixo?: number
  markup_valor?: number
  markup_desabilitado?: boolean

  venda_numero?: string
  emissor_codigo?: string
  origem_emissao?: 'manual' | 'planilha' | 'voucher_pdf' | 'caixa_entrada' | 'pdf_emissao'

  // --- V5: Repasse automático e fluxo de demandas ---
  em_atendimento?: boolean // se já tem alguém trabalhando
  repassada_em?: string // ISO timestamp do último repasse
  repassada_de?: string // user_id de quem a demanda saiu
  repassada_para?: string // user_id pra quem foi repassada
  motivo_repasse?: string // ex: "Redistribuição por prioridade"
  historico_agentes?: Array<{ user_id: string; user_name: string; desde: string; ate?: string }>
  prioridade_calculada?: Prioridade // calculada automaticamente pelo sistema
  dias_ate_checkin?: number // diferença em dias entre hoje e data check-in/ida

  created_at: string
  updated_at?: string
  finalizado_em?: string
}

export interface LogAuditoria {
  id: string
  user_id: string
  user_name: string
  acao: 'criar' | 'editar' | 'excluir' | 'importar' | 'login' | 'anexar_voucher'
  entidade: string
  entidade_id: string
  descricao: string
  timestamp: string
}

export interface CalculoFinanceiro {
  custo: number
  venda: number
  markup: number
  taxa_valor: number
  total_faturado: number
  margem_pct: number
}

export function calcularFinanceiro(a: {
  valor_custo?: number
  valor_venda?: number
  valor_final?: number
  valor_cotacao?: number
  taxa_percentual?: number
  taxa_ativa?: boolean
  taxa_valor_fixo?: number
  markup_valor?: number
  markup_desabilitado?: boolean
}): CalculoFinanceiro {
  const custo = Number(a.valor_custo || 0)
  const markupExplicito = Number(a.markup_valor || 0)
  let venda: number
  if (a.markup_desabilitado) {
    venda = custo
  } else {
    venda = Number(a.valor_venda ?? a.valor_final ?? a.valor_cotacao ?? 0)
    if (venda === 0 && markupExplicito > 0) venda = custo + markupExplicito
  }
  const markup = venda - custo
  let taxa_valor = 0
  if (a.taxa_ativa) {
    if (a.taxa_valor_fixo && a.taxa_valor_fixo > 0) taxa_valor = a.taxa_valor_fixo
    else if (a.taxa_percentual && a.taxa_percentual > 0) taxa_valor = venda * (a.taxa_percentual / 100)
  }
  const total_faturado = venda + taxa_valor
  const margem_pct = venda > 0 ? (markup / venda) * 100 : 0
  return { custo, venda, markup, taxa_valor, total_faturado, margem_pct }
}

export function aplicarConfigEmpresa(
  custo: number,
  config: ConfigCobrancaEmpresa
): { venda_sugerida: number; taxa_ativa: boolean; taxa_percentual: number; taxa_valor_fixo: number; markup_desabilitado: boolean } {
  const markup_desabilitado = !config.aplicar_markup
  let venda_sugerida = custo
  if (config.aplicar_markup && config.markup_padrao_pct > 0) {
    venda_sugerida = custo * (1 + config.markup_padrao_pct / 100)
  }
  return {
    venda_sugerida,
    taxa_ativa: config.aplicar_taxa,
    taxa_percentual: config.taxa_fixa_ativa ? 0 : config.taxa_padrao_pct,
    taxa_valor_fixo: config.taxa_fixa_ativa ? config.taxa_valor_fixo : 0,
    markup_desabilitado,
  }
}
