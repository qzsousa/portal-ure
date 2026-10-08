import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import axios from 'axios'
import { CHAMADOS_BASE, chamadosApi, configureAuthHooks } from '@/api/http'
import {
  confirmarCodigo,
  definirSenhaPrimeiroAcesso,
  verificarEmail as verificarEmailRequest,
} from '@/api/primeiroAcesso'
import type {
  ChangePasswordRequest,
  ConfirmarCodigoResponse,
  DefinirSenhaPrimeiroAcessoRequest,
  LoginRequest,
  LoginResponse,
  Nivel,
  User,
  VerificarEmailResponse,
} from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  /**
   * Access token — SOMENTE EM MEMÓRIA.
   *
   * Ficava no `localStorage`, que é legível por qualquer script da página:
   * uma única dependência comprometida (ou um XSS) dava acesso à sessão.
   * O refresh token de 7 dias não é guardado aqui — viaja num cookie
   * `httpOnly` que o JavaScript não consegue ler.
   *
   * Efeito colateral: ao recarregar a página o access token se perde, e a
   * sessão é reconstruída chamando `/auth/refresh` com o cookie.
   */
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
   *
   * Troca APENAS o `user.nivel` na memória: menus, guards de rota e botões
   * reagem como se o usuário fosse do perfil escolhido. O token JWT e a
   * sessão continuam os mesmos (o backend segue autorizando pelo perfil
   * real) e a simulação some ao recarregar a página.
   *
   * Bloqueada fora de desenvolvimento: em produção ela levava o usuário a
   * acreditar que a troca de perfil era uma função real de autorização, e
   * escondia bugs — o menu sumia para o perfil errado sem o servidor
   * recusar nada.
   */
  const simulacaoAtivavel = import.meta.env.DEV
  const simulacao = ref<Nivel | null>(null)
  const nivelOriginal = ref<Nivel | null>(null)
  const simulando = computed(() => simulacao.value !== null)
  const nivelSimulado = computed(() => simulacao.value)

  function simularComo(nivel: Nivel) {
    if (!user.value || !simulacaoAtivavel) return
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

  function setAccessToken(novo: string | null) {
    accessToken.value = novo
  }

  /**
   * Renova o access token.
   *
   * O refresh token NÃO é lido nem enviado: o navegador anexa o cookie
   * `httpOnly` sozinho, e o corpo fica vazio. É chamado pelo interceptor de
   * 401 e também na inicialização, para reconstruir a sessão após um
   * recarregamento da página.
   */
  async function refreshTokens(): Promise<string | null> {
    try {
      const { data } = await axios.post<LoginResponse>(
        `${CHAMADOS_BASE}/auth/refresh`,
        {},
        { withCredentials: true },
      )
      setAccessToken(data.accessToken)
      // Mantém a simulação ativa mesmo após o refresh (nível real se atualiza junto)
      if (simulacao.value) nivelOriginal.value = data.user.nivel
      user.value = simulacao.value ? { ...data.user, nivel: simulacao.value } : data.user
      return data.accessToken
    } catch {
      clearSession()
      return null
    }
  }

  function clearSession() {
    accessToken.value = null
    user.value = null
    simulacao.value = null
    nivelOriginal.value = null
  }

  async function initialize() {
    if (isInitialized.value) return

    // Liga os clientes HTTP à store (sem dependência circular)
    configureAuthHooks({
      getToken: () => accessToken.value,
      refresh: refreshTokens,
      onUnauthorized: () => clearSession(),
    })

    // Não há token em storage para recuperar: quem reconstrói a sessão é o
    // cookie httpOnly, via /auth/refresh. Se não houver cookie, o 401 é
    // esperado e o usuário segue deslogado.
    const renovou = await refreshTokens()
    if (renovou) {
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
      setAccessToken(data.accessToken)
      user.value = data.user
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

  /* ------------------------------------------------------------------
   * Primeiro acesso: código do ADMIN → criação da senha
   * ------------------------------------------------------------------ */

  /**
   * Consulta o que a tela precisa saber sobre um e-mail.
   *
   * `null` é devolvido quando a consulta falha (rede, rate limit) — a tela
   * trata como "não deu para verificar" e segue para a etapa de senha, em vez
   * de trancar a pessoa por causa de uma falha de rede.
   */
  async function verificarEmail(email: string): Promise<VerificarEmailResponse | null> {
    try {
      return await verificarEmailRequest(email)
    } catch {
      return null
    }
  }

  async function confirmarCodigoPrimeiroAcesso(
    email: string,
    codigo: string,
  ): Promise<ConfirmarCodigoResponse> {
    isLoading.value = true
    try {
      return await confirmarCodigo(email, codigo)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Cria a senha e assume a sessão.
   *
   * Mesmo caminho do `login()`: o access token fica em memória e o refresh
   * viaja num cookie httpOnly, então a pessoa entra direto no painel.
   */
  async function criarSenhaPrimeiroAcesso(
    payload: DefinirSenhaPrimeiroAcessoRequest,
  ): Promise<LoginResponse> {
    isLoading.value = true
    try {
      const data = await definirSenhaPrimeiroAcesso(payload)
      setAccessToken(data.accessToken)
      user.value = data.user
      return data
    } finally {
      isLoading.value = false
    }
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
      // Revoga a sessão no servidor (o cookie httpOnly é limpo na resposta).
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
    simulacaoAtivavel,
    simulando,
    nivelSimulado,
    simularComo,
    pararSimulacao,
    initialize,
    login,
    fetchMe,
    changePassword,
    logout,
    verificarEmail,
    confirmarCodigoPrimeiroAcesso,
    criarSenhaPrimeiroAcesso,
  }
})
