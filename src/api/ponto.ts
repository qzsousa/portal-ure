import { chamadosApi } from './http'
import type { PontoHojeResponse, PontoRegistro } from '@/types'

export async function statusPontoHoje(): Promise<PontoHojeResponse> {
  const { data } = await chamadosApi.get<PontoHojeResponse>('/ponto/hoje')
  return data
}

export async function baterPonto(payload: {
  agendaId?: string
  escola?: string
  latitude?: number
  longitude?: number
  accuracy?: number
  justificativa?: string
}): Promise<{ status: string; registro: PontoRegistro }> {
  const { data } = await chamadosApi.post<{ status: string; registro: PontoRegistro }>('/ponto', payload)
  return data
}

export async function listarSolicitacoesPonto(params?: {
  data?: string
  status?: string
  tecnicoId?: string
}): Promise<PontoRegistro[]> {
  const { data } = await chamadosApi.get<PontoRegistro[]>('/ponto', { params })
  return data
}

export async function aprovarPonto(id: string): Promise<PontoRegistro> {
  const { data } = await chamadosApi.patch<PontoRegistro>(`/ponto/${id}/aprovar`)
  return data
}

export async function reprovarPonto(id: string): Promise<PontoRegistro> {
  const { data } = await chamadosApi.patch<PontoRegistro>(`/ponto/${id}/reprovar`)
  return data
}

export async function historicoPonto(params?: { de?: string; ate?: string }): Promise<PontoRegistro[]> {
  const { data } = await chamadosApi.get<PontoRegistro[]>('/ponto/historico', { params })
  return data
}

export async function listarPontoAdmin(params?: { data?: string; status?: string; tecnicoId?: string; escola?: string }): Promise<PontoRegistro[]> {
  const { data } = await chamadosApi.get<PontoRegistro[]>('/ponto', { params })
  return data
}

export async function resumoPontoHoje(): Promise<any[]> {
  const { data } = await chamadosApi.get<any[]>('/ponto/resumo-hoje')
  return data
}

export async function marcarFerias(usuarioId: string, inicio: string | null, fim: string | null): Promise<any> {
  const { data } = await chamadosApi.patch(`/usuarios/${usuarioId}/ferias`, { inicio, fim })
  return data
}
