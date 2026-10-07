import { chamadosApi } from './http'
import type { Chamado, ChamadoAtividade, StatusChamado } from '@/types'

/** Cliente da API de chamados (backend que também provê autenticação). */

/**
 * Valor reservado do filtro por categoria para os chamados que não se encaixam
 * em NENHUMA categoria do formulário — quase todo o histórico anterior a ele ter
 * virado dinâmico. Espelha `CATEGORIA_SEM_CHAVE` do backend
 * (`shared/types/api.ts`) — se mudar lá, muda aqui.
 */
export const CATEGORIA_SEM_CHAVE = '__sem__'

export interface Paginado<T> {
  data: T[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export interface FiltrosChamado {
  unidade?: string
  categoria?: string
  /** Chave da categoria do formulário público (ex.: 'equipamento'). */
  categoriaChave?: string
  status?: StatusChamado | ''
  urgencia?: string
  /** Nome do técnico responsável — o backend casa por nome, não por id. */
  responsavel?: string
  page?: number
  limit?: number
}

export async function listarChamados(f: FiltrosChamado = {}): Promise<Paginado<Chamado>> {
  // Remove filtros vazios — o backend rejeita '' em enums (ex.: status)
  const params: Record<string, string | number> = { page: f.page ?? 1, limit: f.limit ?? 20 }
  if (f.unidade?.trim()) params.unidade = f.unidade.trim()
  if (f.categoria?.trim()) params.categoria = f.categoria.trim()
  if (f.categoriaChave?.trim()) params.categoriaChave = f.categoriaChave.trim()
  if (f.status) params.status = f.status
  if (f.urgencia?.trim()) params.urgencia = f.urgencia.trim()
  if (f.responsavel?.trim()) params.responsavel = f.responsavel.trim()
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

/**
 * O técnico aceita um chamado encaminhado para ele (botão "Aceitar chamado").
 * O backend carimba `aceitoEm` e tira o chamado de "Aberto". Idempotente.
 */
export interface ResponderChamadoPayload {
  texto: string
  anexos?: AnexoMensagemPayload[]
}

export async function responderChamado(id: string, payload: ResponderChamadoPayload): Promise<Chamado> {
  const { data } = await chamadosApi.post<Chamado>(`/chamados/${id}/resposta`, payload)
  return data
}

/* ---------- Fluxo de atendimento ---------- */

/**
 * ACEITA o chamado: o técnico assume e o horário do aceite é carimbado pelo
 * servidor (não pelo relógio do navegador, que pode estar errado).
 *
 * Endpoint próprio, e não `PATCH /status`: só o responsável pelo chamado pode
 * aceitar, e o backend responde 409 se ele já estiver em atendimento.
 */
export async function aceitarChamado(id: string): Promise<Chamado> {
  const { data } = await chamadosApi.post<Chamado>(`/chamados/${id}/aceitar`)
  return data
}

/** Registro do que foi feito. Pode repetir quantas vezes quiser — cada envio vira uma linha datada. */
export async function registrarAtividade(
  id: string,
  payload: ResponderChamadoPayload,
): Promise<ChamadoAtividade> {
  const { data } = await chamadosApi.post<ChamadoAtividade>(`/chamados/${id}/atividades`, payload)
  return data
}

/**
 * CONCLUI o atendimento: não encerra o chamado, passa para a conferência da
 * escola (`AGUARDANDO_CONFERENCIA`). O backend exige a descrição.
 */
export async function concluirChamado(
  id: string,
  payload: ResponderChamadoPayload,
): Promise<Chamado> {
  const { data } = await chamadosApi.post<Chamado>(`/chamados/${id}/concluir`, {
    descricaoResolucao: payload.texto,
    anexos: payload.anexos,
  })
  return data
}

/**
 * CONFERÊNCIA DA ESCOLA: `aprovado` encerra o chamado; `aprovado: false`
 * reabre (o texto é obrigatório — é ele que diz o que ficou faltando).
 */
export async function conferirChamado(
  id: string,
  payload: { aprovado: boolean; texto?: string; anexos?: AnexoMensagemPayload[] },
): Promise<Chamado> {
  const { data } = await chamadosApi.post<Chamado>(`/chamados/${id}/conferir`, payload)
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

/**
 * Nomes disponíveis no filtro "Técnico" da listagem de chamados.
 *
 * Não é a mesma lista de `listarTecnicos()`: aquela é de ADMIN/TECNICO e serve
 * para ENCAMINHAR (quem pode receber chamado agora). Esta entra também quem já
 * tem chamado em seu nome, mesmo desativado — sem isso, o filtro não alcançaria
 * o trabalho já feito por quem saiu da equipe.
 */
export async function listarTecnicosDoFiltro(): Promise<string[]> {
  const { data } = await chamadosApi.get<{ data: string[] }>('/chamados/filtros/tecnicos')
  return data.data
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
  ENCAMINHADO: 'Encaminhado',
  ANDAMENTO: 'Em atendimento',
  COMUNICADO: 'Aguardando resposta',
  AGUARDANDO_CONFERENCIA: 'Aguardando conferência',
  RESOLVIDO: 'Concluído',
}

/** Ajuda a entender por que um status é o que é, direto no rótulo da lista. */
export const AJUDA_STATUS_CHAMADO: Record<StatusChamado, string> = {
  ABERTO: 'Novo ou reaberto. Falta encaminhar para um técnico.',
  ENCAMINHADO: 'Já está com um técnico, aguardando o aceite dele.',
  ANDAMENTO: 'O técnico aceitou e está registrando o serviço.',
  COMUNICADO: 'A equipe fez uma pergunta e aguarda a resposta da escola.',
  AGUARDANDO_CONFERENCIA: 'O técnico concluiu. A escola precisa conferir.',
  RESOLVIDO: 'Encerrado — a escola confirmou que ficou tudo certo.',
}

export function rotuloStatusChamado(status: string): string {
  return ROTULO_STATUS_CHAMADO[status as StatusChamado] || status
}

/**
 * Fases do fluxo, na ordem. Serve para agrupar os filtros e para a coluna
 * "onde está parado" da lista.
 */
export const STATUS_FLUXO: StatusChamado[] = [
  'ABERTO',
  'ENCAMINHADO',
  'ANDAMENTO',
  'COMUNICADO',
  'AGUARDANDO_CONFERENCIA',
  'RESOLVIDO',
]
