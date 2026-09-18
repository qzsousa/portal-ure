<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CheckCircle2, Clock, Loader2, MoreVertical, Wrench } from '@lucide/vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import { listarEquipamentosDaFilial, historicoEquipamento, type HistoricoItem } from '@/api/sce'
import { formatDateTime } from '@/utils/format'
import type { Equipamento } from '@/types'

const carregando = ref(true)
const erro = ref('')
const todos = ref<Equipamento[]>([])
const filtroStatus = ref('')
const page = ref(1)
const PAGE_SIZE = 10

/** Itens em manutenção: status "Manutenção" OU com statusManutencao registrado. */
const itensManutencao = computed(() =>
  todos.value.filter((e) => e.status === 'Manutenção' || (e.statusManutencao && e.statusManutencao !== '')),
)

const filtrados = computed(() =>
  filtroStatus.value
    ? itensManutencao.value.filter((e) => (e.statusManutencao || (e.status === 'Manutenção' ? 'Manutenção' : '')) === filtroStatus.value)
    : itensManutencao.value,
)

const pagina = computed(() =>
  filtrados.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE),
)

const kpis = computed(() => ({
  emManutencao: todos.value.filter((e) => e.status === 'Manutenção').length,
  pendente: itensManutencao.value.filter((e) => e.statusManutencao === 'Pendente').length,
  andamento: itensManutencao.value.filter((e) => e.statusManutencao === 'Em andamento').length,
  concluido: itensManutencao.value.filter((e) => e.statusManutencao === 'Concluído').length,
}))

const statusOpcoes = ['Pendente', 'Em andamento', 'Concluído']

/* Detalhe */
const menuAberto = ref<string | null>(null)
const detalheAberto = ref(false)
const detalheItem = ref<Equipamento | null>(null)
const historico = ref<HistoricoItem[]>([])

async function abrirDetalhe(item: Equipamento) {
  menuAberto.value = null
  detalheItem.value = item
  detalheAberto.value = true
  historico.value = []
  try {
    historico.value = await historicoEquipamento(item.id)
  } catch {
    historico.value = []
  }
}

function fecharMenu(e: MouseEvent) {
  if (!(e.target as HTMLElement).closest('.acoes-wrap')) menuAberto.value = null
}

function mudarStatusFiltro(s: string) {
  filtroStatus.value = s
  page.value = 1
}

onMounted(async () => {
  try {
    todos.value = await listarEquipamentosDaFilial()
  } catch {
    erro.value = 'Não foi possível carregar os equipamentos em manutenção.'
  } finally {
    carregando.value = false
  }
  document.addEventListener('click', fecharMenu)
})
</script>

<template>
  <div class="manut-page">
    <p v-if="erro" class="erro card">{{ erro }}</p>

    <!-- KPIs -->
    <div class="stats-grid">
      <StatCard label="Equipamentos em manutenção" :value="carregando ? '…' : kpis.emManutencao" tone="yellow">
        <Wrench :size="22" />
      </StatCard>
      <StatCard label="Pendente" :value="carregando ? '…' : kpis.pendente" tone="red">
        <Clock :size="22" />
      </StatCard>
      <StatCard label="Em atendimento" :value="carregando ? '…' : kpis.andamento" tone="blue">
        <Loader2 :size="22" />
      </StatCard>
      <StatCard label="Concluídos" :value="carregando ? '…' : kpis.concluido" tone="green">
        <CheckCircle2 :size="22" />
      </StatCard>
    </div>

    <!-- Filtro -->
    <div class="filtro-bar card">
      <label>Status:</label>
      <select :value="filtroStatus" class="select-input slim" @change="mudarStatusFiltro(($event.target as HTMLSelectElement).value)">
        <option value="">Todos</option>
        <option v-for="s in statusOpcoes" :key="s" :value="s">{{ s }}</option>
      </select>
    </div>

    <!-- Tabela -->
    <div class="card table-card">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Equipamento</th>
              <th>Patrimônio</th>
              <th>Unidade Escolar</th>
              <th>Descrição</th>
              <th>Status</th>
              <th class="th-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="carregando">
              <td colspan="7" class="td-center">Carregando...</td>
            </tr>
            <tr v-else-if="pagina.length === 0">
              <td colspan="7" class="td-center">Nenhum equipamento em manutenção.</td>
            </tr>
            <tr v-for="item in pagina" :key="item.id">
              <td class="nowrap">{{ formatDateTime(item.dataUltimaAtualizacao) }}</td>
              <td>
                <strong class="eq-modelo">{{ item.modelo }}</strong>
                <span class="eq-sub">{{ item.categoria }} · {{ item.marca }}</span>
              </td>
              <td>{{ item.patrimonio || '—' }}</td>
              <td>{{ item.unidade }}</td>
              <td class="desc-cell">{{ item.descricaoQuebrado || '—' }}</td>
              <td><StatusPill :status="item.statusManutencao || 'Manutenção'" /></td>
              <td class="td-acoes">
                <div class="acoes-wrap">
                  <button
                    class="acoes-btn"
                    type="button"
                    @click.stop="menuAberto = menuAberto === item.id ? null : item.id"
                  >
                    <MoreVertical :size="17" />
                  </button>
                  <div v-if="menuAberto === item.id" class="acoes-menu">
                    <button type="button" @click="abrirDetalhe(item)">Ver detalhes e histórico</button>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <PaginationBar
        :page="page"
        :page-size="PAGE_SIZE"
        :total="filtrados.length"
        @change="(p) => (page = p)"
      />
    </div>

    <!-- Modal de detalhes -->
    <BaseModal
      :aberto="detalheAberto"
      :titulo="detalheItem ? `${detalheItem.modelo} — ${detalheItem.unidade}` : 'Detalhes'"
      @fechar="detalheAberto = false"
    >
      <div v-if="detalheItem">
        <dl class="detalhe-grid">
          <div><dt>Patrimônio</dt><dd>{{ detalheItem.patrimonio || '—' }}</dd></div>
          <div><dt>Nº de série</dt><dd>{{ detalheItem.numeroSerie || '—' }}</dd></div>
          <div><dt>Status manutenção</dt><dd>{{ detalheItem.statusManutencao || '—' }}</dd></div>
          <div>
            <dt>Chamado vinculado</dt>
            <dd>{{ detalheItem.numeroChamadoManutencao || '—' }}</dd>
          </div>
        </dl>
        <h4 class="hist-title">Histórico de alterações</h4>
        <p v-if="historico.length === 0" class="hist-vazio">Nenhuma alteração registrada.</p>
        <ul v-else class="hist-list">
          <li v-for="(h, i) in historico" :key="i">
            <strong>{{ h.campo }}</strong>
            <span>{{ h.valor_antigo || '—' }} → {{ h.valor_novo || '—' }}</span>
            <small>{{ h.autor }} · {{ formatDateTime(h.data) }}</small>
          </li>
        </ul>
      </div>
    </BaseModal>
  </div>
</template>

<style scoped>
.manut-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}

.filtro-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
}

.filtro-bar label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.select-input.slim {
  width: auto;
  min-width: 160px;
}

.erro {
  padding: 14px 18px;
  color: var(--red);
  font-weight: 500;
}

.nowrap {
  white-space: nowrap;
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

.desc-cell {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.td-center {
  text-align: center;
  color: var(--text-muted);
  padding: 28px !important;
}

.th-acoes,
.td-acoes {
  width: 60px;
  text-align: center;
}

.acoes-wrap {
  position: relative;
  display: inline-block;
}

.acoes-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: var(--text-secondary);
}

.acoes-btn:hover {
  background: var(--surface-muted);
}

.acoes-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-lg);
  z-index: 60;
  min-width: 210px;
  padding: 6px;
}

.acoes-menu button {
  display: block;
  width: 100%;
  text-align: left;
  padding: 9px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.acoes-menu button:hover {
  background: var(--surface-muted);
}

.detalhe-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 20px;
  margin: 0 0 18px;
}

.detalhe-grid dt {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 2px;
}

.detalhe-grid dd {
  margin: 0;
  font-size: 13.5px;
  color: var(--text-primary);
}

.hist-title {
  font-size: 14px;
  margin: 0 0 10px;
}

.hist-vazio {
  color: var(--text-muted);
  font-size: 13px;
}

.hist-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hist-list li {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.hist-list strong {
  color: var(--text-primary);
}

.hist-list small {
  color: var(--text-muted);
}
</style>
