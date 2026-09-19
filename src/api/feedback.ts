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
