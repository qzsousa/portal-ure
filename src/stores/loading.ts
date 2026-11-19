import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

/**
 * Estado de carregamento global do portal.
 *
 * - `contador`: número de requisições HTTP em voo (exceto as marcadas como
 *   silenciosas).
 * - `navegando`: true enquanto o router troca de rota (inclui a carga inicial
 *   da sessão).
 * - `silentDepth`: profundidade do modo silencioso (auto-refresh). Enquanto > 0,
 *   novas requisições não incrementam o contador.
 */
export const useLoadingStore = defineStore('loading', () => {
  const contador = ref(0)
  const navegando = ref(false)
  const silentDepth = ref(0)

  const silencioso = computed(() => silentDepth.value > 0)
  const visivel = computed(() => contador.value > 0 || navegando.value)

  function iniciar() {
    contador.value++
  }

  function finalizar() {
    if (contador.value > 0) contador.value--
  }

  function setNavegando(valor: boolean) {
    navegando.value = valor
  }

  function entrarSilencioso() {
    silentDepth.value++
  }

  function sairSilencioso() {
    if (silentDepth.value > 0) silentDepth.value--
  }

  return {
    contador,
    navegando,
    silentDepth,
    silencioso,
    visivel,
    iniciar,
    finalizar,
    setNavegando,
    entrarSilencioso,
    sairSilencioso,
  }
})
