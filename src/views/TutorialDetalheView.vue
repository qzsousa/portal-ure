<script setup lang="ts">
/**
 * Detalhe de um tutorial (/tutoriais/:id) — leitura aberta a todos os
 * usuários autenticados. Ações de edição/exclusão somente para ADMIN.
 */
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Eye, Link2, Paperclip, Pencil, Trash2 } from '@lucide/vue'
import TutorialFormModal from '@/components/tutoriais/TutorialFormModal.vue'
import {
  excluirTutorial,
  listarCategoriasTutorial,
  obterTutorial,
  type Tutorial,
  type TutorialCategoria,
} from '@/api/tutoriais'
import { apiError } from '@/utils/apiError'
import { formatDateTime } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import type { AxiosError } from 'axios'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()

const tutorial = ref<Tutorial | null>(null)
const carregando = ref(true)
const erro = ref('')
const excluindo = ref(false)
const formAberto = ref(false)
const categorias = ref<TutorialCategoria[]>([])

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    tutorial.value = await obterTutorial(String(route.params.id || ''))
  } catch (e) {
    tutorial.value = null
    if ((e as AxiosError).response?.status === 404) {
      ui.error(apiError(e, 'Tutorial não encontrado.'))
      void router.replace('/tutoriais')
      return
    }
    erro.value = apiError(e, 'Não foi possível carregar o tutorial.')
    ui.error(erro.value)
  } finally {
    carregando.value = false
  }
}

async function copiarLink() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    ui.success('Link copiado!')
  } catch {
    ui.error('Não foi possível copiar o link.')
  }
}

async function excluir() {
  if (!tutorial.value) return
  if (!window.confirm('Excluir este tutorial?')) return
  excluindo.value = true
  try {
    await excluirTutorial(tutorial.value.id)
    ui.success('Tutorial excluído.')
    void router.replace('/tutoriais')
  } catch (e) {
    ui.error(apiError(e, 'Não foi possível excluir o tutorial.'))
  } finally {
    excluindo.value = false
  }
}

/* ---------- Edição ---------- */
async function carregarCategorias() {
  try {
    categorias.value = await listarCategoriasTutorial()
  } catch {
    // categorias indisponíveis: o modal avisa caso a gravação falhe
  }
}

function onCategoriaCriada(c: TutorialCategoria) {
  if (!categorias.value.some((x) => x.id === c.id)) categorias.value.push(c)
  void carregarCategorias()
}

function aoSalvar() {
  void carregar()
}

onMounted(() => {
  void carregar()
  if (auth.isAdmin) void carregarCategorias()
})
</script>

<template>
  <div class="tutorial-detalhe">
    <RouterLink class="voltar" to="/tutoriais">
      <ArrowLeft :size="15" />
      Voltar para tutoriais
    </RouterLink>

    <div v-if="carregando" class="estado-central card">Carregando...</div>

    <div v-else-if="erro" class="estado-central card">
      <strong>Não foi possível carregar o tutorial.</strong>
      <span>{{ erro }}</span>
    </div>

    <template v-else-if="tutorial">
      <div class="card tutorial-head">
        <div class="head-top">
          <span class="cat-chip">
            <span class="chip-dot" :style="{ background: tutorial.categoria.cor || 'var(--sidebar-bg)' }" />
            {{ tutorial.categoria.nome }}
          </span>
          <div class="head-acoes">
            <button class="btn btn-outline" type="button" @click="copiarLink">
              <Link2 :size="15" />
              Copiar link
            </button>
            <template v-if="auth.isAdmin">
              <button class="btn btn-outline" type="button" @click="formAberto = true">
                <Pencil :size="15" />
                Editar
              </button>
              <button class="btn btn-danger" type="button" :disabled="excluindo" @click="excluir">
                <Trash2 :size="15" />
                Excluir
              </button>
            </template>
          </div>
        </div>

        <h1>{{ tutorial.titulo }}</h1>
        <p v-if="tutorial.subtitulo" class="subtitulo">{{ tutorial.subtitulo }}</p>

        <div class="meta">
          <span>{{ tutorial.criadoPor }}</span>
          <span class="sep">•</span>
          <span>{{ formatDateTime(tutorial.createdAt) }}</span>
          <span class="sep">•</span>
          <span class="meta-icone">
            <Eye :size="14" />
            {{ tutorial.visualizacoes }} visualizações
          </span>
        </div>
      </div>

      <div class="card conteudo-card">
        <p class="conteudo">{{ tutorial.conteudo }}</p>
      </div>

      <div v-if="tutorial.anexos.length" class="card anexos-card">
        <h3>Anexos ({{ tutorial.anexos.length }})</h3>
        <ul class="anexos-lista">
          <li v-for="a in tutorial.anexos" :key="a.id">
            <Paperclip :size="15" />
            <a :href="a.url" target="_blank" rel="noopener" class="anexo-link">{{ a.nome }}</a>
            <span v-if="a.tipo" class="anexo-tipo">{{ a.tipo }}</span>
          </li>
        </ul>
      </div>
    </template>

    <TutorialFormModal
      v-if="formAberto && tutorial"
      :tutorial="tutorial"
      :categorias="categorias"
      @fechar="formAberto = false"
      @salvo="aoSalvar"
      @categoria-criada="onCategoriaCriada"
    />
  </div>
</template>

<style scoped>
.tutorial-detalhe {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.voltar {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  align-self: flex-start;
}

.voltar:hover {
  color: var(--sidebar-bg);
  text-decoration: underline;
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

/* ---------- Cabeçalho ---------- */
.tutorial-head {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.head-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
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

.chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.head-acoes {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.head-acoes .btn {
  padding: 8px 13px;
  font-size: 13px;
}

.btn-danger {
  background: var(--red);
  color: #fff;
}

.btn-danger:hover {
  background: #b91c1c;
}

.tutorial-head h1 {
  font-size: 22px;
  line-height: 1.3;
}

.subtitulo {
  margin: 0;
  font-size: 15px;
  color: var(--text-muted);
}

.meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 12.5px;
  color: var(--text-muted);
}

.sep {
  color: var(--border-strong);
}

.meta-icone {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

/* ---------- Conteúdo ---------- */
.conteudo-card {
  padding: 22px 24px;
}

.conteudo {
  margin: 0;
  max-width: 78ch;
  font-size: 14.5px;
  line-height: 1.65;
  color: var(--text-secondary);
  white-space: pre-wrap;
}

/* ---------- Anexos ---------- */
.anexos-card {
  padding: 18px 24px;
}

.anexos-card h3 {
  font-size: 14px;
  margin-bottom: 12px;
}

.anexos-lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.anexos-lista li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
}

.anexo-link {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 500;
  color: var(--blue);
}

.anexo-link:hover {
  text-decoration: underline;
}

.anexo-tipo {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}
</style>
