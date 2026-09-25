<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  Monitor,
  Radar,
  School,
  Wrench,
} from '@lucide/vue'
import DonutCard from '@/components/ui/DonutCard.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import { useEquipamentos } from '@/composables/useEquipamentos'
import { AUTO_REFRESH_MS, useAutoRefresh } from '@/composables/useAutoRefresh'
import { listarCatalogo, pct } from '@/api/sce'
import { getFeedbackStats, type FeedbackStats } from '@/api/feedback'
import { listarChamados, rotuloStatusChamado } from '@/api/chamados'
import { formatDate } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import type { Chamado } from '@/types'

const auth = useAuthStore()
const ehGestor = computed(() => auth.user?.nivel === 'GESTOR')
/* Cards auxiliares (unidades, modelos, avaliação) são da matriz — a escola
 * (Gestor/Visualizador) não os vê; o Gestor tem a visão dividida abaixo. */
const/cardsDaMatriz = computed(() => !['GESTOR', 'VISUALIZADOR'].includes(auth.user?.nivel || ''))

const eq = useEquipamentos(10)

const totalModelos = ref<number | null>(null)
const statsAvaliacao = ref<FeedbackStats | null>(null)

const CORES_AVALIACAO: Record<string, string> = {
  'Nota 1': '#dc2626',
  'Nota 2': '#f59e0b',
  'Nota 3': '#eab308',
  'Nota 4': '#2563eb',
  'Nota 5': '#16a34a',
}

const fatiasAvaliacao = computed(() => {
  const porNota = statsAvaliacao.value?.avaliacoes.porNota || {}
  return {
    'Nota 1': porNota['1'] || 0,
    'Nota 2': porNota['2'] || 0,
    'Nota 3': porNota['3'] || 0,
    'Nota 4': porNota['4'] || 0,
    'Nota 5': porNota['5'] || 0,
  }
})

const mediaAvaliacao = computed(() => {
  const media = statsAvaliacao.value?.avaliacoes.media
  return typeof media === 'number' ? `${media.toFixed(1)}/5` : '—'
})

/** Cargas auxiliares; falhas mantêm o último valor conhecido exibido. */
async function carregarExtras() {
  try {
    const catalogo = await listarCatalogo()
    totalModelos.value = catalogo.length
  } catch {
    /* silencioso */
  }
  try {
    statsAvaliacao.value = await getFeedbackStats()
  } catch {
    /* silencioso */
  }
}

/* ---------- Chamados (visão dividida do gestor) ---------- */
const chamados = reactive({
  loading: true,
  items: [] as Chamado[],
})

/** `silencioso`: auto-refresh não mostra spinner (mantém os dados anteriores). */
async function carregarChamados(silencioso = false) {
  if (!silencioso) chamados.loading = true
  try {
    const res = await listarChamados({ page: 1, limit: 5 })
    chamados.items = res.data
  } catch {
    /* silencioso */
  } finally {
    chamados.loading = false
  }
}

const CORES_STATUS: Record<string, string> = {
  'Disponível': '#16a34a',
  'Manutenção': '#f59e0b',
  'Quebrado': '#dc2626',
  'Extraviado': '#64748b',
  'Emprestado': '#2563eb',
  'Inservível': '#9333ea',
  'Em verificação': '#0891b2',
}

onMounted(async () => {
  await eq.carregar()
  if (cardsDaMatriz.value) await carregarExtras()
  if (ehGestor.value) await carregarChamados()
})

/* Atualização automática do painel (equipamentos, catálogo/avaliações e, para gestor, chamados). */
useAutoRefresh(async () => {
  await eq.carregar(true)
  if (cardsDaMatriz.value) await carregarExtras()
  if (ehGestor.value) await carregarChamados(true)
}, AUTO_REFRESH_MS.normal)
</script>

<template>
  <div class="painel">
    <p v-if="eq.state.erro" class="erro card">{{ eq.state.erro }}</p>

    <!-- Visão dividida do GESTOR: equipamentos | chamados -->
    <div v-if="ehGestor" class="split-grid">
      <div class="card table-card">
        <div class="table-header">
          <h3>Equipamentos</h3>
          <RouterLink class="btn btn-primary" to="/equipamentos">Ver todos</RouterLink>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Equipamento</th>
                <th>Patrimônio</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="eq.state.loading">
                <td colspan="3" class="td-center">Carregando...</td>
              </tr>
              <tr v-else-if="eq.state.items.length === 0">
                <td colspan="3" class="td-center">Nenhum equipamento encontrado.</td>
              </tr>
              <tr v-for="item in eq.state.items.slice(0, 5)" :key="item.id">
                <td>
                  <strong class="eq-modelo">{{ item.modelo }}</strong>
                  <span class="eq-sub">{{ item.categoria }} · {{ item.marca }}</span>
                </td>
                <td>{{ item.patrimonio || '—' }}</td>
                <td><StatusPill :status="item.status" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card table-card">
        <div class="table-header">
          <h3>Chamados</h3>
          <RouterLink class="btn btn-primary" to="/chamados">Ver todos</RouterLink>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Protocolo</th>
                <th>Data</th>
                <th>Tipo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="chamados.loading">
                <td colspan="4" class="td-center">Carregando...</td>
              </tr>
              <tr v-else-if="chamados.items.length === 0">
                <td colspan="4" class="td-center">Nenhum chamado encontrado.</td>
              </tr>
              <tr v-for="c in chamados.items" :key="c.id">
                <td class="nowrap"><strong>#{{ c.protocolo }}</strong></td>
                <td class="nowrap">{{ formatDate(c.timestamp) }}</td>
                <td>{{ c.tipo }}</td>
                <td><StatusPill :status="rotuloStatusChamado(c.status)" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Painel completo (demais perfis) -->
    <template v-else>
      <!-- KPIs -->
      <div class="stats-grid">
        <StatCard label="Equipamentos cadastrados" :value="eq.stats.value.total || '—'" tone="blue">
          <Monitor :size="22" />
        </StatCard>
        <StatCard
          label="Disponíveis"
          :value="eq.stats.value.disponiveis"
          :detail="pct(eq.stats.value.disponiveis, eq.stats.value.total)"
          tone="green"
        >
          <CheckCircle2 :size="22" />
        </StatCard>
        <StatCard
          label="Em manutenção"
          :value="eq.stats.value.emManutencao"
          :detail="pct(eq.stats.value.emManutencao, eq.stats.value.total)"
          tone="yellow"
        >
          <Wrench :size="22" />
        </StatCard>
        <StatCard
          label="Quebrados"
          :value="eq.stats.value.quebrados"
          :detail="pct(eq.stats.value.quebrados, eq.stats.value.total)"
          tone="red"
        >
          <AlertTriangle :size="22" />
        </StatCard>
        <StatCard
          label="Extraviados"
          :value="eq.stats.value.extraviados"
          :detail="pct(eq.stats.value.extraviados, eq.stats.value.total)"
          tone="slate"
        >
          <Radar :size="22" />
        </StatCard>
      </div>

      <!-- Gráficos -->
      <div v-if="eq.statsCarregadas.value" class="charts-grid">
        <DonutCard titulo="Equipamentos por Categoria" :fatias="eq.state.porCategoria" />
        <DonutCard titulo="Status dos Equipamentos" :fatias="eq.state.porStatus" :cores="CORES_STATUS" />
      </div>

      <!-- Cards auxiliares (somente matriz: ADMIN/TÉCNICO) -->
      <div v-if="cardsDaMatriz" class="mini-grid">
        <div class="mini card">
          <div class="mini-icon blue"><School :size="22" /></div>
          <div>
            <strong>{{ eq.unidadesOpcoes.value.length }}</strong>
            <span>Unidades com equipamentos</span>
          </div>
        </div>
        <div class="mini card">
          <div class="mini-icon yellow"><Box :size="22" /></div>
          <div>
            <strong>{{ totalModelos && totalModelos > 0 ? totalModelos : '—' }}</strong>
            <span>Modelos cadastrados</span>
          </div>
        </div>
        <DonutCard
          titulo="Avaliação de atendimento"
          :fatias="fatiasAvaliacao"
          :cores="CORES_AVALIACAO"
          :center-label="mediaAvaliacao"
        />
      </div>

      <!-- Filtros -->
      <div class="filtros card">
        <div v-if="!ehGestor" class="field">
          <label>Unidade Escolar</label>
          <select v-model="eq.filtros.unidade" class="select-input">
            <option value="">Todas as unidades</option>
            <option v-for="u in eq.unidadesOpcoes.value" :key="u" :value="u">{{ u }}</option>
          </select>
        </div>
        <div class="field">
          <label>Categoria</label>
          <select v-model="eq.filtros.categoria" class="select-input">
            <option value="">Todas</option>
            <option v-for="c in eq.categoriasOpcoes.value" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div class="field">
          <label>Status</label>
          <select v-model="eq.filtros.status" class="select-input">
            <option value="">Todos</option>
            <option v-for="s in Object.keys(eq.state.porStatus)" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div class="field field-busca">
          <label>Busca</label>
          <input
            v-model="eq.filtros.busca"
            class="input"
            placeholder="Buscar equipamento, patrimônio, nº de série..."
            @keyup.enter="eq.aplicarFiltros()"
          />
        </div>
        <button class="btn btn-primary" type="button" @click="eq.aplicarFiltros()">Aplicar filtros</button>
      </div>

      <!-- Tabela -->
      <div class="card table-card">
        <div class="table-header">
          <h3>Equipamentos</h3>
          <RouterLink class="btn btn-primary" to="/equipamentos">Ver módulo completo</RouterLink>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Equipamento</th>
                <th>Patrimônio</th>
                <th>Nº de Série</th>
                <th>Categoria</th>
                <th>Unidade Escolar</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="eq.state.loading">
                <td colspan="6" class="td-center">Carregando...</td>
              </tr>
              <tr v-else-if="eq.state.items.length === 0">
                <td colspan="6" class="td-center">Nenhum equipamento encontrado.</td>
              </tr>
              <tr v-for="item in eq.state.items" :key="item.id">
                <td>
                  <strong class="eq-modelo">{{ item.modelo }}</strong>
                  <span class="eq-sub">{{ item.categoria }} · {{ item.marca }}</span>
                </td>
                <td>{{ item.patrimonio || '—' }}</td>
                <td>{{ item.numeroSerie || '—' }}</td>
                <td>{{ item.categoria }}</td>
                <td>{{ item.unidade }}</td>
                <td><StatusPill :status="item.status" /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <PaginationBar
          :page="eq.state.page"
          :page-size="10"
          :total="eq.state.total"
          @change="eq.irParaPagina"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.painel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.split-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: start;
}

.filtros {
  display: grid;
  grid-template-columns: 1.2fr 1fr 0.8fr 1.6fr auto;
  gap: 14px;
  padding: 16px 18px;
  align-items: end;
}

.erro {
  padding: 14px 18px;
  color: var(--red);
  font-weight: 500;
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

.mini-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
  gap: 16px;
}

.mini {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
}

.mini strong {
  display: block;
  font-size: 22px;
}

.mini span {
  font-size: 12.5px;
  color: var(--text-secondary);
}

.mini-icon {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  display: grid;
  place-items: center;
}

.mini-icon.blue { background: var(--blue-soft); color: var(--blue); }
.mini-icon.yellow { background: var(--yellow-soft); color: var(--yellow); }

.table-card {
  overflow: hidden;
}

.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid var(--border);
}

.table-header h3 {
  font-size: 15px;
}

.eq-modelo {
  display: block;
  font-weight: 600;
  color: var(--text-primary);
}

.eq-sub {
  display: block;
  font-size: 11.5px;
  color: var(--text-muted);
}

.nowrap {
  white-space: nowrap;
}

.td-center {
  text-align: center;
  color: var(--text-muted);
  padding: 28px !important;
}

@media (max-width: 1100px) {
  .filtros {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 900px) {
  .split-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .filtros {
    grid-template-columns: 1fr;
  }
  .filtros .btn {
    width: 100%;
  }
}
</style>
