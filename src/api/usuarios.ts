import { chamadosApi } from './http'
import type { Nivel, User } from '@/types'
import type { Paginado } from './chamados'

/** Gestão de usuários (somente ADMIN) — backend de chamados. */

export interface FiltrosUsuario {
  search?: string
  nivel?: Nivel | ''
  status?: string
  page?: number
  limit?: number
}

export async function listarUsuarios(f: FiltrosUsuario = {}): Promise<Paginado<User>> {
  const { data } = await chamadosApi.get<Paginado<User>>('/usuarios', {
    params: { page: 1, limit: 20, ...f },
  })
  return data
}

export interface NovoUsuario {
  email: string
  nome: string
  nivel: Nivel
  filial: string
}

export type UsuarioCriado = User & { senhaTemporaria: string }

export async function criarUsuario(payload: NovoUsuario): Promise<UsuarioCriado> {
  const { data } = await chamadosApi.post<UsuarioCriado>('/usuarios', payload)
  return data
}

export interface AtualizarUsuario {
  nome?: string
  nivel?: Nivel
  filial?: string
  status?: 'ATIVO' | 'INATIVO'
}

export async function atualizarUsuario(id: string, payload: AtualizarUsuario): Promise<User> {
  const { data } = await chamadosApi.patch<User>(`/usuarios/${id}`, payload)
  return data
}

export async function desativarUsuario(id: string): Promise<void> {
  await chamadosApi.delete(`/usuarios/${id}`)
}

export async function gerarSenhaTemporaria(email: string): Promise<string> {
  const { data } = await chamadosApi.post<{ senhaTemporaria: string }>(
    '/auth/admin/gerar-senha-temporaria',
    { email },
  )
  return data.senhaTemporaria
}

/** Escolas cadastradas (para o select de unidade). Endpoint autenticado. */
export async function listarEscolas(): Promise<string[]> {
  const { data } = await chamadosApi.get<Array<{ nome: string }> | string[]>('/escolas/nomes')
  // aceita tanto [{nome}] quanto string[]
  return (data as Array<{ nome: string } | string>).map((e) => (typeof e === 'string' ? e : e.nome))
}
