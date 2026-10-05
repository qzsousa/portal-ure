import { monitorApi } from './http'

/**
 * Cliente do monitor de rede.
 *
 * Diferente dos outros dois backends, este serviço NÃO está na nuvem: roda na
 * máquina da rede privada e faz o ping (ICMP) de verdade, coisa que o
 * navegador não pode fazer. O portal só consome o resultado.
 *
 * A autenticação é a mesma do portal — o serviço valida o access token com o
 * mesmo segredo do backend de chamados, então quem já está logado entra
 * sem senha nova.
 */

/** Estado de um endereço. `desconhecido` = ainda não passou pela primeira varredura. */
export type MonitorStatus = 'online' | 'offline' | 'desconhecido'

export interface MonitorHost {
  ip: string
  /** Id do grupo (faixa) ao qual o endereço pertence. */
  faixa: string
  /** Rótulo do grupo, já resolvido pelo serviço. */
  rotulo: string
  /** Portas TCP sondadas quando o ICMP não responde. */
  portas: number[]
  status: MonitorStatus
  /** Como o "online" foi provado: `icmp`, `tcp:445`… Serve para depurar. */
  metodo: string | null
  latenciaMs: number | null
  ttl: number | null
  /** Epoch (ms) da última verificação. */
  verificadoEm: number | null
  onlineDesde: number | null
  offlineDesde: number | null
  /** Quantas vezes o endereço mudou de estado (cabeça de rede instável). */
  alternancias: number
  /** Últimos ciclos em "10110" — 1 = online, 0 = offline, do mais antigo ao mais novo. */
  historico: string
}

export interface MonitorFaixa {
  id: string
  rotulo: string
  descricao?: string
  total: number
  online: number
  offline: number
  desconhecido: number
}

export interface MonitorResumo {
  geradoEm?: number
  total: number
  online: number
  offline: number
  desconhecido: number
  /** Endereços que caíram no último ciclo (transição real, não "já estava offline"). */
  caidosAgora: number
  /** Percentual sobre os que já responderam alguma vez (desconhecidos ficam fora). */
  percentualOnline: number
  latenciaMediaMs: number | null
  latenciaMaximaMs: number | null
  porFaixa: MonitorFaixa[]
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

export interface MonitorSnapshot extends MonitorResumo {
  hosts: MonitorHost[]
}

interface MonitorResponse<T> {
  erro?: string
  data?: T
}

function erroDoMonitor(data: MonitorResponse<unknown>): Error | null {
  // O serviço responde 503/401 com `erro` e status ≠ 2xx: o axios já rejeita
  // nesses casos, e o corpo não chega. Para 200 com `erro`, é a validação de
  // configuração — e essa mensagem é a dica mais útil que o serviço dá.
  return data.erro ? new Error(data.erro) : null
}

/**
 * Totais + a lista de endereços, num único payload.
 *
 * O serviço já devolve os dois juntos de propósito: a tela precisa dos KPIs e
 * da tabela no mesmo render, e separá-los obrigaria a tela a exibir números de
 * uma varredura com endereços de outra — o painel piscaria "50 online" ao lado
 * de uma lista que não bate.
 */
export async function obterMonitoramento(): Promise<MonitorSnapshot> {
  const { data } = await monitorApi.get<MonitorResponse<MonitorSnapshot>>('/api/hosts')
  const erro = erroDoMonitor(data)
  if (erro) throw erro
  return data.data as MonitorSnapshot
}

/** Só os totais — payload pequeno para polling frequente. */
export async function obterResumoMonitoramento(): Promise<MonitorResumo> {
  const { data } = await monitorApi.get<MonitorResponse<MonitorResumo>>('/api/resumo')
  const erro = erroDoMonitor(data)
  if (erro) throw erro
  return data.data as MonitorResumo
}

export interface HealthMonitor {
  ok: boolean
  servico: string
  ssoConfigurado: boolean
  emAndamento: boolean
  monitorados: number
  ultimaVarreduraEm: number | null
  totalVarreduras: number
  uptimeSegundos: number
}

/**
 * Health check — rota pública, sem token.
 *
 * Existe para a tela distinguir "o serviço caiu" de "meu login expirou": são
 * Causes diferentes com consertos diferentes (o primeiro é infraestrutura, o
 * segundo é só entrar de novo).
 */
export async function verificarHealthMonitor(): Promise<HealthMonitor> {
  const { data } = await monitorApi.get<HealthMonitor>('/health')
  return data
}

/**
 * Pede uma varredura imediata.
 *
 * Não espera terminar: o serviço responde 202 e varre em segundo plano, porque
 * segurar a requisição por 30 s travaria a tela sem trazer dado mais novo — o
 * polling já está bringing o resultado.
 */
export async function forcarVarredura(): Promise<void> {
  await monitorApi.post('/api/varredura')
}