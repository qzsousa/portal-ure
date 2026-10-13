<script setup lang="ts">
/**
 * Detalhe de um tutorial (/tutoriais/:id) — leitura aberta a todos os
 * usuários autenticados. Ações de edição/exclusão somente para ADMIN.
 */
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Eye, Heart, Link2, Loader2, Paperclip, Pencil, Reply, Send, Trash2 } from '@lucide/vue'
import TutorialFormModal from '@/components/tutoriais/TutorialFormModal.vue'
import {
  criarComentarioTutorial,
  curtirComentarioTutorial,
  curtirTutorial,
  excluirComentarioTutorial,
  excluirTutorial,
  listarCategoriasTutorial,
  listarComentariosTutorial,
  obterCurtidasTutorial,
  obterTutorial,
  type ComentarioTutorial,
  type Tutorial,
  type TutorialCategoria,
} from '@/api/tutoriais'
import { linkPublicoTutorial } from '@/api/publico'
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

/* ---------- Interações ---------- */
const curtidasCount = ref(0)
const curtidoPorMim = ref(false)
const curtindoTutorialFlag = ref(false)
const comentarios = ref<ComentarioTutorial[]>([])
const carregandoComentarios = ref(false)
const novoComentario = ref('')
const enviandoComentario = ref(false)
const respondendoPara = ref<string | null>(null)
const textoResposta = ref('')
const enviandoResposta = ref(false)
const curtindoComentarioIds = ref<Set<string>>(new Set())

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    tutorial.value = await obterTutorial(String(route.params.id || ''))
    await carregarInteracoes()
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

async function carregarInteracoes() {
  if (!tutorial.value) return
  carregandoComentarios.value = true
  try {
    const [curtidas, lista] = await Promise.all([
      obterCurtidasTutorial(tutorial.value.id),
      listarComentariosTutorial(tutorial.value.id),
    ])
    curtidasCount.value = curtidas.total
    curtidoPorMim.value = curtidas.curtido
    comentarios.value = lista
  } catch {
    // interações indisponíveis não quebram a leitura do tutorial
  } finally {
    carregandoComentarios.value = false
  }
}

async function alternarCurtidaTutorial() {
  if (!tutorial.value || curtindoTutorialFlag.value) return
  curtindoTutorialFlag.value = true
  try {
    const res = await curtirTutorial(tutorial.value.id)
    curtidoPorMim.value = res.curtido
    curtidasCount.value = res.total
  } catch (e) {
    ui.error(apiError(e, 'Não foi possível atualizar a curtida.'))
  } finally {
    curtindoTutorialFlag.value = false
  }
}

async function publicarComentario(parentId: string | null = null) {
  if (!tutorial.value) return
  const texto = (parentId ? textoResposta.value : novoComentario.value).trim()
  if (!texto) return
  const enviando = parentId ? enviandoResposta : enviandoComentario
  enviando.value = true
  try {
    const criado = await criarComentarioTutorial(tutorial.value.id, { texto, parentId })
    if (parentId) {
      const pai = encontrarComentario(comentarios.value, parentId)
      if (pai) pai.respostas.unshift(criado)
      textoResposta.value = ''
      respondendoPara.value = null
    } else {
      comentarios.value.unshift(criado)
      novoComentario.value = ''
    }
    ui.success('Comentário publicado.')
  } catch (e) {
    ui.error(apiError(e, 'Não foi possível publicar o comentário.'))
  } finally {
    enviando.value = false
  }
}

function encontrarComentario(lista: ComentarioTutorial[], id: string): ComentarioTutorial | null {
  for (const c of lista) {
    if (c.id === id) return c
    const r = encontrarComentario(c.respostas, id)
    if (r) return r
  }
  return null
}

async function alternarCurtidaComentario(c: ComentarioTutorial) {
  if (curtindoComentarioIds.value.has(c.id)) return
  curtindoComentarioIds.value.add(c.id)
  try {
    const res = await curtirComentarioTutorial(c.id)
    c.curtidoPorMim = res.curtido
    c.curtidasCount = res.total
  } catch (e) {
    ui.error(apiError(e, 'Não foi possível curtir o comentário.'))
  } finally {
    curtindoComentarioIds.value.delete(c.id)
  }
}

async function removerComentario(c: ComentarioTutorial, lista: ComentarioTutorial[]) {
  if (!window.confirm('Excluir este comentário?')) return
  try {
    await excluirComentarioTutorial(c.id)
    const idx = lista.indexOf(c)
    if (idx >= 0) lista.splice(idx, 1)
    ui.success('Comentário excluído.')
  } catch (e) {
    ui.error(apiError(e, 'Não foi possível excluir o comentário.'))
  }
}

/** Copia o link PÚBLICO (sem login) — o interno /tutoriais/:id exige autenticação. */
async function copiarLink() {
  if (!tutorial.value) return
  try {
    await navigator.clipboard.writeText(linkPublicoTutorial(tutorial.value.id))
    ui.success('Link público copiado!')
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
            <button class="btn btn-outline" type="button" title="Copiar link público (abre sem login)" @click="copiarLink">
              <Link2 :size="15" />
              Copiar link público
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

      <div class="card interacoes-card">
        <div class="curtida-linha">
          <button
            class="btn-curtir"
            :class="{ curtido: curtidoPorMim }"
            type="button"
            :disabled="curtindoTutorialFlag"
            @click="alternarCurtidaTutorial"
          >
            <Heart :size="16" />
            Curtir tutorial · {{ curtidasCount }}
          </button>
        </div>

        <h3>Comentários ({{ comentarios.length }})</h3>

        <div class="comentario-form">
          <textarea v-model="novoComentario" class="input" rows="3" placeholder="Escreva um comentário..." />
          <button class="btn btn-primary" type="button" :disabled="enviandoComentario" @click="publicarComentario(null)">
            <Loader2 v-if="enviandoComentario" class="spin" :size="15" />
            <Send v-else :size="15" />
            Publicar comentário
          </button>
        </div>

        <div v-if="carregandoComentarios" class="estado-central">Carregando comentários...</div>

        <ul v-else-if="comentarios.length" class="comentarios-lista">
          <li v-for="c in comentarios" :key="c.id" class="comentario-item">
            <div class="comentario-cab">
              <strong>{{ c.autorNome }}</strong>
              <span>{{ formatDateTime(c.createdAt) }}</span>
            </div>
            <p class="comentario-texto">{{ c.texto }}</p>
            <div class="comentario-acoes">
              <button class="btn-link" type="button" @click="alternarCurtidaComentario(c)">
                <Heart :size="14" />
                {{ c.curtidasCount }}
              </button>
              <button class="btn-link" type="button" @click="respondendoPara = respondendoPara === c.id ? null : c.id">
                <Reply :size="14" />
                Responder
              </button>
              <button
                v-if="auth.isAdmin"
                class="btn-link perigo"
                type="button"
                @click="removerComentario(c, comentarios)"
              >
                <Trash2 :size="14" />
                Excluir
              </button>
            </div>

            <div v-if="respondendoPara === c.id" class="resposta-form">
              <textarea v-model="textoResposta" class="input" rows="2" placeholder="Escreva uma resposta..." />
              <div class="resposta-acoes">
                <button class="btn btn-primary" type="button" :disabled="enviandoResposta" @click="publicarComentario(c.id)">
                  <Loader2 v-if="enviandoResposta" class="spin" :size="14" />
                  <Send v-else :size="14" />
                  Responder
                </button>
                <button class="btn btn-outline" type="button" @click="respondendoPara = null">Cancelar</button>
              </div>
            </div>

            <ul v-if="c.respostas.length" class="respostas-lista">
              <li v-for="r in c.respostas" :key="r.id" class="comentario-item resposta">
                <div class="comentario-cab">
                  <strong>{{ r.autorNome }}</strong>
                  <span>{{ formatDateTime(r.createdAt) }}</span>
                </div>
                <p class="comentario-texto">{{ r.texto }}</p>
                <div class="comentario-acoes">
                  <button class="btn-link" type="button" @click="alternarCurtidaComentario(r)">
                    <Heart :size="14" />
                    {{ r.curtidasCount }}
                  </button>
                </div>
              </li>
            </ul>
          </li>
        </ul>

        <p v-else class="estado-vazio">Nenhum comentário ainda. Seja o primeiro!</p>
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

/* ---------- Interações ---------- */
.interacoes-card {
  padding: 18px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.curtida-linha {
  display: flex;
  align-items: center;
}

.btn-curtir {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.btn-curtir:hover {
  background: var(--blue-soft);
  color: var(--blue);
}

.btn-curtir.curtido {
  background: var(--red-soft);
  color: var(--red);
  border-color: var(--red);
}

.interacoes-card h3 {
  font-size: 14px;
  margin: 0;
}

.comentario-form,
.resposta-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.comentario-form textarea,
.resposta-form textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: 13.5px;
  color: var(--text-primary);
  background: var(--surface);
  resize: vertical;
}

.comentarios-lista,
.respostas-lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.respostas-lista {
  margin-top: 10px;
  margin-left: 18px;
  padding-left: 12px;
  border-left: 2px solid var(--border);
}

.comentario-item {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
}

.comentario-cab {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.comentario-cab strong {
  color: var(--text-secondary);
  font-size: 13px;
}

.comentario-texto {
  margin: 0 0 8px;
  font-size: 13.5px;
  color: var(--text-secondary);
  white-space: pre-wrap;
  line-height: 1.5;
}

.comentario-acoes {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
}

.btn-link:hover {
  color: var(--blue);
  background: var(--blue-soft);
}

.btn-link.perigo:hover {
  color: var(--red);
  background: var(--red-soft);
}

.resposta-acoes {
  display: flex;
  gap: 8px;
}

.estado-vazio {
  margin: 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  padding: 14px 0;
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
