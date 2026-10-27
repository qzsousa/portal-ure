<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import ToastContainer from '@/components/ui/ToastContainer.vue'
import ChatWidget from '@/components/chat/ChatWidget.vue'
import { useAuthStore } from '@/stores/auth'
import { useContextoIA } from '@/composables/useContextoIA'

const auth = useAuthStore()
const router = useRouter()
const { carregar } = useContextoIA()

/**
 * A IA já entra com o contexto pronto: o resumo é caro (varre os dois
 * backends) e não vale esperar a pessoa chegar na tela de chat para começar.
 * Sem sessão, o backend responde 401 e o resumo fica vazio — aí não é erro,
 * é o visitante anônimo, e o chat carrega quando ele entrar.
 */
onMounted(() => {
  if (localStorage.getItem('portal_token') || document.cookie.includes('refresh')) void carregar()

  const agora = new Date()
  const inicio = new Date(agora)
  inicio.setHours(17, 0, 0, 0)
  const fim = new Date(agora)
  fim.setHours(20, 0, 0, 0)
  const ms = inicio.getTime() - agora.getTime()
  if (ms > 0) {
    setTimeout(() => {
      const n = new Date()
      if (n >= inicio && n <= fim) router.push({ name: 'manutencao-sistema' })
    }, ms)
  }
})
</script>

<template>
  <div class="maintenance-banner">AVISO: o portal estará em manutenção das 17:00 às 20:00.</div>
  <RouterView />
  <ToastContainer />
  <ChatWidget v-if="auth.isAuthenticated && auth.user?.nivel !== 'TECNICO'" />
</template>

<style>
.maintenance-banner {
  position: sticky;
  top: 0;
  z-index: 1000;
  background: #d32f2f;
  color: #fff;
  padding: 14px 16px;
  text-align: center;
  font-size: 1rem;
  font-weight: 700;
  border-bottom: 2px solid #b71c1c;
}
</style>
