<script setup lang="ts">
import { CheckCircle2, Info, X, XCircle } from '@lucide/vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
</script>

<template>
  <div class="toast-stack">
    <TransitionGroup name="toast">
      <div v-for="t in ui.toasts" :key="t.id" class="toast" :class="`toast-${t.kind}`">
        <CheckCircle2 v-if="t.kind === 'success'" :size="18" />
        <XCircle v-else-if="t.kind === 'error'" :size="18" />
        <Info v-else :size="18" />
        <span>{{ t.message }}</span>
        <button class="toast-close" type="button" @click="ui.dismiss(t.id)">
          <X :size="14" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 380px;
}

.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-primary);
}

.toast-success { border-left: 4px solid var(--green); }
.toast-success svg { color: var(--green); }
.toast-error { border-left: 4px solid var(--red); }
.toast-error svg { color: var(--red); }
.toast-info { border-left: 4px solid var(--blue); }
.toast-info svg { color: var(--blue); }

.toast-close {
  display: grid;
  place-items: center;
  color: var(--text-muted);
  padding: 2px;
  border-radius: 6px;
}

.toast-close:hover {
  background: var(--surface-muted);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(24px);
}
</style>
