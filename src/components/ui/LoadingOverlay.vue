<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useLoadingStore } from '@/stores/loading'
import { Loader2 } from '@lucide/vue'

const loading = useLoadingStore()
const mostrar = ref(false)
let timer: number | null = null

watch(
  () => loading.visivel,
  (valor) => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    if (valor) {
      timer = window.setTimeout(() => {
        mostrar.value = true
      }, 200)
    } else {
      mostrar.value = false
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (timer !== null) clearTimeout(timer)
})
</script>

<template>
  <Transition name="loading-fade">
    <div v-if="mostrar" class="loading-overlay" role="status" aria-live="polite" aria-label="Carregando">
      <div class="loading-card">
        <Loader2 class="loading-spinner" :size="36" />
        <span class="loading-text">Carregando…</span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.loading-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
  display: grid;
  place-items: center;
  background: rgb(15 23 42 / 0.28);
  backdrop-filter: blur(2px);
}

.loading-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px 32px;
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.loading-spinner {
  color: var(--blue);
  animation: loading-spin 0.8s linear infinite;
}

.loading-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
}

@keyframes loading-spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-fade-enter-active,
.loading-fade-leave-active {
  transition: opacity 0.15s ease;
}

.loading-fade-enter-from,
.loading-fade-leave-to {
  opacity: 0;
}
</style>
