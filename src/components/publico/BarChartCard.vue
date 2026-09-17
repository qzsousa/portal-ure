<script setup lang="ts">
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)

/** Cartão com gráfico de barras (vue-chartjs) no padrão visual do portal. */
interface BarSerie {
  label: string
  data: number[]
  cor: string
}

const props = withDefaults(
  defineProps<{
    titulo: string
    sub?: string
    labels: string[]
    series: BarSerie[]
    /** barras horizontais (indexAxis: 'y') */
    horizontal?: boolean
    /** empilha as séries (ex.: categorias por status) */
    empilhado?: boolean
    legenda?: boolean
  }>(),
  { sub: '', horizontal: false, empilhado: false, legenda: false },
)

const temDados = computed(
  () => props.labels.length > 0 && props.series.some((s) => s.data.some((v) => v > 0)),
)

const chartData = computed<ChartData<'bar'>>(() => ({
  labels: props.labels,
  datasets: props.series.map((s) => ({
    label: s.label,
    data: s.data,
    backgroundColor: s.cor,
    borderRadius: 4,
    barPercentage: 0.6,
  })),
}))

const chartOptions = computed<ChartOptions<'bar'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: props.horizontal ? 'y' : 'x',
  plugins: {
    legend: {
      display: props.legenda,
      position: 'bottom',
      labels: { boxWidth: 10, boxHeight: 10, color: '#64748b', font: { size: 11 } },
    },
  },
  scales: {
    x: {
      stacked: props.empilhado,
      beginAtZero: true,
      grid: { display: props.horizontal, color: '#e2e8f0' },
      ticks: { color: '#64748b', precision: 0, font: { size: 11 } },
    },
    y: {
      stacked: props.empilhado,
      beginAtZero: true,
      grid: { display: !props.horizontal, color: '#e2e8f0' },
      ticks: { color: '#64748b', precision: 0, font: { size: 11 } },
    },
  },
}))
</script>

<template>
  <div class="bar-card card">
    <h3 class="bar-title">{{ titulo }}</h3>
    <p v-if="sub" class="bar-sub">{{ sub }}</p>
    <div class="bar-area">
      <Bar v-if="temDados" :data="chartData" :options="chartOptions" />
      <p v-else class="bar-vazio">Sem dados para exibir.</p>
    </div>
  </div>
</template>

<style scoped>
.bar-card {
  padding: 20px;
  min-width: 0;
}

.bar-title {
  font-size: 15px;
}

.bar-sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.bar-area {
  position: relative;
  height: 240px;
  margin-top: 14px;
}

.bar-vazio {
  margin: 0;
  height: 100%;
  display: grid;
  place-items: center;
  color: var(--text-muted);
  font-size: 13px;
}
</style>
