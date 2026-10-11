import { chamadosApi } from './http'
import type { CodigoPrimeiroAcesso, Nivel, User } from '@/types'
import type { Paginado } from './chamados'

/** Gestão de usuários (somente ADMIN) — backend de chamados. */

export interface FiltrosUsuario {
  search?: string
  nivel?: Nivel | ''
  /** Unidade escolar. No backend, casa por `contains`: o técnico tem várias unidades na mesma linha. */
  filial?: string
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
  /**
   * Tipos de chamado que este usuário atende ("<categoria>::<rótulo>"). Lista
   * vazia = sem restrição. Só o ADMIN pode enviar — o backend recusa com 403
   * se vier de um Gestor.
   */
  escopoTipos?: string[]
}

export type UsuarioCriado = User & { codigoPrimeiroAcesso: string }

export async function criarUsuario(payload: NovoUsuario): Promise<UsuarioCriado> {
  const { data } = await chamadosApi.post<UsuarioCriado>('/usuarios', payload)
  return data
}

export interface AtualizarUsuario {
  nome?: string
  nivel?: Nivel
  filial?: string
  status?: 'ATIVO' | 'INATIVO'
  /**
   * OMITIR o campo deixa o escopo como está; `[]` limpa (o usuário volta a ver
   * tudo). A distinção importa — por isso não é padrão aqui.
   */
  escopoTipos?: string[]
}

export async function atualizarUsuario(id: string, payload: AtualizarUsuario): Promise<User> {
  const { data } = await chamadosApi.patch<User>(`/usuarios/${id}`, payload)
  return data
}

export async function desativarUsuario(id: string): Promise<void> {
  await chamadosApi.delete(`/usuarios/${id}`)
}

/**
 * Gera um novo código de primeiro acesso para um usuário.
 *
 * Só ADMIN (e só para quem ainda não criou senha). O código é devolvido em
 * claro porque o ADMIN precisa LER para repassar — quem define a senha é a
 * pessoa, no acesso dela.
 *
 * Caminho do gestor que perdeu a senha: ela abre o chamado pelo formulário
 * público, o ADMIN gera o código aqui e responde o próprio chamado com ele
 * (`ChamadosView` → "Responder com código de acesso"). O que circula é
 * sempre o código, nunca uma senha.
 *
 * Normaliza o e-mail como o resto do fluxo (`primeiroAcesso.ts`): o gestor
 * digita o endereço no chamado e o ADMIN o digita aqui — se divergirem em
 * maiúsculas ou espaço, o backend não encontra a conta.
 */
export async function gerarCodigoPrimeiroAcesso(email: string): Promise<CodigoPrimeiroAcesso> {
  const { data } = await chamadosApi.post<CodigoPrimeiroAcesso>('/auth/admin/gerar-codigo-primeiro-acesso', {
    email: email.trim().toLowerCase(),
  })
  return data
}

/** Aceita tanto `["E.E. X"]` quanto `[{ nome: "E.E. X" }]`. */
function extrairNomes(data: unknown): string[] {
  if (!Array.isArray(data)) return []
  return (data as Array<{ nome?: string } | string>)
    .map((e) => (typeof e === 'string' ? e : e?.nome))
    .filter((n): n is string => !!n && n.trim().length > 0)
}

/**
 * Escolas cadastradas (para o select de unidade).
 * Usa a rota pública enxuta (`/escolas/nomes`, montada no index do backend) e,
 * se ela não responder na versão em uso, cai para a lista padronizada ou para o
 * cadastro completo — assim o select nunca fica vazio sem o usuário perceber.
 */
export async function listarEscolas(): Promise<string[]> {
  const tentativas: Array<() => Promise<unknown>> = [
    () => chamadosApi.get('/escolas/nomes').then((r) => r.data),
    () => chamadosApi.get('/escolas/nomes-padronizados').then((r) => r.data),
    () => chamadosApi.get('/escolas').then((r) => r.data),
  ]

  for (const tentar of tentativas) {
    try {
      const nomes = extrairNomes(await tentar())
      if (nomes.length) return nomes.sort((a, b) => a.localeCompare(b, 'pt-BR'))
    } catch {
      // tenta o próximo endpoint
    }
  }
  return []
}
