<script setup lang="ts">
/**
 * Barra de paginação no padrão dos mockups:
 * "Mostrando X a Y de N registros   ‹ 1 2 3 ... ›"
 */
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from '@lucide/vue'

const props = defineProps<{
  page: number
  pageSize: number
  total: number
}>()

const emit = defineEmits<{ (e: 'change', page: number): void }>()

const totalPaginas = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const inicio = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1))
const fim = computed(() => Math.min(props.total, props.page * props.pageSize))

const paginasVisiveis = computed<(number | '…')[]>(() => {
  const t = totalPaginas.value
  const p = props.page
  if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1)
  const pages: (number | '…')[] = [1]
  if (p > 3) pages.push('…')
  for (let i = Math.max(2, p - 1); i <= Math.min(t - 1, p + 1); i++) pages.push(i)
  if (p < t - 2) pages.push('…')
  pages.push(t)
  return pages
})

function ir(p: number | '…') {
  if (p === '…' || p === props.page || p < 1 || p > totalPaginas.value) return
  emit('change', p)
}
</script>

<template>
  <div class="pagination">
    <span class="info">Mostrando {{ inicio }} a {{ fim }} de {{ total.toLocaleString('pt-BR') }} registros</span>
    <div class="pages">
      <button class="page-btn" type="button" :disabled="page <= 1" @click="ir(page - 1)">
        <ChevronLeft :size="15" />
      </button>
      <button
        v-for="(p, i) in paginasVisiveis"
        :key="i"
        class="page-btn"
        :class="{ active: p === page, dots: p === '…' }"
        type="button"
        @click="ir(p)"
      >
        {{ p }}
      </button>
      <button class="page-btn" type="button" :disabled="page >= totalPaginas" @click="ir(page + 1)">
        <ChevronRight :size="15" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  flex-wrap: wrap;
}

.info {
  font-size: 12.5px;
  color: var(--text-muted);
}

.pages {
  display: flex;
  align-items: center;
  gap: 4px;
}

.page-btn {
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  border: 1px solid transparent;
}

.page-btn:hover:not(:disabled):not(.dots) {
  background: var(--surface-muted);
  border-color: var(--border);
}

.page-btn.active {
  background: var(--sidebar-bg);
  color: #fff;
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-btn.dots {
  cursor: default;
}
</style>
