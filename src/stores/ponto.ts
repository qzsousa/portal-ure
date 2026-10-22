import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { statusPontoHoje } from '@/api/ponto'
import type { PontoHojeResponse } from '@/types'

export const usePontoStore = defineStore('ponto', () => {
  const hoje = ref<PontoHojeResponse | null>(null)
  const carregado = ref(false)
  const carregando = ref(false)

  async function carregar() {
    if (carregando.value) return
    carregando.value = true
    try {
      hoje.value = await statusPontoHoje()
      carregado.value = true
    } finally {
      carregando.value = false
    }
  }

  function invalidar() {
    hoje.value = null
    carregado.value = false
  }

  const liberado = computed(() => hoje.value?.status === 'BATIDO' || hoje.value?.status === 'FERIAS')
  const status = computed(() => hoje.value?.status ?? 'NAO_BATIDO')


  return { hoje, carregado, carregando, carregar, invalidar, liberado, status }
})
