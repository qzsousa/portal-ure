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
 */

export const CHAMADOS_BASE = import.meta.env.VITE_API_CHAMADOS_URL || 'http://localhost:10000/api'
export const SCE_BASE = import.meta.env.VITE_API_SCE_URL || 'http://localhost:3000/api'
export const MONITOR_BASE = import.meta.env.VITE_API_MONITOR_URL || 'http://localhost:4000'

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

function createRefreshInterceptor(client: AxiosInstance) {
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
        if (status === 401 || status === 403) onUnauthorized()
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

/**
 * Timeout maior que o dos outros clientes de propósito: o monitor responde
 * pela rede da escola e pelo túnel Cloudflare. Um túnel lento e um timeout de
 * 30 s cortaria a carga inicial do painel, e o sintoma seria "não carrega"
 * sem motivo aparente.
 */
export const monitorApi = axios.create({
  baseURL: MONITOR_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000,
})

chamadosApi.interceptors.request.use(attachAuthHeader)
chamadosApi.interceptors.response.use((r) => r, createRefreshInterceptor(chamadosApi))
chamadosApi.interceptors.response.use((r) => r, createBackendErrorInterceptor('Chamados'))

sceApi.interceptors.request.use(attachAuthHeader)
sceApi.interceptors.response.use((r) => r, createRefreshInterceptor(sceApi))
sceApi.interceptors.response.use((r) => r, createBackendErrorInterceptor('SCE'))

monitorApi.interceptors.request.use(attachAuthHeader)
monitorApi.interceptors.response.use((r) => r, createRefreshInterceptor(monitorApi))
monitorApi.interceptors.response.use((r) => r, createBackendErrorInterceptor('Monitor DVR'))
