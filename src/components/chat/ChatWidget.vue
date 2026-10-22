<template>
  <div class="chat-widget">
    <Transition name="cw-panel">
      <div v-if="open" class="chat-panel">
        <button class="chat-close" @click="open = false" aria-label="Fechar chat">
          <X :size="16" />
        </button>
        <ChatIaView compact />
      </div>
    </Transition>

    <button class="chat-fab" @click="toggle" :class="{ open }" aria-label="Abrir chat CaféIA">
      <Transition name="cw-icon" mode="out-in">
        <X v-if="open" :size="22" key="close" />
        <MessageSquare v-else :size="22" key="open" />
      </Transition>
      <span v-if="!open" class="chat-fab-pulse" aria-hidden="true"></span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue'
import { MessageSquare, X } from '@lucide/vue'
const ChatIaView = defineAsyncComponent(() => import('@/views/ChatIaView.vue'))

const open = ref(false)
function toggle() {
  open.value = !open.value
}
</script>

<style scoped>
.chat-widget {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1000;
  font-family: var(--font-sans);
}

.chat-fab {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: linear-gradient(140deg, #c98a5e, #54341f);
  color: #fbf3ec;
  box-shadow: 0 18px 36px -16px rgba(44, 30, 22, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.18);
  cursor: pointer;
  position: relative;
  transition: transform 0.15s ease, box-shadow 0.2s ease;
}
.chat-fab:hover {
  transform: translateY(-3px);
  box-shadow: 0 24px 40px -16px rgba(44, 30, 22, 0.9);
}
.chat-fab:active {
  transform: translateY(0);
}

.chat-fab-pulse {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px solid rgba(201, 138, 94, 0.6);
  animation: cw-pulse 2.4s ease-out infinite;
  pointer-events: none;
}
@keyframes cw-pulse {
  0% { transform: scale(1); opacity: 0.7; }
  70% { transform: scale(1.35); opacity: 0; }
  100% { transform: scale(1.35); opacity: 0; }
}

.chat-panel {
  position: absolute;
  bottom: 74px;
  right: 0;
  width: 460px;
  max-width: calc(100vw - 32px);
  height: 620px;
  max-height: calc(100vh - 120px);
  border-radius: 22px;
  overflow: hidden;
  background: #fbf8f4;
  box-shadow: 0 30px 70px -28px rgba(44, 30, 22, 0.6), 0 0 0 1px rgba(230, 219, 208, 0.9);
  transform-origin: bottom right;
}

.chat-close {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 5;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.85);
  color: #54341f;
  border: 1px solid rgba(230, 219, 208, 0.9);
  cursor: pointer;
  backdrop-filter: blur(6px);
}
.chat-close:hover {
  background: #fff;
  color: #3b2a20;
}

.cw-panel-enter-active {
  transition: opacity 0.22s ease, transform 0.28s cubic-bezier(0.2, 0.7, 0.3, 1);
}
.cw-panel-leave-active {
  transition: opacity 0.18s ease, transform 0.2s cubic-bezier(0.4, 0, 1, 1);
}
.cw-panel-enter-from,
.cw-panel-leave-to {
  opacity: 0;
  transform: scale(0.92) translateY(12px);
}

.cw-icon-enter-active,
.cw-icon-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.cw-icon-enter-from {
  opacity: 0;
  transform: rotate(-90deg) scale(0.6);
}
.cw-icon-leave-to {
  opacity: 0;
  transform: rotate(90deg) scale(0.6);
}

@media (max-width: 520px) {
  .chat-widget {
    bottom: 16px;
    right: 16px;
  }
  .chat-panel {
    width: calc(100vw - 32px);
    height: calc(100vh - 100px);
    bottom: 70px;
  }
}
</style>
