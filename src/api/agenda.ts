import { chamadosApi } from './http'
import type { AtribuicaoAgenda, AtribuicaoAgendaCreate, FiltrosAtribuicaoAgenda } from '@/types'

/**
 * Cliente da API de agenda de atendimento.
 *
 * As rotas vivem no backend de chamados (`/api/agenda`), então usa o MESMO
 * `chamadosApi` — não existe cliente HTTP novo.
 */

/** Intervalo de datas exibido no calendário, em "AAAA-MM-DD". */
export type IntervaloAgenda = FiltrosAtribuicaoAgenda

/**
 * Lista as atribuições da agenda. Todos os filtros são opcionais; sem filtro
 * vem o histórico inteiro.
 *
 * O `fim` é o primeiro dia do mês seguinte quando o chamador quer o mês
 * fechado: assim o último dia entra tanto se o backend tratar `fim` como
 * exclusivo quanto como inclusivo.
 */
export async function listarAtribuicoes(
  intervalo: IntervaloAgenda = {},
): Promise<AtribuicaoAgenda[]> {
  const params: Record<string, string> = {}
  if (intervalo.inicio?.trim()) params.inicio = intervalo.inicio.trim()
  if (intervalo.fim?.trim()) params.fim = intervalo.fim.trim()
  if (intervalo.tecnicoId?.trim()) params.tecnicoId = intervalo.tecnicoId.trim()
  if (intervalo.escola?.trim()) params.escola = intervalo.escola.trim()
  const { data } = await chamadosApi.get<{ data: AtribuicaoAgenda[] }>('/agenda', { params })
  return data.data
}

/** Atribui um dia a um técnico (modal de atribuição). */
export async function atribuirDia(payload: AtribuicaoAgendaCreate): Promise<AtribuicaoAgenda> {
  const { data } = await chamadosApi.post<AtribuicaoAgenda>('/agenda', payload)
  return data
}

/** Remove uma atribuição. As permissões são revalidadas no backend. */
export async function removerAtribuicao(id: string): Promise<void> {
  await chamadosApi.delete(`/agenda/${id}`)
}
