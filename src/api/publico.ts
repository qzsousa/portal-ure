import axios from 'axios'
import { CHAMADOS_BASE } from './http'
import type { Chamado } from '@/types'

/**
 * Endpoints PÚBLICOS do backend de chamados (sem autenticação).
 *
 * Usa axios puro — NÃO passa por `chamadosApi` (que anexa token e
 * intercepta 401). As rotas abaixo são montadas como públicas no
 * backend (ver backend/src/index.ts).
 */

const publicoHttp = axios.create({
  baseURL: CHAMADOS_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

/* ---------- Abertura de chamado ---------- */

export interface NovoChamadoPayload {
  unidade: string
  solicitante: string
  funcao?: string
  tipo: string
  descricao: string
  urgencia: string
  email?: string
  anexoBase64?: string
  anexoNome?: string
  anexoTipo?: string
}

export async function listarEscolasPublico(): Promise<string[]> {
  const { data } = await publicoHttp.get<string[]>('/escolas/nomes')
  return data
}

export async function listarCategoriasEquipamento(): Promise<string[]> {
  const { data } = await publicoHttp.get<string[]>('/equipamentos/categorias')
  return data
}

export async function listarMarcasEquipamento(categoria: string): Promise<string[]> {
  const { data } = await publicoHttp.get<string[]>('/equipamentos/marcas', { params: { categoria } })
  return data
}

export async function listarModelosEquipamento(categoria: string, marca: string): Promise<string[]> {
  const { data } = await publicoHttp.get<string[]>('/equipamentos/modelos', { params: { categoria, marca } })
  return data
}

/** Cria um chamado (público). Retorna o chamado completo (201), com `protocolo`. */
export async function criarChamadoPublico(payload: NovoChamadoPayload): Promise<Chamado> {
  const { data } = await publicoHttp.post<Chamado>('/chamados', payload)
  return data
}

/* ---------- Consulta por protocolo ---------- */

export interface ChamadoPublico {
  protocolo: string
  unidade: string
  solicitante: string
  tipo: string
  status: string
  descricao: string
  descricaoResolucao: string | null
  anexoUrl: string | null
  timestamp: string
  ultimaAtualizacao: string
}

/** Consulta pública por protocolo. Lança AxiosError com status 404 se não existir. */
export async function consultarChamadoPorProtocolo(protocolo: string): Promise<ChamadoPublico> {
  const { data } = await publicoHttp.get<ChamadoPublico>(`/chamados/protocolo/${encodeURIComponent(protocolo)}`)
  return data
}

/* ---------- Dashboard público (matriz) ---------- */

export interface MatrizKpis {
  total: number
  abertos: number
  andamento: number
  comunicado: number
  resolvidos: number
  altaPrioridade: number
}

export interface DashboardMatriz {
  kpis: MatrizKpis
  chamados: Chamado[]
  graficos: {
    porStatus: Record<string, number>
    porUrgencia: Record<string, number>
    resolvidosPorTecnico: Record<string, number>
  }
}

export async function getDashboardMatriz(): Promise<DashboardMatriz> {
  const { data } = await publicoHttp.get<DashboardMatriz>('/dashboard/matriz')
  return data
}
