// ============================================================
// Sistema de Autenticação LOCAL V4
// - Único usuário "super master" hardcoded: Felipe Manrique
// - Usuários adicionais em localStorage (cadastrados via tela Usuários)
// - Permissões granulares por perfil
//
// ⚠️ ATENÇÃO SOBRE SEGURANÇA:
// Senhas são salvas em texto simples no navegador (localStorage).
// Isso é ACEITÁVEL apenas para sistema local, rodando no seu PC.
// Para produção na nuvem com múltiplos agentes: é IMPRESCINDÍVEL
// migrar pra backend com senhas em bcrypt.
// ============================================================
import type { User, UserRole, PerfilBBT, Permissoes } from '@/types'
import { PERMISSOES_PADRAO_POR_PERFIL } from '@/types'

/**
 * SUPER MASTER — sempre existe, nunca pode ser deletado do sistema
 * É você, Felipe.
 */
export const SUPER_MASTER: User = {
  id: 'usr-felipe-master',
  email: 'manriquefelipe010@gmail.com',
  name: 'Felipe Manrique',
  role: 'master',
  company_id: null,
  perfil_bbt: 'lider',
  ativo: true,
  created_at: '2026-01-01T00:00:00.000Z',
}

const SUPER_MASTER_SENHA = '020470'

// localStorage keys
const LS_USERS = 'bbt-users-v4'
const LS_CURRENT_USER = 'bbt-current-user-v4'

/**
 * Conta interna com senha (apenas para autenticação local).
 * Nunca é exposta ao código da UI — só passa pela função de login.
 */
interface ContaLocal {
  user: User
  password: string
}

// ======== Gestão de usuários cadastrados ========

function loadUsuarios(): ContaLocal[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LS_USERS)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function saveUsuarios(list: ContaLocal[]) {
  try {
    localStorage.setItem(LS_USERS, JSON.stringify(list))
    return true
  } catch (e) {
    console.error('Erro salvando usuários:', e)
    return false
  }
}

/**
 * Retorna TODOS os usuários do sistema, incluindo o Super Master
 */
export function getAllUsers(): User[] {
  const extras = loadUsuarios().map((c) => c.user)
  return [SUPER_MASTER, ...extras]
}

/**
 * Retorna só os usuários que são agentes da BBT (role=master + perfil_bbt)
 */
export function getAgentesBBT(): User[] {
  return getAllUsers().filter((u) => u.role === 'master' && u.perfil_bbt && u.ativo !== false)
}

export function getUserById(id: string): User | undefined {
  return getAllUsers().find((u) => u.id === id)
}

/**
 * Cadastra novo usuário. Só pode ser chamado pelo Super Master.
 */
export function addUsuario(
  data: Omit<User, 'id' | 'created_at' | 'ativo'> & { password: string }
): User | null {
  if (!data.email || !data.password || !data.name) return null

  const lista = loadUsuarios()
  // Evitar e-mail duplicado (compara também com Super Master)
  if (data.email.toLowerCase() === SUPER_MASTER.email.toLowerCase()) return null
  if (lista.some((c) => c.user.email.toLowerCase() === data.email.toLowerCase())) return null

  const novoUser: User = {
    id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    email: data.email.toLowerCase(),
    name: data.name,
    role: data.role,
    company_id: data.company_id,
    perfil_bbt: data.perfil_bbt,
    permissoes: data.permissoes,
    avatar: data.avatar,
    ativo: true,
    created_at: new Date().toISOString(),
  }

  lista.push({ user: novoUser, password: data.password })
  saveUsuarios(lista)
  return novoUser
}

/**
 * Edita dados do usuário. Se password for passado, troca a senha.
 * Super Master pode ser editado (nome, permissoes) mas não removido.
 */
export function updateUsuario(
  id: string,
  patch: Partial<User> & { password?: string }
): boolean {
  // Editar Super Master: só nome, avatar ou senha
  if (id === SUPER_MASTER.id) {
    if (patch.password) {
      // Não deixamos trocar senha do super master pela UI comum
      console.warn('Senha do super master não pode ser alterada pela UI normal')
    }
    return true
  }

  const lista = loadUsuarios()
  const idx = lista.findIndex((c) => c.user.id === id)
  if (idx === -1) return false

  const atual = lista[idx]
  lista[idx] = {
    user: { ...atual.user, ...patch, id: atual.user.id },
    password: patch.password && patch.password.length >= 4 ? patch.password : atual.password,
  }
  return saveUsuarios(lista)
}

/**
 * "Deleta" usuário (na verdade inativa, para preservar histórico)
 */
export function deleteUsuario(id: string): boolean {
  if (id === SUPER_MASTER.id) return false
  const lista = loadUsuarios()
  const idx = lista.findIndex((c) => c.user.id === id)
  if (idx === -1) return false
  lista[idx].user.ativo = false
  return saveUsuarios(lista)
}

export function reativarUsuario(id: string): boolean {
  if (id === SUPER_MASTER.id) return true
  const lista = loadUsuarios()
  const idx = lista.findIndex((c) => c.user.id === id)
  if (idx === -1) return false
  lista[idx].user.ativo = true
  return saveUsuarios(lista)
}

// ======== LOGIN / LOGOUT ========

/**
 * Autentica por email + senha.
 * Retorna o User sem senha, ou null se credenciais inválidas.
 */
export function login(email: string, password: string): User | null {
  if (typeof window === 'undefined') return null
  const emailNorm = email.trim().toLowerCase()

  // Super Master
  if (emailNorm === SUPER_MASTER.email.toLowerCase() && password === SUPER_MASTER_SENHA) {
    const u = { ...SUPER_MASTER }
    localStorage.setItem(LS_CURRENT_USER, JSON.stringify(u))
    return u
  }

  // Usuários adicionais
  const lista = loadUsuarios()
  const conta = lista.find(
    (c) => c.user.email.toLowerCase() === emailNorm && c.password === password && c.user.ativo !== false
  )
  if (!conta) return null

  localStorage.setItem(LS_CURRENT_USER, JSON.stringify(conta.user))
  return conta.user
}

export function logout() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(LS_CURRENT_USER)
}

export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LS_CURRENT_USER)
    if (!raw) return null
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function isLoggedIn(): boolean {
  return getCurrentUser() !== null
}

// ======== PERMISSÕES ========

export function getPermissoes(user: User | null): Permissoes {
  if (!user) return PERMISSOES_PADRAO_POR_PERFIL.operacional

  // Super Master: tudo liberado
  if (user.id === SUPER_MASTER.id) return PERMISSOES_PADRAO_POR_PERFIL.lider

  // Usa permissões customizadas se existirem
  if (user.permissoes) return user.permissoes

  // Fallback: padrão do perfil
  if (user.perfil_bbt) return PERMISSOES_PADRAO_POR_PERFIL[user.perfil_bbt]

  return PERMISSOES_PADRAO_POR_PERFIL.operacional
}

export function hasPermission(user: User | null, perm: keyof Permissoes): boolean {
  if (!user) return false
  return getPermissoes(user)[perm]
}

/** Compat: "pode editar globalmente" = é master */
export function canEditGlobal(user: User | null): boolean {
  if (!user) return false
  return user.role === 'master'
}

export function canEditCompany(user: User | null, company_id: string | null): boolean {
  if (!user) return false
  if (user.role === 'master') return true
  return user.company_id === company_id
}

export function canViewCompany(user: User | null, company_id: string | null): boolean {
  if (!user) return false
  if (user.role === 'master') return true
  return user.company_id === company_id
}

export function roleLabel(role: UserRole): string {
  switch (role) {
    case 'master': return 'Agente BBT'
    case 'company_admin': return 'Admin Empresa'
    case 'colaborador': return 'Colaborador'
  }
}

export function perfilBBTLabel(p?: PerfilBBT): string {
  if (!p) return '—'
  switch (p) {
    case 'lider': return 'Líder / Dono'
    case 'agente': return 'Agente'
    case 'gestor_financeiro': return 'Gestor Financeiro'
    case 'supervisor': return 'Supervisor'
    case 'operacional': return 'Operacional'
  }
}

// ======== SUBSTITUTO do antigo MOCK_ACCOUNTS ========
// Código antigo pode usar isto - agora retorna TODOS os users dinamicamente
export function getMockAccounts(): Array<{ email: string; user: User }> {
  return getAllUsers().map((u) => ({ email: u.email, user: u }))
}

// Compat legacy
export const MOCK_ACCOUNTS = {
  get length() { return getAllUsers().length },
  filter: (fn: (acc: { email: string; user: User }) => boolean) =>
    getMockAccounts().filter(fn),
  find: (fn: (acc: { email: string; user: User }) => boolean) =>
    getMockAccounts().find(fn),
  map: <T,>(fn: (acc: { email: string; user: User }) => T) =>
    getMockAccounts().map(fn),
}
