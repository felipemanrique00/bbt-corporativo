// Empresas pré-cadastradas: apenas as REAIS que já aparecem
// nas suas planilhas/PDFs de emissão (códigos WAY153, WAY262, WAY364).
// Demais empresas devem ser cadastradas via Menu > Empresas
// ou criadas automaticamente pelo importador.

import type { Empresa } from '@/types'
import { CONFIG_COBRANCA_PADRAO } from '@/types'

export const EMPRESAS_SEED: Empresa[] = [
  {
    id: 'emp-way-153',
    nome: 'Concessionária Rota Sertaneja MG-GO S.A.',
    cnpj: '',
    codigo_cliente: 'WAY153',
    endereco: 'Rodovia BR-050 - MG/GO',
    responsavel: '',
    email_responsavel: '',
    telefone: '',
    centro_custo_padrao: '',
    ativa: true,
    config_cobranca: { ...CONFIG_COBRANCA_PADRAO, markup_padrao_pct: 10 },
    created_at: new Date().toISOString(),
  },
  {
    id: 'emp-way-262',
    nome: 'Concessionária da Rodovia BR 262 MG S.A.',
    cnpj: '',
    codigo_cliente: 'WAY262',
    endereco: 'Rodovia BR-262 - MG',
    responsavel: '',
    email_responsavel: '',
    telefone: '',
    centro_custo_padrao: '',
    ativa: true,
    config_cobranca: { ...CONFIG_COBRANCA_PADRAO, markup_padrao_pct: 10 },
    created_at: new Date().toISOString(),
  },
  {
    id: 'emp-way-364',
    nome: 'Concessionária Rota Agro MT-GO S.A.',
    cnpj: '',
    codigo_cliente: 'WAY364',
    endereco: 'Rodovia MT-GO',
    responsavel: '',
    email_responsavel: '',
    telefone: '',
    centro_custo_padrao: '',
    ativa: true,
    config_cobranca: { ...CONFIG_COBRANCA_PADRAO, markup_padrao_pct: 10 },
    created_at: new Date().toISOString(),
  },
]
