<script setup lang="ts">
/**
 * Tutoriais — base de conhecimento da equipe de TI.
 * Leitura: todos os usuários autenticados. Criar/editar/excluir: somente ADMIN.
 */
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Eye, FolderCog, Loader2, Paperclip, Plus, Search, Trash2 } from '@lucide/vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import TutorialFormModal from '@/components/tutoriais/TutorialFormModal.vue'
import {
  criarCategoriaTutorial,
  excluirCategoriaTutorial,
  listarCategoriasTutorial,
  listarTutoriais,
  type Tutorial,
  type TutorialCategoria,
} from '@/api/tutoriais'
import { apiError } from '@/utils/apiError'
import { formatDate } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()

/* ---------- Lista ---------- */
const estado = reactive({ loading: true, erro: '', items: [] as Tutorial[], total: 0, page: 1 })
const PAGE_SIZE = 12
const busca = ref('')
const categoriaAtiva = ref('')

const temFiltro = computed(() => !!busca.value.trim() || !!categoriaAtiva.value)

async function carregar() {
  estado.loading = true
  estado.erro = ''
  try {
    const res = await listarTutoriais({
      q: busca.value.trim() || undefined,
      categoriaId: categoriaAtiva.value || undefined,
      page: estado.page,
      limit: PAGE_SIZE,
    })
    estado.items = res.data
    estado.total = res.meta.total
  } catch (e) {
    estado.erro = apiError(e, 'Não foi possível carregar os tutoriais.')
    ui.error(estado.erro)
  } finally {
    estado.loading = false
  }
}

/* Busca com debounce de 300 ms */
let timerBusca: ReturnType<typeof setTimeout> | null = null
watch(busca, () => {
  if (timerBusca) clearTimeout(timerBusca)
  timerBusca = setTimeout(() => {
    estado.page = 1
    void carregar()
  }, 300)
})

function selecionarCategoria(id: string) {
  if (categoriaAtiva.value === id) return
  categoriaAtiva.value = id
  estado.page = 1
  void carregar()
}

function abrirTutorial(t: Tutorial) {
  void router.push(`/tutoriais/${t.id}`)
}

/* ---------- Categorias ---------- */
const categorias = ref<TutorialCategoria[]>([])
const catModalAberto = ref(false)
const novaCat = reactive({ nome: '', cor: '#081a33', descricao: '' })
const criandoCat = ref(false)

async function carregarCategorias() {
  try {
    categorias.value = await listarCategoriasTutorial()
  } catch (e) {
    ui.error(apiError(e, 'Não foi possível carregar as categorias.'))
  }
}

function onCategoriaCriada(c: TutorialCategoria) {
  // Atualização otimista (o modal de formulário já seleciona a nova categoria)
  if (!categorias.value.some((x) => x.id === c.id)) categorias.value.push(c)
  void carregarCategorias()
}

async function criarCategoria() {
  if (!novaCat.nome.trim()) {
    ui.error('Informe o nome da categoria.')
    return
  }
  criandoCat.value = true
  try {
    await criarCategoriaTutorial({
      nome: novaCat.nome.trim(),
      cor: novaCat.cor || undefined,
      descricao: novaCat.descricao.trim() || undefined,
    })
    ui.success('Categoria criada.')
    novaCat.nome = ''
    novaCat.descricao = ''
    await carregarCategorias()
  } catch (e) {
    ui.error(apiError(e, 'Falha ao criar a categoria.'))
  } finally {
    criandoCat.value = false
  }
}

async function excluirCategoria(c: TutorialCategoria) {
  if (!window.confirm(`Excluir a categoria "${c.nome}"?`)) return
  try {
    await excluirCategoriaTutorial(c.id)
    ui.success('Categoria excluída.')
    if (categoriaAtiva.value === c.id) categoriaAtiva.value = ''
    await carregarCategorias()
    estado.page = 1
    await carregar()
  } catch (e) {
    ui.error(apiError(e, 'Não foi possível excluir a categoria.'))
  }
}

/* ---------- Novo tutorial ---------- */
const formAberto = ref(false)

function aoSalvar() {
  estado.page = 1
  void carregar()
  void carregarCategorias()
}

onMounted(() => {
  void carregar()
  void carregarCategorias()
})

onUnmounted(() => {
  if (timerBusca) clearTimeout(timerBusca)
})
</script>

<template>
  <div class="tutoriais-page">
    <!-- Cabeçalho -->
    <div class="page-head">
      <div>
        <h2>Tutoriais</h2>
        <p>Guias e passo a passo da equipe de TI</p>
      </div>
      <button v-if="auth.isAdmin" class="btn btn-primary" type="button" @click="formAberto = true">
        <Plus :size="16" />
        Novo tutorial
      </button>
    </div>

    <!-- Busca + ações -->
    <div class="toolbar card">
      <div class="search-box">
        <Search :size="16" />
        <input v-model="busca" placeholder="Buscar por título, subtítulo ou conteúdo..." />
      </div>
      <button v-if="auth.isAdmin" class="btn btn-outline" type="button" @click="catModalAberto = true">
        <FolderCog :size="16" />
        Gerenciar categorias
      </button>
    </div>

    <!-- Chips de categoria -->
    <div class="chips">
      <button class="chip" :class="{ ativo: !categoriaAtiva }" type="button" @click="selecionarCategoria('')">
        Todas
      </button>
      <button
        v-for="c in categorias"
        :key="c.id"
        class="chip"
        :class="{ ativo: categoriaAtiva === c.id }"
        type="button"
        @click="selecionarCategoria(c.id)"
      >
        <span class="chip-dot" :style="{ background: c.cor || 'var(--sidebar-bg)' }" />
        {{ c.nome }} ({{ c.totalTutoriais }})
      </button>
    </div>

    <p v-if="estado.erro" class="erro card">{{ estado.erro }}</p>

    <!-- Estados e grade -->
    <div v-if="estado.loading" class="estado-central card">Carregando...</div>
    <div v-else-if="estado.items.length === 0 && !estado.erro" class="estado-central card">
      <template v-if="temFiltro">
        <strong>Nenhum tutorial encontrado.</strong>
        <span>Tente ajustar a busca ou escolher outra categoria.</span>
      </template>
      <template v-else>
        <strong>Nenhum tutorial encontrado.</strong>
        <span>Quando a equipe publicar o primeiro tutorial, ele aparecerá aqui.</span>
      </template>
    </div>

    <div v-else class="cards-grid">
      <article
        v-for="t in estado.items"
        :key="t.id"
        class="tutorial-card card"
        @click="abrirTutorial(t)"
      >
        <span class="cat-chip">
          <span class="chip-dot" :style="{ background: t.categoria.cor || 'var(--sidebar-bg)' }" />
          {{ t.categoria.nome }}
        </span>
        <h3 class="card-titulo">{{ t.titulo }}</h3>
        <p v-if="t.subtitulo" class="card-subtitulo">{{ t.subtitulo }}</p>
        <div class="card-meta">
          <span>{{ t.criadoPor }}</span>
          <span>{{ formatDate(t.createdAt) }}</span>
          <span class="meta-icone"><Eye :size="13" /> {{ t.visualizacoes }}</span>
          <span v-if="t.anexos.length > 0" class="meta-icone"><Paperclip :size="13" /> {{ t.anexos.length }}</span>
        </div>
      </article>
    </div>

    <PaginationBar
      v-if="estado.total > 0"
      class="paginacao card"
      :page="estado.page"
      :page-size="PAGE_SIZE"
      :total="estado.total"
      @change="(p) => { estado.page = p; void carregar() }"
    />

    <!-- Gerenciar categorias (ADMIN) -->
    <BaseModal :aberto="catModalAberto" titulo="Gerenciar categorias" @fechar="catModalAberto = false">
      <div class="cat-admin">
        <ul v-if="categorias.length" class="cat-lista">
          <li v-for="c in categorias" :key="c.id" class="cat-item">
            <span class="cat-swatch" :style="{ background: c.cor || 'var(--sidebar-bg)' }" />
            <div class="cat-info">
              <strong>{{ c.nome }}</strong>
              <span>{{ c.totalTutoriais }} tutorial(is)<template v-if="c.descricao"> — {{ c.descricao }}</template></span>
            </div>
            <button class="cat-excluir" type="button" title="Excluir categoria" @click="excluirCategoria(c)">
              <Trash2 :size="15" />
            </button>
          </li>
        </ul>
        <p v-else class="cat-vazia">Nenhuma categoria cadastrada.</p>

        <div class="cat-nova">
          <h4>Nova categoria</h4>
          <div class="cat-nova-linha">
            <input v-model="novaCat.nome" class="input" placeholder="Nome *" />
            <input v-model="novaCat.cor" type="color" class="cor-input" title="Cor da categoria" />
          </div>
          <input v-model="novaCat.descricao" class="input" placeholder="Descrição (opcional)" />
          <div>
            <button class="btn btn-primary" type="button" :disabled="criandoCat" @click="criarCategoria">
              <Loader2 v-if="criandoCat" class="spin" :size="15" />
              Adicionar categoria
            </button>
          </div>
        </div>
      </div>
    </BaseModal>

    <!-- Novo tutorial -->
    <TutorialFormModal
      v-if="formAberto"
      :categorias="categorias"
      @fechar="formAberto = false"
      @salvo="aoSalvar"
      @categoria-criada="onCategoriaCriada"
    />
  </div>
</template>

<style scoped>
.tutoriais-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ---------- Cabeçalho ---------- */
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}

.page-head h2 {
  font-size: 20px;
}

.page-head p {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--text-muted);
}

/* ---------- Toolbar ---------- */
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
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

/* ---------- Chips ---------- */
.chips {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 14px;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 600;
  background: var(--slate-soft);
  color: var(--text-secondary);
  transition:
    background 0.12s ease,
    color 0.12s ease;
}

.chip:hover {
  background: var(--border-strong);
}

.chip.ativo {
  background: var(--sidebar-bg);
  color: #fff;
}

.chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ---------- Estados ---------- */
.erro {
  padding: 14px 18px;
  color: var(--red);
  font-weight: 500;
}

.estado-central {
  padding: 44px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: var(--text-muted);
  font-size: 13.5px;
  text-align: center;
}

.estado-central strong {
  color: var(--text-secondary);
  font-size: 14px;
}

/* ---------- Grade de tutoriais ---------- */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
  gap: 14px;
}

.tutorial-card {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: pointer;
  transition:
    box-shadow 0.15s ease,
    transform 0.1s ease;
}

.tutorial-card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}

.cat-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.card-titulo {
  font-size: 15px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-subtitulo {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-meta {
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 11.5px;
  color: var(--text-muted);
}

.meta-icone {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.paginacao {
  padding: 2px 0;
}

/* ---------- Modal de categorias ---------- */
.cat-admin {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cat-lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 300px;
  overflow-y: auto;
}

.cat-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.cat-swatch {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
}

.cat-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.cat-info strong {
  font-size: 13px;
}

.cat-info span {
  font-size: 11.5px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cat-excluir {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: var(--text-muted);
  flex-shrink: 0;
}

.cat-excluir:hover {
  background: var(--red-soft);
  color: var(--red);
}

.cat-vazia {
  margin: 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  padding: 14px 0;
}

.cat-nova {
  border-top: 1px solid var(--border);
  padding-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cat-nova h4 {
  font-size: 13px;
  margin: 0;
}

.cat-nova-linha {
  display: flex;
  gap: 8px;
  align-items: center;
}

.cor-input {
  width: 42px;
  height: 40px;
  padding: 2px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
  cursor: pointer;
  flex-shrink: 0;
}

.spin {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 640px) {
  .search-box {
    min-width: 0;
    width: 100%;
  }
}
</style>
