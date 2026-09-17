import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'

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

type TokenProvider = () => string | null
type RefreshHandler = () => Promise<string | null>
type UnauthorizedHandler = () => void

let getToken: TokenProvider = () => localStorage.getItem('accessToken')
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

chamadosApi.interceptors.request.use(attachAuthHeader)
chamadosApi.interceptors.response.use((r) => r, createRefreshInterceptor(chamadosApi))

sceApi.interceptors.request.use(attachAuthHeader)
sceApi.interceptors.response.use((r) => r, createRefreshInterceptor(sceApi))
