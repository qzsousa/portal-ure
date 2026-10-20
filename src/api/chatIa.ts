import { chamadosApi } from './http'

export interface ChatConvApi {
  id: string
  title: string
  mensagens: { role: 'user' | 'assistant' | 'tool'; content: string }[]
  atualizado: number
}

export async function listarConversasApi(): Promise<ChatConvApi[]> {
  const { data } = await chamadosApi.get('/ia/conversas')
  return (data ?? []) as ChatConvApi[]
}

export async function criarConversaApi(payload: { title?: string; mensagens?: ChatConvApi['mensagens'] }): Promise<ChatConvApi> {
  const { data } = await chamadosApi.post('/ia/conversas', payload)
  return data as ChatConvApi
}

export async function atualizarConversaApi(id: string, payload: { title?: string; mensagens?: ChatConvApi['mensagens'] }): Promise<ChatConvApi> {
  const { data } = await chamadosApi.put(`/ia/conversas/${id}`, payload)
  return data as ChatConvApi
}

export async function excluirConversaApi(id: string): Promise<void> {
  await chamadosApi.delete(`/ia/conversas/${id}`)
}