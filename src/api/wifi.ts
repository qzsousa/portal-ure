import { chamadosApi } from './http'

export interface VisitaWifiApi {
  id: string
  createdAt: string
  dataVisita: string
  tecnico: string
  escola: string
  cie: string | null
  salasTotal: number
  rackCond: string | null
  totalAps: number
  apsOn: number
  apsOff: number
  apsDown: number
  salasSemAp: number
  semApComInfra: number
  semApParcial: number
  semApSemInfra: number
  latitude: number | null
  longitude: number | null
  obs: string | null
  aps: { id: string; numero: string; local: string; bloco: string | null; status: string; obs: string | null }[]
  salasSem: { id: string; sala: string; tipo: string | null; bloco: string | null; infra: string; falta: string[]; obs: string | null }[]
}

export interface SalvarLevantamentoPayload {
  visita: Record<string, any>
  aps: any[]
  semAp: any[]
}

export async function salvarLevantamento(payload: SalvarLevantamentoPayload): Promise<{
  ok: boolean
  id: string
  escola: string
  totalAps: number
  on: number
  off: number
  down: number
  semAp: number
  comInfra: number
  parcial: number
  semInfra: number
}> {
  const { data } = await chamadosApi.post('/wifi', payload)
  return data
}

export async function listarVisitasWifi(): Promise<VisitaWifiApi[]> {
  const { data } = await chamadosApi.get<VisitaWifiApi[]>('/wifi')
  return data
}

export async function listarUltimasVisitasWifi(): Promise<{ id: string; data: string; tecnico: string; escola: string; aps: number; semAp: number }[]> {
  const { data } = await chamadosApi.get('/wifi/ultimas')
  return data
}
