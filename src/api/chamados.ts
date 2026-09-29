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

/* ---------- Encaminhamento para técnico ---------- */

/** Técnico que pode receber um encaminhamento. */
export interface TecnicoDestino {
  id: string
  nome: string
  email: string
  filial: string
  /** Chamados abertos dele — o backend usa para sugerir quem está mais livre. */
  abertos?: number
}

/** `UNIDADE` = técnico da própria unidade (escolhido pelo backend); `TECNICO` = o escolhido. */
export type ModoEncaminhamento = 'UNIDADE' | 'TECNICO'

/** Todos os técnicos ativos — usado como lista de destinos. */
export async function listarTecnicos(): Promise<TecnicoDestino[]> {
  const { data } = await chamadosApi.get<{ data: TecnicoDestino[] }>('/chamados/encaminhar/tecnicos')
  return data.data
}

/**
 * Técnicos que atendem a unidade do chamado, na ordem de sugestão do backend
 * (casa exata > schools irmãs > menos chamados abertos).
 */
export async function listarTecnicosDaUnidade(chamadoId: string): Promise<TecnicoDestino[]> {
  const { data } = await chamadosApi.get<{ data: TecnicoDestino[] }>(`/chamados/encaminhar/tecnicos/${chamadoId}`)
  return data.data
}

export interface EncaminharChamadoPayload {
  modo: ModoEncaminhamento
  /** Obrigatório quando `modo` = 'TECNICO'. */
  tecnicoId?: string
  /** Observação opcional registrada no histórico do chamado. */
  observacao?: string
}

/**
 * Encaminha/reencaminha o chamado para um técnico (modal de detalhes).
 * Lança AxiosError 422 quando não há técnico atendendo a unidade.
 */
export async function encaminharChamado(
  id: string,
  payload: EncaminharChamadoPayload,
): Promise<{ chamado: Chamado; tecnico: TecnicoDestino }> {
  const { data } = await chamadosApi.post<{ chamado: Chamado; tecnico: TecnicoDestino }>(
    `/chamados/${id}/encaminhar`,
    payload,
  )
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
