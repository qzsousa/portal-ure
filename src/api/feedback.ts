import { chamadosApi } from './http'

/**
 * Endpoints AUTENTICADOS de feedback (avaliações de chamados + elogios/sugestões)
 * do backend de chamados. Passam por `chamadosApi` (token + refresh em 401).
 */

export type TipoFeedback = 'ELOGIO' | 'SUGESTAO'

export interface FeedbackItem {
  id: string
  tipo: TipoFeedback
  nome: string | null
  unidade: string | null
  mensagem: string
  criadoEm: string
}

export interface FeedbackLista {
  data: FeedbackItem[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface FeedbackStats {
  avaliacoes: {
    total: number
    media: number
    /** chaves '1'..'5' → quantidade de avaliações com aquela nota */
    porNota: Record<string, number>
  }
  feedback: {
    elogios: number
    sugestoes: number
  }
}

/** Lista elogios/sugestões com paginação (ADMIN). */
export async function listarFeedbacks(params?: {
  tipo?: TipoFeedback
  page?: number
  limit?: number
}): Promise<FeedbackLista> {
  const { data } = await chamadosApi.get<FeedbackLista>('/feedback', { params })
  return data
}

/** KPIs consolidados de avaliações e elogios/sugestões (autenticado). */
export async function getFeedbackStats(): Promise<FeedbackStats> {
  const { data } = await chamadosApi.get<FeedbackStats>('/feedback/stats')
  return data
}

/** Uma avaliação de atendimento com o comentário que a escola deixou. */
export interface AvaliacaoItem {
  id: string
  nota: number
  comentario: string | null
  criadoEm: string
  protocolo: string
  unidade: string
  solicitante: string
  tipo: string
  /** Técnico que fechou o chamado ou, na falta, o técnico da unidade. */
  tecnico: string | null
}

export interface AvaliacaoLista {
  data: AvaliacaoItem[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

/**
 * Lista as avaliações COM o comentário (ADMIN/TECNICO).
 *
 * É o que dá sentido à nota: quem avaliou, sobre qual chamado e o que
 * escreveu. `somenteComentarios` esconde as notas sem texto.
 */
export async function listarAvaliacoes(params?: {
  nota?: number
  somenteComentarios?: boolean
  page?: number
  limit?: number
}): Promise<AvaliacaoLista> {
  const { data } = await chamadosApi.get<AvaliacaoLista>('/feedback/avaliacoes', {
    params: {
      ...params,
      somenteComentarios: params?.somenteComentarios ? 'true' : undefined,
    },
  })
  return data
}

