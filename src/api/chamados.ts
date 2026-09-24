import { chamadosApi } from './http'
import type { Chamado, StatusChamado } from '@/types'

/** Cliente da API de chamados (backend que também provê autenticação). */

export interface Paginado<T> {
  data: T[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export interface FiltrosChamado {
  unidade?: string
  categoria?: string
  status?: StatusChamado | ''
  urgencia?: string
  page?: number
  limit?: number
}

export async function listarChamados(f: FiltrosChamado = {}): Promise<Paginado<Chamado>> {
  // Remove filtros vazios — o backend rejeita '' em enums (ex.: status)
  const params: Record<string, string | number> = { page: f.page ?? 1, limit: f.limit ?? 20 }
  if (f.unidade?.trim()) params.unidade = f.unidade.trim()
  if (f.categoria?.trim()) params.categoria = f.categoria.trim()
  if (f.status) params.status = f.status
  if (f.urgencia?.trim()) params.urgencia = f.urgencia.trim()
  const { data } = await chamadosApi.get<Paginado<Chamado>>('/chamados', { params })
  return data
}

export async function getChamado(id: string): Promise<Chamado> {
  const { data } = await chamadosApi.get<Chamado>(`/chamados/${id}`)
  return data
}

/** Anexo temporário (base64) de pergunta/resposta — expira 7 dias após o envio. */
export interface AnexoMensagemPayload {
  nome: string
  tipo?: string
  base64: string
}

export interface AtualizarStatusPayload {
  status: StatusChamado
  tecnicoResolucao?: string
  descricaoResolucao?: string
  /** Matriz: pergunta enviada ao solicitante ao mudar para "Aguardando resposta" */
  pergunta?: string
  perguntaAnexos?: AnexoMensagemPayload[]
}

export async function atualizarStatusChamado(id: string, payload: AtualizarStatusPayload): Promise<Chamado> {
  const { data } = await chamadosApi.patch<Chamado>(`/chamados/${id}/status`, payload)
  return data
}

export interface ResponderChamadoPayload {
  texto: string
  anexos?: AnexoMensagemPayload[]
}

export async function responderChamado(id: string, payload: ResponderChamadoPayload): Promise<Chamado> {
  const { data } = await chamadosApi.post<Chamado>(`/chamados/${id}/resposta`, payload)
  return data
}

/** Exclusão lógica do chamado (permissões validadas no backend). */
export async function deletarChamado(id: string): Promise<void> {
  await chamadosApi.delete(`/chamados/${id}`)
}

/** Atualização em lote (somente ADMIN/TECNICO no backend). */
export async function atualizarChamadosEmLote(
  ids: string[],
  payload: { status?: StatusChamado; tecnicoResolucao?: string; resposta?: string },
): Promise<{ atualizados: number }> {
  const { data } = await chamadosApi.patch<{ atualizados: number }>('/chamados/batch', { ids, ...payload })
  return data
}

/* ---------- Apresentação ---------- */

export const ROTULO_STATUS_CHAMADO: Record<StatusChamado, string> = {
  ABERTO: 'Aberto',
  ANDAMENTO: 'Em atendimento',
  COMUNICADO: 'Aguardando resposta',
  RESOLVIDO: 'Concluído',
}

export function rotuloStatusChamado(status: string): string {
  return ROTULO_STATUS_CHAMADO[status as StatusChamado] || status
}
