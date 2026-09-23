<script setup lang="ts">
import { X } from '@lucide/vue'

defineProps<{ titulo: string; aberto: boolean }>()
const emit = defineEmits<{ (e: 'fechar'): void }>()
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="aberto" class="modal-backdrop" @click.self="emit('fechar')">
        <div class="modal">
          <header class="modal-header">
            <h3>{{ titulo }}</h3>
            <button class="modal-close" type="button" @click="emit('fechar')">
              <X :size="18" />
            </button>
          </header>
          <div class="modal-body">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgb(8 26 51 / 0.55);
  display: grid;
  place-items: center;
  z-index: 200;
  padding: 20px;
}

@media (max-width: 640px) {
  .modal-backdrop {
    padding: 10px;
  }
}

.modal {
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 640px;
  max-height: 86vh;
  max-height: 86dvh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border);
}

.modal-header h3 {
  font-size: 16px;
}

.modal-close {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  color: var(--text-muted);
}

.modal-close:hover {
  background: var(--surface-muted);
}

.modal-body {
  padding: 20px 22px;
  overflow-y: auto;
}

.modal-footer {
  padding: 14px 22px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.15s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
