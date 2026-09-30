<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ClipboardList, Heart, Lightbulb, MessageSquareQuote, Star } from '@lucide/vue'
import DonutCard from '@/components/ui/DonutCard.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import StatCard from '@/components/ui/StatCard.vue'
import {
  getFeedbackStats,
  listarAvaliacoes,
  listarFeedbacks,
  type AvaliacaoItem,
  type FeedbackItem,
  type FeedbackStats,
  type TipoFeedback,
} from '@/api/feedback'
import { AUTO_REFRESH_MS, useAutoRefresh } from '@/composables/useAutoRefresh'
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

/** `silencioso`: atualização automática — não mostra spinner nem erro na tela. */
async function carregar(silencioso = false) {
  if (!silencioso) estado.loading = true
  try {
    const res = await listarFeedbacks({
      tipo: filtroTipo.value || undefined,
      page: estado.page,
      limit: PAGE_SIZE,
    })
    estado.items = res.data
    estado.total = res.meta.total
    estado.erro = ''
  } catch {
    if (!silencioso) estado.erro = 'Não foi possível carregar os feedbacks.'
  } finally {
    estado.loading = false
  }
}

/** `silencioso`: na atualização automática não emite toast em caso de falha. */
async function carregarStats(silencioso = false) {
  try {
    stats.value = await getFeedbackStats()
  } catch {
    stats.value = silencioso ? stats.value : null
    if (!silencioso) ui.error('Não foi possível carregar os indicadores de avaliação.')
  }
}

function aplicarFiltro() {
  estado.page = 1
  void carregar()
}

/* ---------- Avaliações com comentário ---------- */

/**
 * Cada avaliação traz a nota e o comentário que a escola deixou. A nota sozinha
 * não diz o que deu errado (ou certo); o comentário é o que a equipe consegue
 * usar de verdade.
 */
const aval = reactive({
  loading: true,
  erro: '',
  items: [] as AvaliacaoItem[],
  total: 0,
  page: 1,
})
const filtroNota = ref<'' | number>('')
const somenteComentarios = ref(true)

async function carregarAvaliacoes(silencioso = false) {
  if (!silencioso) aval.loading = true
  try {
    const res = await listarAvaliacoes({
      nota: filtroNota.value === '' ? undefined : filtroNota.value,
      somenteComentarios: somenteComentarios.value,
      page: aval.page,
      limit: PAGE_SIZE,
    })
    aval.items = res.data
    aval.total = res.meta.total
    aval.erro = ''
  } catch {
    if (!silencioso) aval.erro = 'Não foi possível carregar as avaliações.'
  } finally {
    aval.loading = false
  }
}

function aplicarFiltroAvaliacoes() {
  aval.page = 1
  void carregarAvaliacoes()
}

/** Cor da nota: a mesma da rosca de distribuição, para o olho casar. */
function corDaNota(nota: number): string {
  return CORES_NOTAS[`Nota ${nota}`] || 'var(--text-muted)'
}

function formatarData(ts: string | null | undefined): string {
  if (!ts) return '—'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

onMounted(() => {
  void carregar()
  void carregarStats()
  void carregarAvaliacoes()
})

/* Atualização automática: avaliações/feedbacks novos chegam sozinhos. */
useAutoRefresh(async () => {
  await Promise.all([carregar(true), carregarStats(true), carregarAvaliacoes(true)])
}, AUTO_REFRESH_MS.normal)
</script>

<template>
  <div class="feedback-page">
    <!-- Cabeçalho -->
    <div class="page-head">
      <div>
        <h2>Elogios e avaliações</h2>
        <p>Como as escolas avaliam o atendimento e o que enviam para a caixa de retorno</p>
      </div>
    </div>

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

    <!-- Avaliações com comentário -->
    <p v-if="aval.erro" class="erro card">{{ aval.erro }}</p>

    <div class="card table-card">
      <div class="table-header">
        <h3 class="com-icone"><MessageSquareQuote :size="18" /> Avaliações do atendimento</h3>
        <div class="filtros-inline">
          <label class="check">
            <input v-model="somenteComentarios" type="checkbox" @change="aplicarFiltroAvaliacoes" />
            <span>Somente com comentário</span>
          </label>
          <select
            v-model="filtroNota"
            class="select-input slim"
            @change="aplicarFiltroAvaliacoes"
          >
            <option value="">Todas as notas</option>
            <option v-for="n in [5, 4, 3, 2, 1]" :key="n" :value="n">
              {{ n }} estrela{{ n > 1 ? 's' : '' }}
            </option>
          </select>
        </div>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Nota</th>
              <th>Comentário da escola</th>
              <th>Chamado</th>
              <th>Unidade</th>
              <th>Atendente</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="aval.loading">
              <td colspan="6" class="td-center">Carregando...</td>
            </tr>
            <tr v-else-if="aval.items.length === 0">
              <td colspan="6" class="td-center">
                Nenhuma avaliação encontrada com esses filtros.
              </td>
            </tr>
            <tr v-for="a in aval.items" :key="a.id">
              <td>
                <span class="nota-badge" :style="{ background: corDaNota(a.nota) }">{{ a.nota }}</span>
                <span class="estrelas-mini" :aria-label="`${a.nota} de 5 estrelas`">
                  <Star
                    v-for="i in 5"
                    :key="i"
                    :size="12"
                    :fill="i <= a.nota ? corDaNota(a.nota) : 'none'"
                    :color="i <= a.nota ? corDaNota(a.nota) : '#cbd5e1'"
                  />
                </span>
              </td>
              <td class="td-comentario">
                <template v-if="a.comentario">{{ a.comentario }}</template>
                <em v-else class="sem-comentario">Sem comentário</em>
              </td>
              <td class="nowrap">
                <strong>#{{ a.protocolo }}</strong>
                <span class="sub">{{ a.tipo }}</span>
              </td>
              <td>{{ a.unidade }}</td>
              <td>{{ a.tecnico || '—' }}</td>
              <td class="nowrap">{{ formatarData(a.criadoEm) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <PaginationBar
        :page="aval.page"
        :page-size="PAGE_SIZE"
        :total="aval.total"
        @change="(p) => { aval.page = p; void carregarAvaliacoes() }"
      />
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

.page-head h2 {
  font-size: 20px;
}

.page-head p {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--text-muted);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
  gap: 14px;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
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

/* ---------- Avaliações ---------- */

.com-icone {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.filtros-inline {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
}

.check input {
  width: 15px;
  height: 15px;
  accent-color: var(--brand-gold);
  cursor: pointer;
}

/* Nota: número em destaque + estrelas ao lado. */
.nota-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  vertical-align: middle;
}

.estrelas-mini {
  display: inline-flex;
  gap: 1px;
  margin-left: 7px;
  vertical-align: middle;
}

/* O comentário é a coluna principal: largura maior e quebra preservada. */
.td-comentario {
  max-width: 380px;
  white-space: pre-wrap;
}

.sem-comentario {
  color: var(--text-muted);
  font-size: 12px;
}

.sub {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
