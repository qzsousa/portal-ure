import { chamadosApi } from './http'

/** Painel de unidades escolares (somente matriz): todas as unidades individuais. */
export interface UnidadePainel {
  /** Nome canônico individual, ex.: "E.E. LEILA DINIZ" */
  nome: string
  /** Nome oficial do grupo (composto "E.E. A / B" para escolas irmãs; ela mesma quando sozinha) */
  grupo: string
  /** Nome da escola irmã, quando o grupo tem duas unidades */
  irma: string | null
  tecnico: string
  /** CONCLUIDO | EM_ANDAMENTO | NAO_REALIZADO | NAO_INFORMADO (do grupo) */
  inventarioStatus: string
  usuariosAtivos: number
  chamadosTotal: number
  chamadosAbertos: number
}

export async function listarPainelUnidades(): Promise<UnidadePainel[]> {
  const { data } = await chamadosApi.get<UnidadePainel[]>('/escolas/painel')
  return data
}

export const ROTULO_INVENTARIO: Record<string, string> = {
  CONCLUIDO: 'Concluído',
  EM_ANDAMENTO: 'Em andamento',
  NAO_REALIZADO: 'Não realizado',
  NAO_INFORMADO: 'Não informado',
}
