<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { computed } from 'vue'
import { Download, FileText, MoreVertical, Pencil, Plus, Trash2, Search } from '@lucide/vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import EquipamentoFormModal from '@/components/equipamentos/EquipamentoFormModal.vue'
import { exportarCsv, exportarPdf, historicoEquipamento, removerEquipamento, type HistoricoItem } from '@/api/sce'
import { apiError } from '@/utils/apiError'
import { useEquipamentos } from '@/composables/useEquipamentos'
import { formatDateTime } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import type { Equipamento } from '@/types'

const eq = useEquipamentos(10)
const ui = useUiStore()
const auth = useAuthStore()

const podeGerenciar = computed(() => ['ADMIN', 'GESTOR'].includes(auth.user?.nivel || ''))

const menuAberto = ref<string | null>(null)
const detalheAberto = ref(false)
const detalheItem = ref<Equipamento | null>(null)
const historico = ref<HistoricoItem[]>([])
const carregandoHistorico = ref(false)
const exportando = ref(false)

/* CRUD */
const formAberto = ref(false)
const formItem = ref<Equipamento | null>(null)

function abrirCriar() {
  formItem.value = null
  formAberto.value = true
}

function abrirEditar(item: Equipamento) {
  menuAberto.value = null
  formItem.value = item
  formAberto.value = true
}

async function confirmarRemover(item: Equipamento) {
  menuAberto.value = null
  if (!window.confirm(`Remover o equipamento ${item.modelo} (${item.patrimonio || 's/ patrimônio'})?`)) return
  try {
    await removerEquipamento(item.id)
    ui.success('Equipamento removido.')
    await eq.carregar()
  } catch (e) {
    ui.error(apiError(e, 'Não foi possível remover o equipamento.'))
  }
}

async function aposSalvar() {
  await eq.carregar()
}

async function abrirDetalhe(item: Equipamento) {
  menuAberto.value = null
  detalheItem.value = item
  detalheAberto.value = true
  carregandoHistorico.value = true
  historico.value = []
  try {
    historico.value = await historicoEquipamento(item.id)
  } catch {
    historico.value = []
  } finally {
    carregandoHistorico.value = false
  }
}

async function baixarCsv() {
  exportando.value = true
  try {
    await exportarCsv()
    ui.success('CSV exportado com sucesso.')
  } catch {
    ui.error('Não foi possível exportar o CSV.')
  } finally {
    exportando.value = false
  }
}

async function baixarPdf() {
  exportando.value = true
  try {
    await exportarPdf()
    ui.success('PDF exportado com sucesso.')
  } catch {
    ui.error('Não foi possível exportar o PDF.')
  } finally {
    exportando.value = false
  }
}

function fecharMenu(e: MouseEvent) {
  if (!(e.target as HTMLElement).closest('.acoes-wrap')) menuAberto.value = null
}

onMounted(() => {
  void eq.carregar()
  document.addEventListener('click', fecharMenu)
})
</script>

<template>
  <div class="equip-page">
    <!-- Barra de busca e ações -->
    <div class="toolbar card">
      <div class="search-box">
        <Search :size="16" />
        <input
          v-model="eq.filtros.busca"
          placeholder="Buscar equipamento, patrimônio, nº de série..."
          @keyup.enter="eq.aplicarFiltros()"
        />
      </div>
      <div class="toolbar-actions">
        <button class="btn btn-primary" type="button" @click="abrirCriar">
          <Plus :size="16" />
          Adicionar equipamento
        </button>
        <select v-model="eq.filtros.status" class="select-input slim" @change="eq.aplicarFiltros()">
          <option value="">Status: Todos</option>
          <option v-for="s in Object.keys(eq.state.porStatus)" :key="s" :value="s">{{ s }}</option>
        </select>
        <select v-model="eq.filtros.unidade" class="select-input slim" @change="eq.aplicarFiltros()">
          <option value="">Unidade: Todas</option>
          <option v-for="u in eq.unidadesOpcoes.value" :key="u" :value="u">{{ u }}</option>
        </select>
        <button class="btn btn-outline" type="button" :disabled="exportando" @click="baixarCsv">
          <Download :size="16" />
          CSV
        </button>
        <button class="btn btn-outline" type="button" :disabled="exportando" @click="baixarPdf">
          <FileText :size="16" />
          PDF
        </button>
      </div>
    </div>

    <p v-if="eq.state.erro" class="erro card">{{ eq.state.erro }}</p>

    <!-- Tabela -->
    <div class="card table-card">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Equipamento</th>
              <th>Patrimônio</th>
              <th>Nº de Série</th>
              <th>Categoria</th>
              <th>Modelo</th>
              <th>Unidade Escolar</th>
              <th>Status</th>
              <th class="th-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="eq.state.loading">
              <td colspan="8" class="td-center">Carregando...</td>
            </tr>
            <tr v-else-if="eq.state.items.length === 0">
              <td colspan="8" class="td-center">Nenhum equipamento encontrado.</td>
            </tr>
            <tr v-for="item in eq.state.items" :key="item.id">
              <td>
                <strong class="eq-modelo">{{ item.modelo }}</strong>
                <span class="eq-sub">{{ item.categoria }} · {{ item.marca }}</span>
              </td>
              <td>{{ item.patrimonio || '—' }}</td>
              <td>{{ item.numeroSerie || '—' }}</td>
              <td>{{ item.categoria }}</td>
              <td>{{ item.modelo }}</td>
              <td>{{ item.unidade }}</td>
              <td><StatusPill :status="item.status" /></td>
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
                    <button type="button" @click="abrirEditar(item)">
                      <Pencil :size="14" /> Editar
                    </button>
                    <button v-if="podeGerenciar" type="button" class="danger" @click="confirmarRemover(item)">
                      <Trash2 :size="14" /> Remover
                    </button>
                  </div>
                </div>
              </td>
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

    <!-- Modal de detalhes -->
    <BaseModal
      :aberto="detalheAberto"
      :titulo="detalheItem ? `${detalheItem.modelo} — ${detalheItem.unidade}` : 'Detalhes'"
      @fechar="detalheAberto = false"
    >
      <div v-if="detalheItem" class="detalhe">
        <dl class="detalhe-grid">
          <div><dt>Patrimônio</dt><dd>{{ detalheItem.patrimonio || '—' }}</dd></div>
          <div><dt>Nº de série</dt><dd>{{ detalheItem.numeroSerie || '—' }}</dd></div>
          <div><dt>Categoria</dt><dd>{{ detalheItem.categoria }}</dd></div>
          <div><dt>Marca</dt><dd>{{ detalheItem.marca }}</dd></div>
          <div><dt>Status</dt><dd><StatusPill :status="detalheItem.status" /></dd></div>
          <div>
            <dt>Status manutenção</dt>
            <dd>{{ detalheItem.statusManutencao || '—' }}</dd>
          </div>
          <div><dt>Responsável atual</dt><dd>{{ detalheItem.responsavelAtual || '—' }}</dd></div>
          <div>
            <dt>Chamado vinculado</dt>
            <dd>{{ detalheItem.numeroChamadoManutencao || '—' }}</dd>
          </div>
        </dl>

        <h4 class="hist-title">Histórico de alterações</h4>
        <p v-if="carregandoHistorico" class="hist-vazio">Carregando histórico...</p>
        <p v-else-if="historico.length === 0" class="hist-vazio">Nenhuma alteração registrada.</p>
        <ul v-else class="hist-list">
          <li v-for="(h, i) in historico" :key="i">
            <strong>{{ h.campo }}</strong>
            <span>{{ h.valor_antigo || '—' }} → {{ h.valor_novo || '—' }}</span>
            <small>{{ h.autor }} · {{ formatDateTime(h.data) }}</small>
          </li>
        </ul>
      </div>
    </BaseModal>

    <!-- Modal criar/editar -->
    <EquipamentoFormModal
      :aberto="formAberto"
      :item="formItem"
      @fechar="formAberto = false"
      @salvo="aposSalvar"
    />
  </div>
</template>

<style scoped>
.equip-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
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

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.select-input.slim {
  width: auto;
  min-width: 150px;
}

.erro {
  padding: 14px 18px;
  color: var(--red);
  font-weight: 500;
}

.table-card {
  overflow: visible;
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
  display: flex;
  align-items: center;
  gap: 8px;
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

.acoes-menu button.danger {
  color: var(--red);
}

.acoes-menu button.danger:hover {
  background: var(--red-soft);
}

.detalhe-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 20px;
  margin: 0 0 20px;
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
