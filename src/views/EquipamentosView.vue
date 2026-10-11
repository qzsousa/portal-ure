<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { computed } from 'vue'
import { Download, Eye, FileText, Pencil, Plus, Trash2, Search } from '@lucide/vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import RowActions from '@/components/ui/RowActions.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import EquipamentoFormModal from '@/components/equipamentos/EquipamentoFormModal.vue'
import GraficoCategorias from '@/components/equipamentos/GraficoCategorias.vue'
import { exportarCsv, exportarPdf, historicoEquipamento, removerEquipamento, type HistoricoItem } from '@/api/sce'
import { apiError } from '@/utils/apiError'
import { useEquipamentos } from '@/composables/useEquipamentos'
import { AUTO_REFRESH_MS, useAutoRefresh } from '@/composables/useAutoRefresh'
import { formatDateTime } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import type { Equipamento } from '@/types'

const eq = useEquipamentos(10)
const ui = useUiStore()
const auth = useAuthStore()

/**
 * Escola FILHA: o painel é compartilhado com a MÃE, mas é somente leitura.
 * O SCE bloqueia a mesma coisa na API — aqui os botões nem aparecem.
 */
const somenteLeitura = computed(() => auth.somenteLeituraEquipamentos)
const podeGerenciar = computed(
  () => !somenteLeitura.value && ['ADMIN', 'GESTOR'].includes(auth.user?.nivel || ''),
)
const podeCadastrar = computed(() => !somenteLeitura.value)

/** Nome da escola irmã com quem o painel é compartilhado (só para o aviso). */
const irmaDoGrupo = computed(() => {
  const u = auth.user
  if (!u?.grupo || !u.grupo.includes('/')) return ''
  const partes = u.grupo.split('/').map((s) => s.trim()).filter(Boolean)
  if (partes.length < 2) return ''
  return u.papelUnidade === 'FILHA' ? partes[0] : partes.slice(1).join(' / ')
})
/* GESTOR só enxerga a própria unidade — filtro de unidade não se aplica. */
const ehGestor = computed(() => auth.user?.nivel === 'GESTOR')

/* ---------- Filtros de marca e modelo (cascata) ---------- */

/**
 * Trocar a marca descarta um modelo que não pertence a ela: manter os dois
 * marcados deixaria a tela vazia sem explicação (nenhum equipamento tem
 * aquele par marca/modelo).
 */
function aplicarMarca() {
  if (!eq.filtros.modelo) return
  const atual = eq.filtros.modelo.trim().toLowerCase()
  if (!eq.modelosOpcoes.value.some((m) => m.trim().toLowerCase() === atual)) eq.filtros.modelo = ''
  eq.aplicarFiltros()
}

function limparModelo() {
  eq.filtros.modelo = ''
  eq.aplicarFiltros()
}

/** A lista de escolas só faz sentido com um modelo escolhido. */
const listaEscolasAberta = computed(() => eq.filtros.modelo.trim() !== '')

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
  formItem.value = item
  formAberto.value = true
}

async function confirmarRemover(item: Equipamento) {
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

/* ---------- Drilldown do gráfico de categorias ---------- */
const categoriaAberta = ref<string | null>(null)

/**
 * Modelos da categoria aberta, em "Marca Modelo" → quantidade.
 *
 * Sai dos agregados que a tela JÁ carregou (`stats.porModelo` na Matriz,
 * contagem local nos demais perfis). Por isso é exato por construção, não tem
 * requisição própria e não existe corrida entre cliques: é um retrato só do
 * estado — clicar Notebook e depois Tablet não deixa a resposta antiga
 * (Chromebook) aparecer sob o título novo.
 */
const detalheModelos = computed<Array<{ rotulo: string; qtd: number }>>(() => {
  if (!categoriaAberta.value) return []
  const mapa = new Map<string, number>()
  for (const m of eq.state.porModelo) {
    if (m.categoria !== categoriaAberta.value) continue
    const rotulo =
      [m.marca, m.modelo]
        .map((s) => (s || '').trim())
        .filter(Boolean)
        .join(' ') || 'Sem marca/modelo'
    /* Marcas/modelos que diferem só por espaço viram a mesma linha: sem esta
     * soma o v-for receberia rótulos repetidos. */
    mapa.set(rotulo, (mapa.get(rotulo) || 0) + m.qtd)
  }
  return [...mapa.entries()]
    .map(([rotulo, qtd]) => ({ rotulo, qtd }))
    .sort((a, b) => b.qtd - a.qtd)
})

function alternarCategoria(categoria: string) {
  categoriaAberta.value = categoriaAberta.value === categoria ? null : categoria
}

onMounted(() => {
  void eq.carregar()
})

/* Atualização automática: equipamentos recém-registrados no SCE aparecem sozinhos
 * (inclusive no drilldown aberto do gráfico, que sai dos mesmos agregados). */
useAutoRefresh(async () => {
  await eq.carregar(true)
}, AUTO_REFRESH_MS.rapido)
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
        <button v-if="podeCadastrar" class="btn btn-primary" type="button" @click="abrirCriar">
          <Plus :size="16" />
          Adicionar equipamento
        </button>
        <select v-model="eq.filtros.marca" class="select-input slim" @change="aplicarMarca">
          <option value="">Marca: Todas</option>
          <option v-for="m in eq.marcasOpcoes.value" :key="m" :value="m">{{ m }}</option>
        </select>
        <select v-model="eq.filtros.modelo" class="select-input slim" @change="eq.aplicarFiltros()">
          <option value="">Modelo: Todos</option>
          <option v-for="m in eq.modelosOpcoes.value" :key="m" :value="m">{{ m }}</option>
        </select>
        <select v-model="eq.filtros.status" class="select-input slim" @change="eq.aplicarFiltros()">
          <option value="">Status: Todos</option>
          <option v-for="s in Object.keys(eq.state.porStatus)" :key="s" :value="s">{{ s }}</option>
        </select>
        <select v-if="!ehGestor" v-model="eq.filtros.unidade" class="select-input slim" @change="eq.aplicarFiltros()">
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

    <!-- Escola FILHA: o parque é da MÃE, compartilhado no mesmo prédio -->
    <p v-if="somenteLeitura" class="aviso-leitura card">
      <Eye :size="16" />
      <span>
        Equipamentos compartilhados com {{ irmaDoGrupo || 'a escola principal do grupo' }} — sua unidade
        tem acesso <strong>somente de visualização</strong>. Para cadastrar, alterar ou remover, fale com a
        escola principal.
      </span>
    </p>

    <!-- Gráfico compacto: quantidade por categoria; clique abre os modelos -->
    <GraficoCategorias
      v-if="!eq.state.loading && eq.statsCarregadas.value"
      :fatias="eq.state.porCategoria"
      :aberta="categoriaAberta"
      :detalhe="detalheModelos"
      @selecionar="alternarCategoria"
    />

    <!-- Escolas que possuem o modelo escolhido: é o agregado porUnidade que o SCE
         já devolve restrito ao modelo — nenhuma contagem refeita aqui. -->
    <div v-if="listaEscolasAberta" class="card escolas-card">
      <div class="escolas-head">
        <h3 class="escolas-titulo">Escolas que possuem o modelo {{ eq.filtros.modelo }}</h3>
        <button class="btn-link" type="button" @click="limparModelo">
          Limpar modelo
        </button>
      </div>
      <p v-if="eq.state.loading" class="escolas-vazio">Carregando escolas...</p>
      <p v-else-if="eq.escolasDoModelo.value.length === 0" class="escolas-vazio">
        Nenhuma escola tem equipamentos deste modelo.
      </p>
      <ul v-else class="escolas-lista">
        <li v-for="e in eq.escolasDoModelo.value" :key="e.nome">
          <span class="escola-nome">{{ e.nome }}</span>
          <span class="escola-qtd">{{ e.qtd }}</span>
        </li>
      </ul>
    </div>

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
                <RowActions
                  :itens="[
                    { rotulo: 'Ver detalhes e histórico', acao: () => abrirDetalhe(item) },
                    ...(!somenteLeitura
                      ? [{ rotulo: 'Editar', icone: Pencil, acao: () => abrirEditar(item) }]
                      : []),
                    ...(podeGerenciar
                      ? [{ rotulo: 'Remover', icone: Trash2, perigo: true, acao: () => confirmarRemover(item) }]
                      : []),
                  ]"
                />
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

    <!-- Modal criar/editar (escola FILHA nunca chega aqui: os botões não existem) -->
    <EquipamentoFormModal
      :aberto="formAberto && !somenteLeitura"
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

/* Escolas que possuem o modelo escolhido */
.escolas-card {
  padding: 14px 16px;
}

.escolas-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.escolas-titulo {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.btn-link {
  background: none;
  border: none;
  padding: 0;
  color: var(--blue);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: underline;
}

.escolas-vazio {
  color: var(--text-muted);
  font-size: 13px;
  margin: 0;
}

.escolas-lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 6px 16px;
}

.escolas-lista li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.escola-nome {
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.escola-qtd {
  flex-shrink: 0;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--border);
  border-radius: 10px;
  padding: 1px 9px;
  font-size: 12px;
}

.aviso-leitura {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary);
  background: var(--blue-soft);
  border-color: var(--blue-soft);
}

.aviso-leitura :deep(svg) {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--blue);
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

@media (max-width: 640px) {
  /* Busca ocupa a linha inteira; ações/filtros quebram para a linha de baixo */
  .search-box {
    min-width: 0;
    width: 100%;
  }

  .detalhe-grid {
    grid-template-columns: 1fr;
  }
}
</style>
