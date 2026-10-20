<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { computed } from 'vue'
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  CornerUpLeft,
  Download,
  Eye,
  FileText,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Trash2,
  Search,
  Wrench,
  X,
} from '@lucide/vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import RowActions from '@/components/ui/RowActions.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import EquipamentoFormModal from '@/components/equipamentos/EquipamentoFormModal.vue'
import GraficoCategorias from '@/components/equipamentos/GraficoCategorias.vue'
import MovimentacaoModal from '@/components/equipamentos/MovimentacaoModal.vue'
import ManutencaoModal from '@/components/equipamentos/ManutencaoModal.vue'
import {
  atualizarEquipamento,
  exportarCsv,
  exportarPdf,
  historicoEquipamento,
  removerEquipamento,
  type HistoricoItem,
} from '@/api/sce'
import { apiError } from '@/utils/apiError'
import { classeLinhaStatus } from '@/utils/linhaStatus'
import { useEquipamentos, type OrdemEquipamento } from '@/composables/useEquipamentos'
import { AUTO_REFRESH_MS, useAutoRefresh } from '@/composables/useAutoRefresh'
import { formatDate, formatDateTime } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import type { Equipamento } from '@/types'

const eq = useEquipamentos(10)
const ui = useUiStore()
const auth = useAuthStore()

/**
 * Escola FILHA: o painel é compartilhado com a Mãe, mas é somente leitura.
 * O SCE bloqueia a mesma coisa na API — aqui os botões nem aparecem.
 */
const somenteLeitura = computed(() => auth.somenteLeituraEquipamentos)
const podeGerenciar = computed(
  () => !somenteLeitura.value && ['ADMIN', 'GESTOR'].includes(auth.user?.nivel || ''),
)
const podeCadastrar = computed(() => !somenteLeitura.value)

/**
 * Emprestar e devolver ficam restritos a ADMIN e GESTOR.
 *
 * A movimentação carrega CPF, e-mail e destino de terceiros: é um registro de
 * responsabilidade sobre o bem da rede, não uma edição de cadastro. O Técnico
 * continua editando o equipamento normalmente, como antes — o que muda é só
 * que ele não abre empréstimo em nome de ninguém.
 */
const podeMovimentar = computed(
  () => !somenteLeitura.value && ['ADMIN', 'GESTOR'].includes(auth.user?.nivel || ''),
)

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
  aplicarFiltros()
}

function limparModelo() {
  eq.filtros.modelo = ''
  aplicarFiltros()
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

/* ---------- Seleção múltipla e ações em lote ---------- */

/** Ids marcados. Limpa sozinha ao trocar de página — como fazia o SCE. */
const selecionados = ref<Set<string>>(new Set())

const idsDaPagina = computed(() => eq.state.items.map((i) => i.id))
const selecionadosDaPagina = computed(() => idsDaPagina.value.filter((id) => selecionados.value.has(id)))
const todosMarcados = computed(
  () => idsDaPagina.value.length > 0 && selecionadosDaPagina.value.length === idsDaPagina.value.length,
)
const algumMarcado = computed(() => selecionadosDaPagina.value.length > 0)
const totalMarcado = computed(() => selecionados.value.size)

/** Itens marcados, na ordem em que aparecem na tela (e não do clique). */
const itensSelecionados = computed(() => eq.state.items.filter((i) => selecionados.value.has(i.id)))

function marcarItem(id: string, marcado: boolean) {
  const novo = new Set(selecionados.value)
  if (marcado) novo.add(id)
  else novo.delete(id)
  selecionados.value = novo
}

function marcarPagina(marcado: boolean) {
  const novo = new Set(selecionados.value)
  for (const id of idsDaPagina.value) {
    if (marcado) novo.add(id)
    else novo.delete(id)
  }
  selecionados.value = novo
}

function limparSelecao() {
  if (selecionados.value.size) selecionados.value = new Set()
}

/* Movimentos e manutenção (modal único, um item ou o lote inteiro) */
const movimentacaoAberta = ref(false)
const movimentacaoModo = ref<'emprestar' | 'devolver'>('emprestar')
const movimentacaoItens = ref<Equipamento[]>([])

function abrirEmprestimo(itens: Equipamento[]) {
  movimentacaoItens.value = itens
  movimentacaoModo.value = 'emprestar'
  movimentacaoAberta.value = true
}

function abrirDevolucao(itens: Equipamento[]) {
  movimentacaoItens.value = itens
  movimentacaoModo.value = 'devolver'
  movimentacaoAberta.value = true
}

const manutencaoAberta = ref(false)
const manutencaoItem = ref<Equipamento | null>(null)

function abrirManutencao(item: Equipamento) {
  manutencaoItem.value = item
  manutencaoAberta.value = true
}

/**
 * Ações do kebab da linha, na mesma ordem do SCE (editar → manutenção →
 * empréstimo/devolução → remover). "Emprestar" e "Devolver" só aparecem para
 * quem não está em modo leitura; "Remover" é exclusivo de quem administra.
 */
function acoesDaLinha(item: Equipamento) {
  return [
    { rotulo: 'Ver detalhes e histórico', acao: () => abrirDetalhe(item) },
    ...(somenteLeitura.value
      ? []
      : [
          { rotulo: 'Editar', icone: Pencil, acao: () => abrirEditar(item) },
          { rotulo: 'Manutenção', icone: Wrench, acao: () => abrirManutencao(item) },
        ]),
    ...(podeMovimentar.value
      ? [
          {
            rotulo: item.emprestimo ? 'Devolver' : 'Emprestar',
            icone: item.emprestimo ? CornerUpLeft : ArrowLeftRight,
            acao: () => (item.emprestimo ? abrirDevolucao([item]) : abrirEmprestimo([item])),
          },
        ]
      : []),
    ...(podeGerenciar.value
      ? [{ rotulo: 'Remover', icone: Trash2, perigo: true, acao: () => confirmarRemover(item) }]
      : []),
  ]
}

/* Alteração de status em lote */
const STATUS_LOTE = ['Disponível', 'Manutenção', 'Quebrado', 'Extraviado']
const statusLote = ref('')
const aplicandoLote = ref(false)

/**
 * Aplica o status escolhido a todos os marcados.
 *
 * Não existe endpoint em lote no SCE: vai um `update-equipamento` por item, e
 * alguns status são recusados pelo servidor quando o campo obrigatório
 * correspondente (nº do chamado, B.O., descrição da avaria) está vazio. Por
 * isso o relatório é por contagem — esconder a falha parcial faz o usuário
 * acreditar que a planilha inteira foi atualizada.
 */
async function aplicarStatusLote() {
  const alvo = statusLote.value
  const itens = itensSelecionados.value
  if (!alvo || itens.length === 0) return
  if (!window.confirm(`Alterar o status de ${itens.length} equipamento(s) para "${alvo}"?`)) return

  aplicandoLote.value = true
  try {
    const resultados = await Promise.allSettled(
      itens.map((i) => atualizarEquipamento(i.id, { status: alvo })),
    )
    const ok = resultados.filter((r) => r.status === 'fulfilled').length
    const falhas = resultados.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    if (ok === 0) {
      ui.error(
        falhas[0]
          ? apiError(falhas[0].reason, 'Não foi possível alterar o status.')
          : 'Não foi possível alterar o status.',
      )
    } else if (falhas.length > 0) {
      const motivo = falhas[0] ? apiError(falhas[0].reason, 'Falhou.') : 'Falhou.'
      ui.error(`${ok} de ${itens.length} atualizados. ${motivo}`)
    } else {
      ui.success(`Status alterado para ${itens.length} equipamento(s).`)
    }
    statusLote.value = ''
    limparSelecao()
    await eq.carregar()
  } finally {
    aplicandoLote.value = false
  }
}

async function excluirSelecionados() {
  const itens = itensSelecionados.value
  if (itens.length === 0) return
  const pergunta =
    itens.length === 1
      ? 'Tem certeza que deseja excluir o equipamento selecionado? Esta ação não pode ser desfeita.'
      : `Tem certeza que deseja excluir ${itens.length} equipamento(s) selecionado(s)? Esta ação não pode ser desfeita.`
  if (!window.confirm(pergunta)) return

  const resultados = await Promise.allSettled(itens.map((i) => removerEquipamento(i.id)))
  const ok = resultados.filter((r) => r.status === 'fulfilled').length
  if (ok > 0) ui.success(`${ok} equipamento(s) excluído(s).`)
  const falhas = resultados.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
  if (falhas.length > 0) {
    const motivo = falhas[0] ? apiError(falhas[0].reason, 'Falha ao excluir.') : 'Falha ao excluir.'
    ui.error(falhas.length === 1 ? motivo : `${falhas.length} não puderam ser excluídos. ${motivo}`)
  }
  limparSelecao()
  await eq.carregar()
}

/* ---------- Ordenação, tamanho de página, atualizar e imprimir ---------- */

const OPCOES_PAGINA = [10, 25, 50, 100]

/** Classes do cabeçalho: `sortable` no clique, `ativo` na coluna em uso. */
function thOrdem(coluna: OrdemEquipamento) {
  return {
    sortable: true,
    ativo: eq.ordem.value === coluna,
  }
}

/** Seta do sentido, desenhada só na coluna em uso. */
function setaOrdem(coluna: OrdemEquipamento): 'up' | 'down' | '' {
  if (eq.ordem.value !== coluna) return ''
  return eq.direcao.value === 'asc' ? 'up' : 'down'
}

const atualizando = ref(false)

/** Recarga manual: o SCE tinha o botão "Atualizar" e a tela precisa dele. */
async function atualizar() {
  atualizando.value = true
  try {
    await eq.carregar()
  } finally {
    atualizando.value = false
  }
}

/* Data impressa no cabeçalho do papel — congelada, não atualiza a cada minuto. */
const impressoEm = ref('')

function imprimir() {
  impressoEm.value = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  window.print()
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

/**
 * Trocar de página descarta a seleção: os ids marcados eram de uma página que
 * não está mais na tela, e o usuário não teria como desmarcar.
 */
function mudarPagina(p: number) {
  limparSelecao()
  eq.irParaPagina(p)
}

/**
 * Aplicar filtro também descarta a seleção. Filtrar troca o conjunto inteiro
 * de itens: os ids marcados saem da lista e o contador da barra de lote ficaria
 * mostrando um número que não corresponde a nenhuma linha visível.
 */
function aplicarFiltros() {
  limparSelecao()
  eq.aplicarFiltros()
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
    <!-- Cabeçalho de impressão: só aparece no papel. -->
    <div class="print-cabecalho">
      <h2>PORTAL URE LESTE 3 — Relação de equipamentos</h2>
      <p v-if="impressoEm">Gerado em {{ impressoEm }}</p>
    </div>

    <!-- Barra de busca e ações -->
    <div class="toolbar card no-print">
      <div class="search-box">
        <Search :size="16" />
        <input
          v-model="eq.filtros.busca"
          placeholder="Buscar equipamento, patrimônio, nº de série..."
          @keyup.enter="aplicarFiltros"
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
        <select v-model="eq.filtros.modelo" class="select-input slim" @change="aplicarFiltros">
          <option value="">Modelo: Todos</option>
          <option v-for="m in eq.modelosOpcoes.value" :key="m" :value="m">{{ m }}</option>
        </select>
        <select v-model="eq.filtros.status" class="select-input slim" @change="aplicarFiltros">
          <option value="">Status: Todos</option>
          <option v-for="s in Object.keys(eq.state.porStatus)" :key="s" :value="s">{{ s }}</option>
        </select>
        <select v-if="!ehGestor" v-model="eq.filtros.unidade" class="select-input slim" @change="aplicarFiltros">
          <option value="">Unidade: Todas</option>
          <option v-for="u in eq.unidadesOpcoes.value" :key="u" :value="u">{{ u }}</option>
        </select>
        <span class="total-evidente">Total: {{ eq.state.total.toLocaleString('pt-BR') }}</span>
        <button
          class="btn btn-outline"
          type="button"
          :disabled="atualizando"
          title="Atualizar a lista"
          @click="atualizar"
        >
          <RefreshCw :size="16" :class="{ spin: atualizando }" />
          Atualizar
        </button>
        <button class="btn btn-outline" type="button" title="Imprimir a relação" @click="imprimir">
          <Printer :size="16" />
          Imprimir
        </button>
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

    <!-- Escola FILHA: o parque é da Mãe, compartilhado no mesmo prédio -->
    <p v-if="somenteLeitura" class="aviso-leitura card no-print">
      <Eye :size="16" />
      <span>
        Equipamentos compartilhados com {{ irmaDoGrupo || 'a escola principal do grupo' }} — sua unidade
        tem acesso <strong>somente de visualização</strong>. Para cadastrar, alterar ou remover, fale com a
        escola principal.
      </span>
    </p>

    <!-- Ações em lote: só existe com seleção, como no SCE. -->
    <div v-if="!somenteLeitura && totalMarcado > 0" class="lote card no-print">
      <span class="lote-contagem">
        <strong>{{ totalMarcado }}</strong> equipamento(s) selecionado(s)
      </span>

      <div class="lote-acoes">
        <button v-if="podeMovimentar" class="btn btn-outline" type="button" @click="abrirEmprestimo(itensSelecionados)">
          <ArrowLeftRight :size="16" />
          Emprestar
        </button>
        <button v-if="podeMovimentar" class="btn btn-outline" type="button" @click="abrirDevolucao(itensSelecionados)">
          <CornerUpLeft :size="16" />
          Devolver
        </button>

        <span class="lote-status">
          <select v-model="statusLote" class="select-input slim">
            <option value="" disabled>Alterar status em lote para...</option>
            <option v-for="s in STATUS_LOTE" :key="s" :value="s">{{ s }}</option>
          </select>
          <button
            class="btn btn-outline"
            type="button"
            :disabled="!statusLote || aplicandoLote"
            @click="aplicarStatusLote"
          >
            Aplicar
          </button>
        </span>

        <button v-if="podeGerenciar" class="btn btn-perigo" type="button" @click="excluirSelecionados">
          <Trash2 :size="16" />
          Excluir selecionados
        </button>

        <button class="btn-link" type="button" @click="limparSelecao">
          <X :size="14" />
          Limpar seleção
        </button>
      </div>
    </div>

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

    <div class="chips" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
      <button
        v-for="s in Object.keys(eq.state.porStatus)"
        :key="s"
        type="button"
        class="chip"
        :class="{ ativo: eq.filtros.status === s }"
        @click="eq.filtros.status = eq.filtros.status === s ? '' : s; eq.aplicarFiltros()"
      >
        {{ s }} ({{ eq.state.porStatus[s] }})
      </button>
      <button
        type="button"
        class="chip"
        :class="{ ativo: eq.filtros.status === '' }"
        @click="eq.filtros.status = ''; eq.aplicarFiltros()"
      >
        Todos
      </button>
    </div>

    <!-- Tabela -->
    <div class="card table-card">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th v-if="!somenteLeitura" class="th-check">
                <input
                  type="checkbox"
                  :checked="todosMarcados"
                  :indeterminate.prop="algumMarcado && !todosMarcados"
                  :disabled="idsDaPagina.length === 0"
                  aria-label="Selecionar todos os equipamentos da página"
                  @change="marcarPagina(($event.target as HTMLInputElement).checked)"
                />
              </th>
              <th :class="thOrdem('numeroSerie')">
                <button type="button" class="th-sort" @click="eq.alternarOrdem('numeroSerie')">
                  Nº de Série
                  <ChevronUp v-if="setaOrdem('numeroSerie') === 'up'" :size="13" />
                  <ChevronDown v-else-if="setaOrdem('numeroSerie') === 'down'" :size="13" />
                </button>
              </th>
              <th :class="thOrdem('patrimonio')">
                <button type="button" class="th-sort" @click="eq.alternarOrdem('patrimonio')">
                  Patrimônio
                  <ChevronUp v-if="setaOrdem('patrimonio') === 'up'" :size="13" />
                  <ChevronDown v-else-if="setaOrdem('patrimonio') === 'down'" :size="13" />
                </button>
              </th>
              <th :class="thOrdem('unidade')">
                <button type="button" class="th-sort" @click="eq.alternarOrdem('unidade')">
                  Unidade Escolar
                  <ChevronUp v-if="setaOrdem('unidade') === 'up'" :size="13" />
                  <ChevronDown v-else-if="setaOrdem('unidade') === 'down'" :size="13" />
                </button>
              </th>
              <th :class="thOrdem('status')">
                <button type="button" class="th-sort" @click="eq.alternarOrdem('status')">
                  Status
                  <ChevronUp v-if="setaOrdem('status') === 'up'" :size="13" />
                  <ChevronDown v-else-if="setaOrdem('status') === 'down'" :size="13" />
                </button>
              </th>
              <th class="th-acoes no-print">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="eq.state.loading">
              <td :colspan="somenteLeitura ? 5 : 6" class="td-center">Carregando...</td>
            </tr>
            <tr v-else-if="eq.state.items.length === 0">
              <td :colspan="somenteLeitura ? 5 : 6" class="td-center">Nenhum equipamento encontrado.</td>
            </tr>
            <tr
              v-for="item in eq.state.items"
              :key="item.id"
              :class="classeLinhaStatus(item.status)"
            >
              <td v-if="!somenteLeitura" class="td-check">
                <input
                  type="checkbox"
                  :checked="selecionados.has(item.id)"
                  :aria-label="`Selecionar ${item.modelo}`"
                  @change="marcarItem(item.id, ($event.target as HTMLInputElement).checked)"
                />
              </td>
              <td>
                <strong class="eq-modelo">{{ item.numeroSerie || item.patrimonio || '—' }}</strong>
                <span class="eq-sub">{{ item.modelo }} · {{ item.marca }} · {{ item.categoria }}</span>
              </td>
              <td>{{ item.patrimonio || '—' }}</td>
              <td>{{ item.unidade }}</td>
              <td>
                <StatusPill :status="item.status" />
                <span v-if="item.emprestimo?.emAtraso" class="badge-atraso">
                  {{ item.emprestimo.diasAtraso }} dia(s) em atraso
                </span>
              </td>
              <td class="td-acoes no-print">
                <RowActions
                  :itens="acoesDaLinha(item)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="tabela-rodape no-print">
        <label class="pagina-tamanho">
          Exibir
          <select
            :value="eq.pageSize.value"
            class="select-input slim"
            @change="eq.definirPageSize(Number(($event.target as HTMLSelectElement).value))"
          >
            <option v-for="n in OPCOES_PAGINA" :key="n" :value="n">{{ n }}</option>
          </select>
          por página
        </label>
        <PaginationBar
          :page="eq.state.page"
          :page-size="eq.pageSize.value"
          :total="eq.state.total"
          @change="mudarPagina"
        />
      </div>
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
          <div><dt>Nº da etiqueta</dt><dd>{{ detalheItem.numeroEtiqueta || '—' }}</dd></div>
          <div><dt>Categoria</dt><dd>{{ detalheItem.categoria }}</dd></div>
          <div><dt>Marca</dt><dd>{{ detalheItem.marca }}</dd></div>
          <div><dt>Status</dt><dd><StatusPill :status="detalheItem.status" /></dd></div>
          <div>
            <dt>Status manutenção</dt>
            <dd>{{ detalheItem.statusManutencao || '—' }}</dd>
          </div>
          <div>
            <dt>Vinculado no BlueMonitor</dt>
            <dd>{{ detalheItem.vinculadoBlueMonitor || 'Não' }}</dd>
          </div>
          <div><dt>Responsável atual</dt><dd>{{ detalheItem.responsavelAtual || '—' }}</dd></div>
          <div>
            <dt>Chamado vinculado</dt>
            <dd>{{ detalheItem.numeroChamadoManutencao || '—' }}</dd>
          </div>
        </dl>

        <h4 class="hist-title">Empréstimo</h4>
        <p v-if="!detalheItem.emprestimo" class="hist-vazio">Este equipamento não está emprestado.</p>
        <dl v-else class="emprestimo-grid">
          <div><dt>Responsável</dt><dd>{{ detalheItem.emprestimo.responsavel || '—' }}</dd></div>
          <div><dt>CPF</dt><dd>{{ detalheItem.emprestimo.cpf || '—' }}</dd></div>
          <div>
            <dt>E-mail</dt>
            <dd>{{ detalheItem.emprestimo.emailResponsavel || '—' }}</dd>
          </div>
          <div>
            <dt>Emprestado em</dt>
            <dd>{{ formatDateTime(detalheItem.emprestimo.dataEmprestimo) }}</dd>
          </div>
          <div>
            <dt>Previsto para devolução</dt>
            <dd>
              {{ formatDate(detalheItem.emprestimo.dataPrevistaDevolucao) }}
              <span v-if="detalheItem.emprestimo.emAtraso" class="badge-atraso">
                {{ detalheItem.emprestimo.diasAtraso }} dia(s) em atraso
              </span>
            </dd>
          </div>
          <div>
            <dt>Tipo</dt>
            <dd>
              {{ detalheItem.emprestimo.tipoEmprestimo === 'interestadual' ? 'Inter-escolar' : 'Interno' }}
              <template v-if="detalheItem.emprestimo.escolaDestino">
                — {{ detalheItem.emprestimo.escolaDestino }}
              </template>
            </dd>
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

    <!-- Empréstimo / devolução — uma linha ou o lote marcado -->
    <MovimentacaoModal
      :aberto="movimentacaoAberta"
      :modo="movimentacaoModo"
      :itens="movimentacaoItens"
      @fechar="movimentacaoAberta = false"
      @concluido="aposSalvar"
    />

    <!-- Manutenção: registra e acompanha os registros do equipamento -->
    <ManutencaoModal
      :aberto="manutencaoAberta && !somenteLeitura"
      :item="manutencaoItem"
      @fechar="manutencaoAberta = false"
      @registrado="aposSalvar"
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

.total-evidente {
  margin-left: auto;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  background: var(--sidebar-bg);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.select-input.slim {
  width: auto;
  min-width: 150px;
}

.spin {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.erro {
  padding: 14px 18px;
  color: var(--red);
  font-weight: 500;
}

/* ---------- Barra de ações em lote ---------- */

.lote {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  flex-wrap: wrap;
  background: var(--blue-soft);
  border-color: var(--blue-soft);
}

.lote-contagem {
  font-size: 13.5px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.lote-contagem strong {
  color: var(--sidebar-bg);
  font-size: 15px;
}

.lote-acoes {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.lote-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* ---------- Escolas que possuem o modelo escolhido ---------- */

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
  display: inline-flex;
  align-items: center;
  gap: 4px;
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

/* ---------- Tabela ---------- */

.table-card {
  overflow: visible;
}

.th-check,
.td-check {
  width: 38px;
  text-align: center;
}

.td-check input,
.th-check input {
  width: 15px;
  height: 15px;
  cursor: pointer;
  accent-color: var(--sidebar-bg);
}

.th-sort {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font: inherit;
  color: inherit;
  text-transform: inherit;
  letter-spacing: inherit;
  cursor: pointer;
}

.th-sort:hover {
  color: var(--text-primary);
}

th.sortable .th-sort {
  color: var(--text-secondary);
}

th.ativo .th-sort {
  color: var(--blue);
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

/* Rodapé: seletor de quantidade + paginação na mesma faixa. */
.tabela-rodape {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  flex-wrap: wrap;
  border-top: 1px solid var(--border);
}

.pagina-tamanho {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  color: var(--text-muted);
  white-space: nowrap;
  padding: 12px 0;
}

.pagina-tamanho .select-input {
  min-width: 72px;
}

/* ---------- Detalhe / histórico ---------- */

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
  margin: 20px 0 10px;
}

.hist-title:first-child {
  margin-top: 0;
}

/* Empréstimo em atraso: o mesmo tom do badge do SCE, que nunca chegou a ser
   renderizado lá. Sem ele a lista só mostrava "Emprestado", sem dizer há
   quanto tempo o item está fora. */
.badge-atraso {
  display: inline-block;
  margin-top: 4px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--red-soft);
  color: var(--red);
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.emprestimo-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 20px;
  margin: 0;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
}

.emprestimo-grid dt {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 2px;
}

.emprestimo-grid dd {
  margin: 0;
  font-size: 13.5px;
  color: var(--text-primary);
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

  .total-evidente {
    margin-left: 0;
  }
}
</style>
