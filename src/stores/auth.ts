import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import axios from 'axios'
import { CHAMADOS_BASE, chamadosApi, configureAuthHooks } from '@/api/http'
import type { ChangePasswordRequest, LoginRequest, LoginResponse, Nivel, User } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const accessToken = ref<string | null>(null)
  const isLoading = ref(false)
  const isInitialized = ref(false)

  const isAuthenticated = computed(() => !!accessToken.value)
  const isAdmin = computed(() => user.value?.nivel === 'ADMIN')
  const mustChangePassword = computed(() => user.value?.primeiroLogin === true)

  /**
   * Escola FILHA (irmã que divide o prédio com a MÃE): o painel de equipamentos
   * é compartilhado, mas ela só visualiza — não cadastra, não edita e não
   * remove. O SCE aplica a mesma regra na API (usuarios.papel_unidade).
   */
  const somenteLeituraEquipamentos = computed(() => user.value?.papelUnidade === 'FILHA')

  /*
   * Simulação de perfil (abas Configurações → Testes de acesso).
   * Troca APENAS o `user.nivel` na memória: menus, guards de rota e botões
   * reagem como se o usuário fosse do perfil escolhido. O token JWT e a
   * sessão continuam os mesmos (o backend segue autorizando pelo perfil
   * real) e a simulação some ao recarregar a página.
   */
  const simulacao = ref<Nivel | null>(null)
  const nivelOriginal = ref<Nivel | null>(null)
  const simulando = computed(() => simulacao.value !== null)
  const nivelSimulado = computed(() => simulacao.value)

  function simularComo(nivel: Nivel) {
    if (!user.value) return
    if (nivelOriginal.value === null) nivelOriginal.value = user.value.nivel
    simulacao.value = nivel
    // A simulação troca o perfil, mas a escola (MÃE/FILHA) é real: uma FILHA
    // continua somente leitura mesmo "simulando" um perfil com mais poder.
    user.value = { ...user.value, nivel }
  }

  function pararSimulacao() {
    if (user.value && nivelOriginal.value !== null) {
      user.value = { ...user.value, nivel: nivelOriginal.value }
    }
    simulacao.value = null
    nivelOriginal.value = null
  }

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
    // Mantém a simulação ativa mesmo após o refresh (nível real se atualiza junto)
    if (simulacao.value) nivelOriginal.value = data.user.nivel
    user.value = simulacao.value ? { ...data.user, nivel: simulacao.value } : data.user
    return data.accessToken
  }

  function clearSession() {
    accessToken.value = null
    user.value = null
    simulacao.value = null
    nivelOriginal.value = null
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
    somenteLeituraEquipamentos,
    simulando,
    nivelSimulado,
    simularComo,
    pararSimulacao,
    initialize,
    login,
    fetchMe,
    changePassword,
    logout,
  }
})
