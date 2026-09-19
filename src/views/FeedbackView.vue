<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ClipboardList, Heart, Lightbulb, Star } from '@lucide/vue'
import DonutCard from '@/components/ui/DonutCard.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import StatCard from '@/components/ui/StatCard.vue'
import {
  getFeedbackStats,
  listarFeedbacks,
  type FeedbackItem,
  type FeedbackStats,
  type TipoFeedback,
} from '@/api/feedback'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()

/* ---------- KPIs ---------- */

const stats = ref<FeedbackStats | null>(null)

const mediaFormatada = computed(() => {
  const media = stats.value?.avaliacoes.media
  return typeof media === 'number' ? `${media.toFixed(1)}/5` : '—'
})

const fatiasNotas = computed(() => {
  const porNota = stats.value?.avaliacoes.porNota || {}
  return {
    'Nota 1': porNota['1'] || 0,
    'Nota 2': porNota['2'] || 0,
    'Nota 3': porNota['3'] || 0,
    'Nota 4': porNota['4'] || 0,
    'Nota 5': porNota['5'] || 0,
  }
})

const CORES_NOTAS: Record<string, string> = {
  'Nota 1': '#dc2626',
  'Nota 2': '#f59e0b',
  'Nota 3': '#eab308',
  'Nota 4': '#2563eb',
  'Nota 5': '#16a34a',
}

/* ---------- Lista de feedbacks ---------- */

const estado = reactive({ loading: true, erro: '', items: [] as FeedbackItem[], total: 0, page: 1 })
const PAGE_SIZE = 10
const filtroTipo = ref<'' | TipoFeedback>('')

async function carregar() {
  estado.loading = true
  estado.erro = ''
  try {
    const res = await listarFeedbacks({
      tipo: filtroTipo.value || undefined,
      page: estado.page,
      limit: PAGE_SIZE,
    })
    estado.items = res.data
    estado.total = res.meta.total
  } catch {
    estado.erro = 'Não foi possível carregar os feedbacks.'
  } finally {
    estado.loading = false
  }
}

function aplicarFiltro() {
  estado.page = 1
  void carregar()
}

function formatarData(ts: string | null | undefined): string {
  if (!ts) return '—'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

onMounted(async () => {
  void carregar()
  try {
    stats.value = await getFeedbackStats()
  } catch {
    stats.value = null
    ui.error('Não foi possível carregar os indicadores de avaliação.')
  }
})
</script>

<template>
  <div class="feedback-page">
    <!-- KPIs -->
    <div class="stats-grid">
      <StatCard label="Média de avaliação" :value="mediaFormatada" tone="yellow">
        <Star :size="22" />
      </StatCard>
      <StatCard label="Avaliações recebidas" :value="stats?.avaliacoes.total ?? '—'" tone="slate">
        <ClipboardList :size="22" />
      </StatCard>
      <StatCard label="Elogios" :value="stats?.feedback.elogios ?? '—'" tone="green">
        <Heart :size="22" />
      </StatCard>
      <StatCard label="Sugestões" :value="stats?.feedback.sugestoes ?? '—'" tone="blue">
        <Lightbulb :size="22" />
      </StatCard>
    </div>

    <!-- Distribuição das notas -->
    <div v-if="stats" class="charts-grid">
      <DonutCard titulo="Distribuição das notas" :fatias="fatiasNotas" :cores="CORES_NOTAS" />
    </div>

    <!-- Lista -->
    <p v-if="estado.erro" class="erro card">{{ estado.erro }}</p>

    <div class="card table-card">
      <div class="table-header">
        <h3>Elogios e sugestões</h3>
        <select v-model="filtroTipo" class="select-input slim" @change="aplicarFiltro">
          <option value="">Todos</option>
          <option value="ELOGIO">Elogios</option>
          <option value="SUGESTAO">Sugestões</option>
        </select>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Nome</th>
              <th>Unidade</th>
              <th>Mensagem</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="estado.loading">
              <td colspan="5" class="td-center">Carregando...</td>
            </tr>
            <tr v-else-if="estado.items.length === 0">
              <td colspan="5" class="td-center">Nenhum registro encontrado.</td>
            </tr>
            <tr v-for="f in estado.items" :key="f.id">
              <td>
                <span class="tipo-pill" :class="f.tipo === 'ELOGIO' ? 'elogio' : 'sugestao'">
                  {{ f.tipo === 'ELOGIO' ? 'Elogio' : 'Sugestão' }}
                </span>
              </td>
              <td>{{ f.nome || '—' }}</td>
              <td>{{ f.unidade || '—' }}</td>
              <td class="td-mensagem">{{ f.mensagem }}</td>
              <td>{{ formatarData(f.criadoEm) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <PaginationBar
        :page="estado.page"
        :page-size="PAGE_SIZE"
        :total="estado.total"
        @change="(p) => { estado.page = p; void carregar() }"
      />
    </div>
  </div>
</template>

<style scoped>
.feedback-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 16px;
}

.erro {
  padding: 14px 18px;
  color: var(--red);
  font-weight: 500;
}

.table-card {
  overflow: hidden;
}

.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--border);
}

.table-header h3 {
  font-size: 15px;
}

.select-input.slim {
  width: auto;
  min-width: 140px;
}

.td-center {
  text-align: center;
  color: var(--text-muted);
  padding: 28px !important;
}

.td-mensagem {
  max-width: 380px;
  white-space: pre-wrap;
}

.tipo-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.tipo-pill::before {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

.tipo-pill.elogio {
  background: var(--green-soft);
  color: var(--green);
}

.tipo-pill.sugestao {
  background: var(--blue-soft);
  color: var(--blue);
}
</style>
