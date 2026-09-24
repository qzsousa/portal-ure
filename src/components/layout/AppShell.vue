<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Eye, X } from '@lucide/vue'
import AppSidebar from './AppSidebar.vue'
import AppTopbar from './AppTopbar.vue'
import { useSidebar } from '@/composables/useSidebar'
import { useAuthStore } from '@/stores/auth'
import { rotuloPerfil } from '@/types'

const route = useRoute()
const auth = useAuthStore()
const { fechar, liberarScroll } = useSidebar()

const ROTULO_SIMULADO: Record<string, string> = { TECNICO: 'Técnico' }

function rotuloSimulacao(): string {
  return ROTULO_SIMULADO[auth.nivelSimulado || ''] || rotuloPerfil(auth.nivelSimulado)
}

watch(
  () => route.fullPath,
  () => fechar(),
)

onUnmounted(liberarScroll)
</script>

<template>
  <div class="shell">
    <AppSidebar />
    <div class="content">
      <div v-if="auth.simulando" class="sim-banner" role="status">
        <Eye :size="15" />
        <span>
          Simulando perfil <strong>{{ rotuloSimulacao() }}</strong> — apenas a interface muda;
          suas credenciais continuam as mesmas.
        </span>
        <button type="button" class="sim-sair" @click="auth.pararSimulacao()">
          <X :size="14" />
          Encerrar simulação
        </button>
      </div>
      <AppTopbar />
      <main class="page">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  min-height: 100vh;
}

.content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

/* Banner fixo de simulação de perfil (Configurações → Testes de acesso) */
.sim-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 28px;
  background: var(--yellow-soft, #fef3c7);
  border-bottom: 1px solid var(--yellow, #f59e0b);
  color: #7c4a03;
  font-size: 12.5px;
}

.sim-banner span {
  flex: 1;
  min-width: 0;
}

.sim-sair {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid currentColor;
  background: transparent;
  color: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.sim-sair:hover {
  background: rgb(0 0 0 / 0.06);
}

.page {
  flex: 1;
  padding: 24px 28px 40px;
}

@media (max-width: 640px) {
  .sim-banner {
    flex-wrap: wrap;
    padding: 8px 16px;
  }
}

@media (max-width: 900px) {
  .page {
    padding: 16px 14px 32px;
  }
}
</style>
