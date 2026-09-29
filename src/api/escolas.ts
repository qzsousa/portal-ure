import { chamadosApi } from './http'

/**
 * Painel de unidades escolares (somente matriz): UMA LINHA POR PRÉDIO.
 *
 * Escolas que dividem o mesmo prédio (mãe/filha) são uma única linha — o
 * equipamento é compartilhado por grupo, então emitir as duas faria o mesmo
 * parque ser contado duas vezes. A irmã vem em `irma` para a tela mostrar
 * "divide o prédio com ..." abaixo da mãe.
 */
export interface UnidadePainel {
  /** Nome canônico da linha: a escola MÃE do prédio, ex.: "E.E. CESAR DONATO CALABREZ" */
  nome: string
  /** Nome oficial do grupo (composto "E.E. A / B" para escolas irmãs; ela mesma quando sozinha) */
  grupo: string
  /** Nome da escola irmã, quando o prédio é compartilhado */
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
