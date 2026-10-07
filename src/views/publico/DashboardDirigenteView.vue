<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CheckCircle2, ClipboardList, Clock, Hourglass, RefreshCw, Star } from '@lucide/vue'
import PublicoLayout from '@/components/publico/PublicoLayout.vue'
import BarChartCard from '@/components/publico/BarChartCard.vue'
import DonutCard from '@/components/ui/DonutCard.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import { getDashboardMatriz, type DashboardMatriz } from '@/api/publico'
import { rotuloStatusChamado } from '@/api/chamados'
import { AUTO_REFRESH_MS, useAutoRefresh } from '@/composables/useAutoRefresh'

/* Espelha o conteúdo do "Painel do Setor" (DashboardDirigenteView) do sistema antigo,
 * agora como página pública do portal, lendo GET /dashboard/matriz. */

const dados = ref<DashboardMatriz | null>(null)
const carregando = ref(false)
const erro = ref('')
const atualizadoEm = ref('')

const STATUS_ORDEM = ['ABERTO', 'ANDAMENTO', 'COMUNICADO', 'RESOLVIDO'] as const
const CORES_STATUS_COD: Record<string, string> = {
  ABERTO: '#dc2626',
  ANDAMENTO: '#2563eb',
  COMUNICADO: '#9333ea',
  RESOLVIDO: '#16a34a',
}
const CORES_STATUS_ROTULO: Record<string, string> = {
  Aberto: '#dc2626',
  'Em atendimento': '#2563eb',
  'Aguardando escola': '#9333ea',
  'Concluído': '#16a34a',
}

const kpis = computed(() => dados.value?.kpis)
const emAtendimento = computed(() => (kpis.value ? kpis.value.andamento + kpis.value.comunicado : 0))
const taxaResolucao = computed(() =>
  kpis.value && kpis.value.total > 0 ? Math.round((kpis.value.resolvidos / kpis.value.total) * 100) : 0,
)

/* ------- Nota de atendimento ------- */
const avaliacoes = computed(() => dados.value?.avaliacoes)
const totalAvaliacoes = computed(() => avaliacoes.value?.total ?? 0)

/** Nota média formatada ("4,3/5") ou "—" enquanto ninguém avaliou. */
const notaAtendimento = computed(() => {
  const media = avaliacoes.value?.media
  return typeof media === 'number' ? `${media.toFixed(1).replace('.', ',')}/5` : '—'
})

const detalheNota = computed(() =>
  totalAvaliacoes.value === 1 ? '1 chamado avaliado' : `${totalAvaliacoes.value} chamados avaliados`,
)

/* ------- Chamados por categoria (barras empilhadas por status) ------- */
const porCategoria = computed(() => {
  const mapa = new Map<string, Record<string, number>>()
  for (const c of dados.value?.chamados || []) {
    const tipo = c.tipo || 'Outros'
    if (!mapa.has(tipo)) mapa.set(tipo, { ABERTO: 0, ANDAMENTO: 0, COMUNICADO: 0, RESOLVIDO: 0 })
    const linha = mapa.get(tipo)!
    linha[c.status] = (linha[c.status] || 0) + 1
  }
  const top = [...mapa.entries()]
    .map(([tipo, cont]) => ({ tipo, cont, total: Object.values(cont).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)
  return {
    labels: top.map((t) => (t.tipo.length > 30 ? t.tipo.slice(0, 29) + '…' : t.tipo)),
    series: STATUS_ORDEM.map((s) => ({
      label: rotuloStatusChamado(s),
      data: top.map((t) => t.cont[s] || 0),
      cor: CORES_STATUS_COD[s],
    })),
  }
})

/* ------- Situação geral (donut) ------- */
const porStatus = computed(() => {
  const out: Record<string, number> = {}
  const src = dados.value?.graficos.porStatus || {}
  for (const [status, qtd] of Object.entries(src)) {
    const label = rotuloStatusChamado(status)
    out[label] = (out[label] || 0) + qtd
  }
  return out
})

/* ------- Top 8 unidades (barras horizontais) ------- */
const porUnidade = computed(() => {
  const mapa = new Map<string, number>()
  for (const c of dados.value?.chamados || []) {
    mapa.set(c.unidade, (mapa.get(c.unidade) || 0) + 1)
  }
  const top = [...mapa.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  return {
    labels: top.map(([u]) => (u.length > 32 ? u.slice(0, 31) + '…' : u)),
    series: [{ label: 'Chamados', data: top.map(([, n]) => n), cor: '#081a33' }],
  }
})

/* ------- Resolvidos por técnico ------- */
const porTecnico = computed(() => {
  const entradas = Object.entries(dados.value?.graficos.resolvidosPorTecnico || {}).sort(
    (a, b) => b[1] - a[1],
  ).slice(0, 10)
  return {
    labels: entradas.map(([t]) => t),
    series: [{ label: 'Resolvidos', data: entradas.map(([, n]) => n), cor: '#2563eb' }],
  }
})

/* ------- Últimos chamados ------- */
const ultimos = computed(() => (dados.value?.chamados || []).slice(0, 5))

function formatarData(ts: string): string {
  const d = new Date(ts)
  if (isNaN(d.getTime())) return '—'
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

/** `silencioso`: atualização automática — não aciona spinner nem substitui os dados por erro. */
async function carregar(silencioso = false) {
  if (!silencioso) {
    carregando.value = true
    erro.value = ''
  }
  try {
    dados.value = await getDashboardMatriz()
    atualizadoEm.value = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    if (!silencioso) {
      erro.value = 'Não foi possível carregar os dados do painel. Verifique sua conexão e tente novamente.'
    }
  } finally {
    carregando.value = false
  }
}

onMounted(() => void carregar())

/* Atualização automática (pausada com a aba oculta, recarrega ao voltar). */
useAutoRefresh(() => carregar(true), AUTO_REFRESH_MS.normal)
</script>

<template>
  <PublicoLayout wide>
    <header class="cabecalho">
      <div>
        <p class="eyebrow">Unidade Regional de Ensino — Leste 3</p>
        <h1>Painel do Setor</h1>
        <p class="sub">
          Resumo geral dos chamados de tecnologia.
          <span v-if="atualizadoEm">Atualizado às {{ atualizadoEm }}.</span>
        </p>
      </div>
      <button type="button" class="btn-atualizar" :disabled="carregando" @click="carregar(false)">
        <RefreshCw :size="14" :class="{ spin: carregando }" />
        Atualizar
      </button>
    </header>

    <div v-if="erro" class="card aviso-erro">
      <p>{{ erro }}</p>
      <button type="button" class="btn btn-primary" @click="carregar(false)">Tentar novamente</button>
    </div>

    <template v-else>
      <!-- KPIs -->
      <div class="kpi-grid">
        <StatCard label="Total de chamados" :value="kpis?.total ?? '—'" tone="slate" detail="todos os registros">
          <ClipboardList :size="22" />
        </StatCard>
        <StatCard label="Aguardando atendimento" :value="kpis?.abertos ?? '—'" tone="yellow" detail="chamados em aberto">
          <Hourglass :size="22" />
        </StatCard>
        <StatCard label="Em atendimento" :value="emAtendimento" tone="blue" detail="andamento + aguardando">
          <Clock :size="22" />
        </StatCard>
        <StatCard
          label="Taxa de resolução"
          :value="taxaResolucao + '%'"
          tone="green"
          :detail="`${kpis?.resolvidos ?? 0} chamados resolvidos`"
        >
          <CheckCircle2 :size="22" />
        </StatCard>
        <StatCard label="Nota de atendimento" :value="notaAtendimento" tone="purple" :detail="detalheNota">
          <Star :size="22" />
        </StatCard>
      </div>

      <!-- Gráficos -->
      <div class="grade-2-1">
        <BarChartCard
          titulo="Chamados por categoria"
          sub="Distribuição por categoria e situação"
          empilhado
          legenda
          :labels="porCategoria.labels"
          :series="porCategoria.series"
        />
        <DonutCard titulo="Situação geral" :fatias="porStatus" :cores="CORES_STATUS_ROTULO" center-label="chamados" />
      </div>

      <div class="grade-1-1">
        <BarChartCard
          titulo="Chamados por unidade"
          sub="Unidades com mais chamados"
          horizontal
          :labels="porUnidade.labels"
          :series="porUnidade.series"
        />
        <BarChartCard
          titulo="Resolvidos por técnico"
          sub="Chamados concluídos por cada técnico"
          horizontal
          :labels="porTecnico.labels"
          :series="porTecnico.series"
        />
      </div>

      <!-- Últimos chamados -->
      <div class="card recentes">
        <h3 class="recentes-titulo">Últimos chamados recebidos</h3>
        <div class="lista-recentes">
          <div v-for="c in ultimos" :key="c.id" class="item-recente">
            <div class="item-esquerda">
              <span class="item-protocolo">{{ c.protocolo }}</span>
              <div class="item-textos">
                <p class="item-unidade">{{ c.unidade }}</p>
                <p class="item-tipo">{{ c.tipo }}</p>
              </div>
            </div>
            <div class="item-direita">
              <StatusPill :status="rotuloStatusChamado(c.status)" />
              <span class="item-data">{{ formatarData(c.timestamp) }}</span>
            </div>
          </div>
          <p v-if="!ultimos.length && !carregando" class="vazio">Nenhum chamado registrado até o momento.</p>
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

.eyebrow {
  margin: 0 0 2px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--blue);
}

.cabecalho h1 {
  color: var(--text-primary);
  font-size: 24px;
}

.sub {
  margin: 6px 0 0;
  color: var(--text-secondary);
  font-size: 13.5px;
}

.btn-atualizar {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border-strong);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  flex-shrink: 0;
}

.btn-atualizar:hover {
  border-color: var(--blue);
  color: var(--blue);
}

.btn-atualizar:disabled {
  opacity: 0.55;
  cursor: wait;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

.grade-2-1 {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.grade-1-1 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

@media (max-width: 900px) {
  .grade-2-1,
  .grade-1-1 {
    grid-template-columns: 1fr;
  }
}

.recentes {
  padding: 20px;
}

.recentes-titulo {
  font-size: 15px;
  margin-bottom: 14px;
}

.lista-recentes {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.item-recente {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: var(--surface-muted);
  border-radius: var(--radius-md);
}

.item-esquerda {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.item-protocolo {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted);
  white-space: nowrap;
}

.item-unidade {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-tipo {
  margin: 0;
  font-size: 11.5px;
  color: var(--text-muted);
}

.item-direita {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.item-data {
  font-size: 11.5px;
  color: var(--text-muted);
  white-space: nowrap;
}

.vazio {
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  padding: 18px 0;
  margin: 0;
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

@media (max-width: 640px) {
  .item-recente {
    flex-direction: column;
    align-items: flex-start;
  }
  .item-direita {
    width: 100%;
    justify-content: space-between;
  }
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
