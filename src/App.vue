<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import ToastContainer from '@/components/ui/ToastContainer.vue'
import ChatWidget from '@/components/chat/ChatWidget.vue'
import { useAuthStore } from '@/stores/auth'
import { useContextoIA } from '@/composables/useContextoIA'

const auth = useAuthStore()
const { carregar } = useContextoIA()

/**
 * A IA já entra com o contexto pronto: o resumo é caro (varre os dois
 * backends) e não vale esperar a pessoa chegar na tela de chat para começar.
 * Sem sessão, o backend responde 401 e o resumo fica vazio — aí não é erro,
 * é o visitante anônimo, e o chat carrega quando ele entrar.
 */
onMounted(() => {
  if (localStorage.getItem('portal_token') || document.cookie.includes('refresh')) void carregar()
})
</script>

<template>
  <RouterView />
  <ToastContainer />
  <ChatWidget v-if="auth.isAuthenticated && auth.user?.nivel !== 'TECNICO'" />
</template>
