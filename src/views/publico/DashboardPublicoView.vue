<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Loader2,
  RefreshCw,
  School,
} from '@lucide/vue'
import PublicoLayout from '@/components/publico/PublicoLayout.vue'
import BarChartCard from '@/components/publico/BarChartCard.vue'
import DonutCard from '@/components/ui/DonutCard.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import { getDashboardMatriz, type DashboardMatriz } from '@/api/publico'
import { rotuloStatusChamado } from '@/api/chamados'

const dados = ref<DashboardMatriz | null>(null)
const carregando = ref(false)
const erro = ref('')
const atualizadoEm = ref('')

const CORES_STATUS: Record<string, string> = {
  Aberto: '#dc2626',
  'Em atendimento': '#2563eb',
  'Aguardando escola': '#9333ea',
  'Concluído': '#16a34a',
}

const CORES_URGENCIA: Record<string, string> = {
  Alta: '#dc2626',
  Média: '#d97706',
  Baixa: '#16a34a',
}

const porStatusRotulado = computed(() => {
  const out: Record<string, number> = {}
  const src = dados.value?.graficos.porStatus || {}
  for (const [status, qtd] of Object.entries(src)) {
    const label = rotuloStatusChamado(status)
    out[label] = (out[label] || 0) + qtd
  }
  return out
})

const porUrgencia = computed(() => dados.value?.graficos.porUrgencia || {})

const resolvidosPorTecnico = computed(() => {
  const entradas = Object.entries(dados.value?.graficos.resolvidosPorTecnico || {}).sort(
    (a, b) => b[1] - a[1],
  )
  return {
    labels: entradas.map(([nome]) => nome),
    series: [{ label: 'Resolvidos', data: entradas.map(([, qtd]) => qtd), cor: '#16a34a' }],
  }
})

const ultimos = computed(() => (dados.value?.chamados || []).slice(0, 10))

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    dados.value = await getDashboardMatriz()
    atualizadoEm.value = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    erro.value = 'Não foi possível carregar os dados do painel. Verifique sua conexão e tente novamente.'
  } finally {
    carregando.value = false
  }
}

function formatarData(ts: string): string {
  const d = new Date(ts)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function truncar(t: string, max: number): string {
  return t.length > max ? t.slice(0, max - 1) + '…' : t
}

onMounted(carregar)
</script>

<template>
  <PublicoLayout wide>
    <header class="cabecalho">
      <div>
        <h1>Painel geral de chamados</h1>
        <p>
          Situação em tempo real dos chamados de tecnologia da URE Leste 3.
          <span v-if="atualizadoEm">Atualizado às {{ atualizadoEm }}.</span>
        </p>
      </div>
      <button type="button" class="btn-atualizar" :disabled="carregando" @click="carregar">
        <RefreshCw :size="14" :class="{ spin: carregando }" />
        Atualizar
      </button>
    </header>

    <div v-if="erro" class="card aviso-erro">
      <p>{{ erro }}</p>
      <button type="button" class="btn btn-primary" @click="carregar">Tentar novamente</button>
    </div>

    <template v-else>
      <!-- KPIs -->
      <div class="kpi-grid">
        <StatCard label="Total de chamados" :value="dados?.kpis.total ?? '—'" tone="slate">
          <ClipboardList :size="22" />
        </StatCard>
        <StatCard label="Abertos" :value="dados?.kpis.abertos ?? '—'" tone="red">
          <AlertTriangle :size="22" />
        </StatCard>
        <StatCard label="Em atendimento" :value="dados?.kpis.andamento ?? '—'" tone="blue">
          <Clock :size="22" />
        </StatCard>
        <StatCard label="Aguardando escola" :value="dados?.kpis.comunicado ?? '—'" tone="purple">
          <School :size="22" />
        </StatCard>
        <StatCard label="Resolvidos" :value="dados?.kpis.resolvidos ?? '—'" tone="green">
          <CheckCircle2 :size="22" />
        </StatCard>
        <StatCard label="Alta prioridade" :value="dados?.kpis.altaPrioridade ?? '—'" tone="yellow">
          <AlertTriangle :size="22" />
        </StatCard>
      </div>

      <!-- Gráficos -->
      <div class="charts-grid">
        <DonutCard titulo="Chamados por situação" :fatias="porStatusRotulado" :cores="CORES_STATUS" center-label="chamados" />
        <DonutCard titulo="Chamados por urgência" :fatias="porUrgencia" :cores="CORES_URGENCIA" center-label="chamados" />
        <BarChartCard
          titulo="Resolvidos por técnico"
          sub="Chamados concluídos por cada técnico"
          horizontal
          :labels="resolvidosPorTecnico.labels"
          :series="resolvidosPorTecnico.series"
        />
      </div>

      <!-- Últimos chamados -->
      <div class="card table-card">
        <div class="table-header">
          <h3>Últimos chamados</h3>
          <RouterLink to="/chamado/novo" class="btn btn-primary">Abrir um chamado</RouterLink>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Protocolo</th>
                <th>Urgência</th>
                <th>Unidade</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Aberto em</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="carregando && !dados">
                <td colspan="6" class="td-center"><Loader2 class="spin" :size="18" /></td>
              </tr>
              <tr v-else-if="!ultimos.length">
                <td colspan="6" class="td-center">Nenhum chamado registrado até o momento.</td>
              </tr>
              <tr v-for="c in ultimos" :key="c.id">
                <td class="c-protocolo">{{ c.protocolo }}</td>
                <td>{{ c.urgencia.split(' ')[0] }}</td>
                <td>{{ truncar(c.unidade, 34) }}</td>
                <td>{{ truncar(c.tipo, 28) }}</td>
                <td><StatusPill :status="rotuloStatusChamado(c.status)" /></td>
                <td>{{ formatarData(c.timestamp) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </PublicoLayout>
</template>

<style scoped>
.cabecalho {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.cabecalho h1 {
  color: #fff;
  font-size: 24px;
}

.cabecalho p {
  margin: 6px 0 0;
  color: rgb(255 255 255 / 0.7);
  font-size: 13.5px;
}

.btn-atualizar {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 16px;
  border-radius: var(--radius-sm);
  background: rgb(255 255 255 / 0.09);
  border: 1px solid rgb(255 255 255 / 0.16);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  transition: background 0.15s ease;
  flex-shrink: 0;
}

.btn-atualizar:hover {
  background: rgb(255 255 255 / 0.18);
}

.btn-atualizar:disabled {
  opacity: 0.55;
  cursor: wait;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
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

.c-protocolo {
  font-weight: 700;
  color: var(--blue);
  white-space: nowrap;
}

.td-center {
  text-align: center;
  color: var(--text-muted);
  padding: 28px !important;
}

.aviso-erro {
  padding: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--red);
  font-weight: 500;
}

.aviso-erro p {
  margin: 0;
}

.spin {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
