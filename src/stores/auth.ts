import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import axios from 'axios'
import { CHAMADOS_BASE, chamadosApi, configureAuthHooks } from '@/api/http'
import type { ChangePasswordRequest, LoginRequest, LoginResponse, User } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const accessToken = ref<string | null>(null)
  const isLoading = ref(false)
  const isInitialized = ref(false)

  const isAuthenticated = computed(() => !!accessToken.value)
  const isAdmin = computed(() => user.value?.nivel === 'ADMIN')
  const mustChangePassword = computed(() => user.value?.primeiroLogin === true)

  function setTokens(newAccessToken: string, newRefreshToken: string) {
    accessToken.value = newAccessToken
    localStorage.setItem('accessToken', newAccessToken)
    if (newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken)
  }

  /** Chamado pelo interceptor de 401 dos dois clientes HTTP. */
  async function refreshTokens(): Promise<string | null> {
    const refreshToken = localStorage.getItem('refreshToken')
    if (!refreshToken) {
      clearSession()
      return null
    }
    const { data } = await axios.post<LoginResponse>(
      `${CHAMADOS_BASE}/auth/refresh`,
      { refreshToken },
      { withCredentials: true },
    )
    setTokens(data.accessToken, data.refreshToken)
    user.value = data.user
    return data.accessToken
  }

  function clearSession() {
    accessToken.value = null
    user.value = null
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
  }

  async function initialize() {
    if (isInitialized.value) return

    // Liga os clientes HTTP à store (sem dependência circular)
    configureAuthHooks({
      getToken: () => accessToken.value,
      refresh: refreshTokens,
      onUnauthorized: () => clearSession(),
    })

    const savedToken = localStorage.getItem('accessToken')
    if (savedToken) {
      accessToken.value = savedToken
      try {
        await fetchMe()
      } catch {
        clearSession()
      }
    }
    isInitialized.value = true
  }

  async function login(credentials: LoginRequest): Promise<LoginResponse> {
    isLoading.value = true
    try {
      const { data } = await chamadosApi.post<LoginResponse>('/auth/login', credentials)
      accessToken.value = data.accessToken
      user.value = data.user
      localStorage.setItem('accessToken', data.accessToken)
      localStorage.setItem('refreshToken', data.refreshToken)
      return data
    } finally {
      isLoading.value = false
    }
  }

  async function fetchMe() {
    if (!accessToken.value) throw new Error('Sem token')
    const { data } = await chamadosApi.get<User>('/auth/me')
    user.value = data
  }

  async function changePassword(payload: ChangePasswordRequest) {
    isLoading.value = true
    try {
      await chamadosApi.post('/auth/change-password', payload)
      clearSession()
    } finally {
      isLoading.value = false
    }
  }

  async function logout() {
    try {
      await chamadosApi.post('/auth/logout')
    } catch {
      // ignora falhas de rede no logout
    } finally {
      clearSession()
    }
  }

  return {
    user,
    accessToken,
    isLoading,
    isInitialized,
    isAuthenticated,
    isAdmin,
    mustChangePassword,
    initialize,
    login,
    fetchMe,
    changePassword,
    logout,
  }
})
