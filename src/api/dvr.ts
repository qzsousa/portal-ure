import { chamadosApi } from './http'

// Mesmos nomes de campo do antigo src/api/monitor.ts, para que a tela
// MonitorDvrsView nao precise ser redesenhada — ela apenas troca a fonte.
export type DvrStatus = 'online' | 'offline' | 'desconhecido'
export type DvrTipo = 'ADM' | 'PED'

export interface DvrHost {
  ip: string
  hostname: string
  tipo: DvrTipo
  faixa: string
  escola: string
  escolaId: string
  portas: number[]
  status: DvrStatus
  metodo: string | null
  latenciaMs: number | null
  ttl: number | null
  verificadoEm: number | null
  onlineDesde: number | null
  offlineDesde: number | null
  alternancias: number
  historico: string
}

export interface EscolaResumo {
  id: string
  rotulo: string
  escolaId: string
  total: number
  online: number
  offline: number
  desconhecido: number
  adm: { online: number; offline: number }
  ped: { online: number; offline: number }
}

export interface DvrSnapshot {
  geradoEm?: number
  observacaoEm?: number
  total: number
  online: number
  offline: number
  desconhecido: number
  caidosAgora: number
  percentualOnline: number
  latenciaMediaMs: number | null
  latenciaMaximaMs: number | null
  porFaixa: EscolaResumo[]
  emAndamento: boolean
  ultimaVarreduraEm: number | null
  proximaVarreduraEm: number | null
  duracaoVarreduraMs: number | null
  intervaloSegundos: number
  totalVarreduras: number
  concorrencia: number
  timeoutPingMs: number
  configEm?: string
  importacao?: { id: string; arquivo: string; importadoEm: string } | null
  hosts: DvrHost[]
}

export interface ImportacaoDvr {
  id: string
  arquivo: string
  importadoEm: string
  importadoPor: string | null
  total: number
  online: number
  offline: number
  desconhecido: number
  naoCorrespondidos: string[]
  observadoEm: string | null
}

export async function obterDvr(): Promise<DvrSnapshot> {
  const { data } = await chamadosApi.get<DvrSnapshot>('/dvr')
  return data
}

export async function listarImportacoesDvr(limite = 30): Promise<ImportacaoDvr[]> {
  const { data } = await chamadosApi.get<ImportacaoDvr[]>('/dvr/importacoes', { params: { limite } })
  return data
}

export async function importarDvr(arquivo: string, conteudoBase64: string): Promise<ImportacaoDvr> {
  const { data } = await chamadosApi.post<ImportacaoDvr>('/dvr/importacoes', { arquivo, conteudoBase64 })
  return data
}
