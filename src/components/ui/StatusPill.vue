<script setup lang="ts">
import { computed } from 'vue'

/**
 * Pílula de status colorida (padrão dos mockups).
 * O tom é inferido do texto do status — aceita o texto cru dos dois backends.
 */
const props = defineProps<{ status: string }>()

const tone = computed(() => {
  const s = (props.status || '').toLowerCase()
  if (s.includes('dispon')) return 'green'
  if (s.includes('manuten')) return 'yellow'
  if (s.includes('quebrad') || s === 'aberto') return 'red'
  if (s.includes('extrav')) return 'slate'
  // Encaminhado é chamado que já saiu da fila da matriz mas ainda não começou:
  // entra antes de "andamento" porque "encaminhado para atendimento" também
  // contém "atendimento".
  if (s.includes('encaminhad')) return 'yellow'
  if (s.includes('andamento') || s.includes('atendimento')) return 'blue'
  // "Aguardando conferência" é o purple: bola com a escola.
  if (s.includes('aguard') || s.includes('comunicado')) return 'purple'
  if (s.includes('conclu') || s.includes('resolv') || s.includes('emprestad')) return 'green'
  if (s.includes('pendent')) return 'yellow'
  return 'slate'
})
</script>

<template>
  <span class="pill" :class="`pill-${tone}`">
    <span class="dot" />
    {{ status }}
  </span>
</template>

<style scoped>
.pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

.pill-green { background: var(--green-soft); color: var(--green); }
.pill-yellow { background: var(--yellow-soft); color: var(--yellow); }
.pill-red { background: var(--red-soft); color: var(--red); }
.pill-slate { background: var(--slate-soft); color: var(--slate); }
.pill-blue { background: var(--blue-soft); color: var(--blue); }
.pill-purple { background: var(--purple-soft); color: var(--purple); }
</style>
