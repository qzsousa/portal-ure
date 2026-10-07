import { monitorApi } from './http'

/**
 * Cliente do monitor de DVRs (câmeras de videovigilância das escolas).
 *
 * Diferente dos dois outros backends, este serviço NÃO está na nuvem: roda na
 * máquina da rede privada e faz o ping (ICMP) de verdade, coisa que o
 * navegador não pode fazer. O portal só consome o resultado já calculado.
 *
 * A autenticação é a mesma do portal — o serviço valida o access token com o
 * mesmo segredo do backend de chamados, sem senha nova.
 */

/** Estado de um DVR; `desconhecido` = primeira varredura ainda não chegou nele. */
export type DvrStatus = 'online' | 'offline' | 'desconhecido'

/** Rede do DVR: 'ADM' = administrativa da escola, 'PED' = pedagógica. */
export type DvrTipo = 'ADM' | 'PED'

export interface DvrHost {
  ip: string
  /** Nome do DVR conforme o manifesto (VIDEO-DVR1 / VIDEO-DVR2 / VIDEO-DVR3). */
  hostname: string
  tipo: DvrTipo
  /** Id da escola no manifesto. */
  faixa: string
  /** Nome completo da escola (já resolvido pelo serviço). */
  escola: string
  escolaId: string
  portas: number[]
  status: DvrStatus
  /** Como o online foi provado (`icmp`, `tcp:80`…) — ajuda a depurar. */
  metodo: string | null
  latenciaMs: number | null
  ttl: number | null
  verificadoEm: number | null
  onlineDesde: number | null
  offlineDesde: number | null
  /** Mudanças de estado — contar cai também, não só volta, é o que revela oscilação. */
  alternancias: number
  /** Últimos ciclos em string compacta "10110": 1=online, 0=offline, antigo→novo. */
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

export interface MonitorResumo {
  geradoEm?: number
  total: number
  online: number
  offline: number
  desconhecido: number
  /** DVRs que caíram no último ciclo (transição real, não "já estava offline"). */
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
}

/** Resposta de `/api/hosts`: o serviço devolve totais + lista num único payload. */
export interface MonitorSnapshot extends MonitorResumo {
  hosts: DvrHost[]
}

interface RespostaComErro {
  /** Presente quando o serviço corrupta com HTTP 200 mas com problema validável. */
  erro?: string
}

// O serviço não usa o envelope `{ success, data }` dos outros dois backends: ele
// devolve o objeto direto (`{ total, hosts, ... }`) e, em caso de problema com
// a configuração, `{ erro: "..." }` com HTTP 200/400. O service.valid aí
// explicando o que há, então a mensagem passa para a tela intata.
function erroDoMonitor(data: RespostaComErro): Error | null {
  return data.erro ? new Error(String(data.erro)) : null
}

/**
 * Totais + lista completa num único payload.
 *
 * O serviço devolve os dois juntos de propósito: a tela precisa do KPI e da
 * tabela no mesmo render. Pedir separado faria a tela mostrar "50 online" ao
 * lado de uma lista de outra varredura, que não bate.
 */
export async function obterMonitoramento(): Promise<MonitorSnapshot> {
  const { data } = await monitorApi.get<MonitorSnapshot | RespostaComErro>('/api/hosts')
  const erro = erroDoMonitor(data as RespostaComErro)
  if (erro) throw erro
  return data as MonitorSnapshot
}

/** Só os totais — payload pequeno para polling mais frequente se precisar. */
export async function obterResumoMonitoramento(): Promise<MonitorResumo> {
  const { data } = await monitorApi.get<MonitorResumo | RespostaComErro>('/api/resumo')
  const erro = erroDoMonitor(data as RespostaComErro)
  if (erro) throw erro
  return data as MonitorResumo
}

export interface MonitorHealth {
  ok: boolean
  servico: string
  ssoConfigurado: boolean
  monitorados: number
  escolas: number
  emAndamento: boolean
  ultimaVarreduraEm: number | null
  totalVarreduras: number
  uptimeSegundos: number
}

/**
 * Health check — rota pública, sem token.
 *
 * Separa "o serviço caiu" de "meu login expirou": causas diferentes com
 * consertos diferentes.
 */
export async function verificarHealthMonitor(): Promise<MonitorHealth> {
  const { data } = await monitorApi.get<MonitorHealth>('/health')
  return data
}

/**
 * Pede uma varredura imediata.
 *
 * Não espera terminar: o serviço responde 202 e varre em segundo plano, e o
 * fronte já está reconsultando o resumo a cada ciclo.
 */
export async function forcarVarredura(): Promise<void> {
  await monitorApi.post('/api/varredura')
}