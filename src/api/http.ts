import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import { useErrorLogStore } from '@/stores/errorLog'

/**
 * Clientes HTTP do portal.
 *
 * - `chamadosApi`: backend de chamados — também é o PROVEDOR DE IDENTIDADE
 *   do portal (login/refresh/logout). Intercepta 401 e faz refresh
 *   automático com fila (mesma estratégia do frontend original).
 * - `sceApi`: backend do SCE (equipamentos). Envia o MESMO access token
 *   JWT do chamados — o SCE o valida via SSO (SSO_SECRET compartilhado).
 * - `monitorApi`: serviço de monitoramento de rede, que NÃO está na nuvem —
 *   roda na máquina dentro da rede privada (o navegador não envia ICMP).
 *   Valida o mesmo token, então também usa o SSO.
 */

export const CHAMADOS_BASE = import.meta.env.VITE_API_CHAMADOS_URL || 'http://localhost:10000/api'
export const SCE_BASE = import.meta.env.VITE_API_SCE_URL || 'http://localhost:3000/api'

/**
 * Base do serviço de monitoramento, SEM o sufixo `/api`.
 *
 * Ao contrário dos outros dois, aqui a base é a RAIZ: as rotas já são
 * `/api/hosts`, `/api/resumo` etc. Aceitar a variável com ou sem `/api` evita
 * que alguém configure um `.../api` e a tela passe a pedir `/api/api/hosts` —
 * um 404 que só aparece em produção, com a URL escrita à mão.
 */
const MONITOR_BASE_RAW = import.meta.env.VITE_API_MONITOR_URL || 'http://localhost:4000'
export const MONITOR_BASE = MONITOR_BASE_RAW.replace(/\/+$/, '').replace(/\/api$/, '')

type TokenProvider = () => string | null
type RefreshHandler = () => Promise<string | null>
type UnauthorizedHandler = () => void

let getToken: TokenProvider = () => null
let doRefresh: RefreshHandler = async () => null
let onUnauthorized: UnauthorizedHandler = () => {}

/** Registrado pela auth store na inicialização (evita dependência circular). */
export function configureAuthHooks(hooks: {
  getToken: TokenProvider
  refresh: RefreshHandler
  onUnauthorized: UnauthorizedHandler
}) {
  getToken = hooks.getToken
  doRefresh = hooks.refresh
  onUnauthorized = hooks.onUnauthorized
}

function attachAuthHeader(config: InternalAxiosRequestConfig) {
  const token = getToken()
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}

let isRefreshing = false
let failedQueue: Array<{ resolve: (t: string) => void; reject: (e: Error) => void }> = []

function processQueue(token: string | null, error: Error | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token!)
  })
  failedQueue = []
}

/**
 * `aoExpirar` permite que um cliente NÃO derrube a sessão do portal.
 *
 * Padrão é o `onUnauthorized` global — o comportamento certo para o backends do
 * portal. O serviço de monitoramento passa um no-op, porque lá um 401 costuma
 * ser configuração (segredo divergente), não sessão expirada, e expulsar o
 * usuário por causa disso seria trocar um aviso por um problema maior.
 */
function createRefreshInterceptor(client: AxiosInstance, aoExpirar: UnauthorizedHandler = onUnauthorized) {
  return async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined

    if (!originalRequest || originalRequest.url === '/auth/refresh' || originalRequest.url === '/auth/login') {
      return Promise.reject(error)
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return client(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const newToken = await doRefresh()
        if (!newToken) throw error
        processQueue(newToken, null)
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return client(originalRequest)
      } catch (err) {
        processQueue(null, err as Error)
        const status = (err as AxiosError).response?.status
        if (status === 401 || status === 403) aoExpirar()
        return Promise.reject(err)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
}

/**
 * Erros já registrados — evita contagem dupla quando a mesma falha atravessa
 * o interceptor mais de uma vez (ex.: request refeita após o refresh de token).
 */
const errosRegistrados = new WeakSet<AxiosError>()

function extrairMensagemErro(error: AxiosError): string {
  const data = error.response?.data as { message?: string; error?: string } | undefined
  return data?.message || data?.error || error.message || 'Erro desconhecido'
}

/**
 * Registra erros de BACKEND (HTTP 5xx ou ausência de resposta) na store
 * `errorLog` — que dispara um toast e exibe o erro na aba Logs das
 * Configurações. Deve ser registrado DEPOIS do interceptor de refresh,
 * para enxergar apenas a falha final da requisição.
 */
export function createBackendErrorInterceptor(backend: string) {
  return (error: AxiosError) => {
    const status = error.response?.status ?? null
    const ehErroDeBackend = status === null || status >= 500
    if (ehErroDeBackend && !errosRegistrados.has(error)) {
      errosRegistrados.add(error)
      useErrorLogStore().registrar({
        backend,
        metodo: (error.config?.method || 'GET').toUpperCase(),
        rota: error.config?.url || '(rota desconhecida)',
        status,
        mensagem: extrairMensagemErro(error),
      })
    }
    return Promise.reject(error)
  }
}

export const chamadosApi = axios.create({
  baseURL: CHAMADOS_BASE,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

export const sceApi = axios.create({
  baseURL: SCE_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

export const monitorApi = axios.create({
  baseURL: MONITOR_BASE,
  headers: { 'Content-Type': 'application/json' },
  // Menor que os outros: a tela consulta a cada 30 s e o serviço responde
  // lendo um cache, não varrendo. Estourar 30 s segurando a conexão só
  // acumularia requisições do ciclo seguinte atrás de uma que não volta.
  timeout: 15000,
})

chamadosApi.interceptors.request.use(attachAuthHeader)
chamadosApi.interceptors.response.use((r) => r, createRefreshInterceptor(chamadosApi))
chamadosApi.interceptors.response.use((r) => r, createBackendErrorInterceptor('Chamados'))

sceApi.interceptors.request.use(attachAuthHeader)
sceApi.interceptors.response.use((r) => r, createRefreshInterceptor(sceApi))
sceApi.interceptors.response.use((r) => r, createBackendErrorInterceptor('SCE'))

monitorApi.interceptors.request.use(attachAuthHeader)
/*
 * `onUnauthorized: () => {}` — de propósito, e é a diferença mais importante
 * deste bloco.
 *
 * Um 401 aqui quase nunca é sessão expirada: a causa comum é o `SSO_SECRET` do
 * serviço de monitoramento estar diferente do backend de chamados, o que faz
 * TODO token ser recusado. Se este cliente chamasse o `onUnauthorized` do
 * portal, o usuário seria despejado da sessão por um problema de
 * configuração de infraestrutura — e perderia o acesso a tudo por causa de uma
 * aba. Aqui o 401 vira um erro de tela, que é o que a tela sabe explicar.
 */
monitorApi.interceptors.response.use(
  (r) => r,
  createRefreshInterceptor(monitorApi, () => {}),
)
monitorApi.interceptors.response.use((r) => r, createBackendErrorInterceptor('Monitor'))
