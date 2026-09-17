<script setup lang="ts">
import { onMounted, ref } from 'vue'
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
import { listarCatalogo, pct } from '@/api/sce'

const eq = useEquipamentos(10)
const totalModelos = ref<number | null>(null)

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
  try {
    const catalogo = await listarCatalogo()
    totalModelos.value = catalogo.length
  } catch {
    totalModelos.value = null
  }
})
</script>

<template>
  <div class="painel">
    <!-- Filtros -->
    <div class="filtros card">
      <div class="field">
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

    <p v-if="eq.state.erro" class="erro card">{{ eq.state.erro }}</p>

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

    <!-- Cards auxiliares -->
    <div class="mini-grid">
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
      <div class="banner card">
        <div>
          <strong>Equipamentos em bom funcionamento impulsionam uma educação mais conectada.</strong>
          <span>Controle · Organização · Suporte</span>
        </div>
      </div>
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
  </div>
</template>

<style scoped>
.painel {
  display: flex;
  flex-direction: column;
  gap: 20px;
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
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 16px;
}

.mini-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
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

.banner {
  background: linear-gradient(135deg, var(--sidebar-bg) 0%, #12315e 100%);
  color: #fff;
  padding: 18px 20px;
  display: flex;
  align-items: center;
}

.banner strong {
  display: block;
  font-size: 14px;
  line-height: 1.4;
}

.banner span {
  font-size: 12px;
  color: var(--brand-gold);
  letter-spacing: 0.04em;
}

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
</style>
