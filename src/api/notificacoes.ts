import { chamadosApi } from './http'
import type { Notificacao } from '@/types'

/** Notificações do usuário logado (backend de chamados). */

export interface ListaNotificacoes {
  data: Notificacao[]
  naoLidas: number
}

export async function listarNotificacoes(): Promise<ListaNotificacoes> {
  const { data } = await chamadosApi.get<ListaNotificacoes>('/notificacoes')
  return data
}

export async function marcarNotificacaoLida(id: string): Promise<void> {
  await chamadosApi.post(`/notificacoes/${id}/lida`)
}

export async function marcarTodasNotificacoesLidas(): Promise<void> {
  await chamadosApi.post('/notificacoes/ler-todas')
}
