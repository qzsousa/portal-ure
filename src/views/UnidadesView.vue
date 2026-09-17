<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { AlertTriangle, Package, School, Search, Wrench } from '@lucide/vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import StatCard from '@/components/ui/StatCard.vue'
import { listarUnidadesResumo, type UnidadeResumo } from '@/api/sce'

const PAGE_SIZE = 10

const estado = reactive({
  loading: true,
  erro: '',
  items: [] as UnidadeResumo[],
  page: 1,
})

const busca = ref('')

/** Normaliza para busca sem distinção de maiúsculas/acentos. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') /* combining diacritics U+0300–U+036F */
}

const filtradas = computed(() => {
  const b = norm(busca.value.trim())
  if (!b) return estado.items
  return estado.items.filter((u) => norm(u.nome).includes(b))
})

const paginaAtual = computed(() => {
  const ini = (estado.page - 1) * PAGE_SIZE
  return filtradas.value.slice(ini, ini + PAGE_SIZE)
})

const totais = computed(() => ({
  unidades: estado.items.length,
  equipamentos: estado.items.reduce((acc, u) => acc + u.total, 0),
  manutencao: estado.items.reduce((acc, u) => acc + u.manutencao, 0),
  quebrados: estado.items.reduce((acc, u) => acc + u.quebrados, 0),
}))

watch(busca, () => {
  estado.page = 1
})

function fmt(v: number): string | number {
  if (estado.erro) return '—'
  return v
}

/** Código sequencial (001...) em relação à lista filtrada completa. */
function codigo(idxLocal: number): string {
  return String((estado.page - 1) * PAGE_SIZE + idxLocal + 1).padStart(3, '0')
}

async function carregar() {
  estado.loading = true
  estado.erro = ''
  try {
    estado.items = await listarUnidadesResumo()
  } catch {
    estado.items = []
    estado.erro =
      'Não foi possível carregar o resumo das unidades escolares. O serviço pode estar indisponível no momento — tente novamente mais tarde.'
  } finally {
    estado.loading = false
  }
}

onMounted(() => {
  void carregar()
})
</script>

<template>
  <div class="unidades-page">
    <!-- KPIs -->
    <div class="stats-grid">
      <StatCard label="Total de unidades" :value="estado.loading ? '…' : fmt(totais.unidades)" tone="blue">
        <School :size="22" />
      </StatCard>
      <StatCard label="Equipamentos" :value="estado.loading ? '…' : fmt(totais.equipamentos)" tone="purple">
        <Package :size="22" />
      </StatCard>
      <StatCard label="Em manutenção" :value="estado.loading ? '…' : fmt(totais.manutencao)" tone="yellow">
        <Wrench :size="22" />
      </StatCard>
      <StatCard label="Quebrados" :value="estado.loading ? '…' : fmt(totais.quebrados)" tone="red">
        <AlertTriangle :size="22" />
      </StatCard>
    </div>

    <!-- Busca -->
    <div class="toolbar card">
      <div class="search-box">
        <Search :size="16" />
        <input v-model="busca" placeholder="Buscar unidade escolar..." />
      </div>
    </div>

    <p v-if="estado.erro" class="erro card">{{ estado.erro }}</p>

    <!-- Tabela -->
    <div class="card table-card">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Unidade Escolar</th>
              <th>Diretoria</th>
              <th class="th-num">Total Equip.</th>
              <th class="th-num">Disponíveis</th>
              <th class="th-num">Manutenção</th>
              <th class="th-num">Quebrados</th>
              <th class="th-num">Extraviados</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="estado.loading">
              <td colspan="8" class="td-center">Carregando...</td>
            </tr>
            <tr v-else-if="paginaAtual.length === 0">
              <td colspan="8" class="td-center">
                {{ estado.erro ? 'Sem dados para exibir.' : 'Nenhuma unidade encontrada.' }}
              </td>
            </tr>
            <tr v-for="(u, i) in paginaAtual" :key="u.nome">
              <td class="nowrap"><strong>{{ codigo(i) }}</strong></td>
              <td>{{ u.nome }}</td>
              <td>—</td>
              <td class="td-num"><strong>{{ u.total }}</strong></td>
              <td class="td-num"><span class="num green">{{ u.disponiveis }}</span></td>
              <td class="td-num"><span class="num yellow">{{ u.manutencao }}</span></td>
              <td class="td-num"><span class="num red">{{ u.quebrados }}</span></td>
              <td class="td-num"><span class="num slate">{{ u.extraviados }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <PaginationBar
        :page="estado.page"
        :page-size="PAGE_SIZE"
        :total="filtradas.length"
        @change="(p) => { estado.page = p }"
      />
    </div>
  </div>
</template>

<style scoped>
.unidades-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 14px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  flex-wrap: wrap;
}

.search-box {
  flex: 1;
  min-width: 220px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  padding: 0 12px;
  color: var(--text-muted);
}

.search-box input {
  flex: 1;
  border: none;
  outline: none;
  padding: 10px 0;
  background: transparent;
  color: var(--text-primary);
}

.erro {
  padding: 14px 18px;
  color: var(--red);
  font-weight: 500;
}

.table-card {
  overflow: visible;
}

.nowrap {
  white-space: nowrap;
}

.td-center {
  text-align: center;
  color: var(--text-muted);
  padding: 28px !important;
}

.th-num,
.td-num {
  text-align: right;
  white-space: nowrap;
}

.num {
  font-weight: 700;
}

.num.green {
  color: var(--green);
}

.num.yellow {
  color: var(--yellow);
}

.num.red {
  color: var(--red);
}

.num.slate {
  color: var(--slate);
}
</style>
