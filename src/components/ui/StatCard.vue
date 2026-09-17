<script setup lang="ts">
/**
 * Cartão de KPI no padrão dos mockups:
 * ícone em chip colorido + valor grande + rótulo (+ variação/percentual opcional).
 */
withDefaults(
  defineProps<{
    label: string
    value: string | number
    tone?: 'blue' | 'green' | 'yellow' | 'red' | 'slate' | 'purple'
    detail?: string
  }>(),
  { tone: 'blue', detail: '' },
)
</script>

<template>
  <div class="stat card" :class="`tone-${tone}`">
    <div class="icon-chip">
      <slot />
    </div>
    <div class="stat-body">
      <strong class="stat-value">{{ value }}</strong>
      <span class="stat-label">{{ label }}</span>
      <span v-if="detail" class="stat-detail">{{ detail }}</span>
    </div>
  </div>
</template>

<style scoped>
.stat {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
  min-width: 0;
}

.icon-chip {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.stat-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.stat-value {
  font-size: 24px;
  font-weight: 800;
  line-height: 1.1;
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 600;
}

.stat-detail {
  font-size: 11.5px;
  font-weight: 700;
  margin-top: 2px;
}

.tone-blue .icon-chip { background: var(--blue-soft); color: var(--blue); }
.tone-green .icon-chip { background: var(--green-soft); color: var(--green); }
.tone-yellow .icon-chip { background: var(--yellow-soft); color: var(--yellow); }
.tone-red .icon-chip { background: var(--red-soft); color: var(--red); }
.tone-slate .icon-chip { background: var(--slate-soft); color: var(--slate); }
.tone-purple .icon-chip { background: var(--purple-soft); color: var(--purple); }

.tone-green .stat-detail { color: var(--green); }
.tone-yellow .stat-detail { color: var(--yellow); }
.tone-red .stat-detail { color: var(--red); }
.tone-slate .stat-detail { color: var(--slate); }
.tone-blue .stat-detail { color: var(--blue); }
.tone-purple .stat-detail { color: var(--purple); }
</style>
