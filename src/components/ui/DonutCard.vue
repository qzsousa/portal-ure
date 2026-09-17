<script setup lang="ts">
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps<{
  titulo: string
  iconLabel?: string
  /** fatias: rótulo → valor */
  fatias: Record<string, number>
  /** cores por rótulo (fallback: paleta padrão) */
  cores?: Record<string, string>
  centerLabel?: string
}>()

const PALETA = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#64748b', '#9333ea', '#0891b2', '#db2777']

const total = computed(() => Object.values(props.fatias).reduce((a, b) => a + b, 0))

const entradas = computed(() =>
  Object.entries(props.fatias)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({
      label,
      value,
      cor: props.cores?.[label] || PALETA[i % PALETA.length],
      pct: total.value ? Math.round((value / total.value) * 100) : 0,
    })),
)

const chartData = computed(() => ({
  labels: entradas.value.map((e) => e.label),
  datasets: [
    {
      data: entradas.value.map((e) => e.value),
      backgroundColor: entradas.value.map((e) => e.cor),
      borderWidth: 2,
      borderColor: '#ffffff',
    },
  ],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '68%',
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: { label?: string; parsed?: number }) => ` ${ctx.label}: ${ctx.parsed}`,
      },
    },
  },
}
</script>

<template>
  <div class="donut-card card">
    <h3 class="donut-title">{{ titulo }}</h3>
    <div class="donut-body">
      <div class="chart-box">
        <Doughnut :data="chartData" :options="chartOptions" />
        <div class="chart-center">
          <strong>{{ total.toLocaleString('pt-BR') }}</strong>
          <span>{{ centerLabel || 'Total' }}</span>
        </div>
      </div>
      <ul class="legend">
        <li v-for="e in entradas" :key="e.label">
          <span class="bullet" :style="{ background: e.cor }" />
          <span class="legend-label">{{ e.label }}</span>
          <span class="legend-value">{{ e.pct }}% &nbsp; {{ e.value.toLocaleString('pt-BR') }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.donut-card {
  padding: 20px;
}

.donut-title {
  font-size: 15px;
  margin-bottom: 16px;
}

.donut-body {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.chart-box {
  position: relative;
  width: 190px;
  height: 190px;
  flex-shrink: 0;
}

.chart-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.chart-center strong {
  font-size: 24px;
  font-weight: 800;
}

.chart-center span {
  font-size: 12px;
  color: var(--text-muted);
}

.legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-width: 180px;
}

.legend li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.bullet {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}

.legend-label {
  color: var(--text-secondary);
  font-weight: 500;
  flex: 1;
}

.legend-value {
  color: var(--text-primary);
  font-weight: 600;
  white-space: nowrap;
}
</style>
