<script setup lang="ts">
/**
 * Aba "Formulário de chamados" das Configurações (ADMIN).
 *
 * Lista as categorias do formulário público (com as perguntas embutidas) e
 * permite criar/editar/excluir categorias e perguntas. Cada categoria expande
 * para revelar suas perguntas (reordenação por ↑ ↓ via troca de `ordem`).
 * Toda mutação dispara um refetch — sem cache otimista.
 */
import { computed, onMounted, ref } from 'vue'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ListOrdered,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from '@lucide/vue'
import CategoriaFormModal from './CategoriaFormModal.vue'
import PerguntaFormModal from './PerguntaFormModal.vue'
import {
  atualizarPerguntaFormulario,
  excluirCategoriaFormulario,
  excluirPerguntaFormulario,
  listarCategoriasFormulario,
  type FormularioCategoria,
  type FormularioPergunta,
  type FormularioPerguntaTipo,
} from '@/api/formulario'
import { apiError } from '@/utils/apiError'
import { condicoesDe, rotuloDaOrigem } from '@/utils/formulario'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()

/** Texto do title da badge: todas as condições em uma frase. */
function resumoCondicoes(cat: FormularioCategoria, p: FormularioPergunta): string {
  return condicoesDe(p)
    .map((c) => `«${rotuloDaOrigem(cat.perguntas ?? [], c.perguntaId)}» = «${c.opcao}»`)
    .join(' ou ')
}

/* ---------- Carga ---------- */
const categorias = ref<FormularioCategoria[]>([])
const carregando = ref(true)
const erroCarga = ref('')

async function carregar() {
  carregando.value = true
  erroCarga.value = ''
  try {
    categorias.value = await listarCategoriasFormulario()
  } catch (e) {
    erroCarga.value = apiError(e, 'Não foi possível carregar o formulário.')
  } finally {
    carregando.value = false
  }
}

const categoriasOrdenadas = computed(() =>
  [...categorias.value].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome)),
)

/**
 * Perguntas na ordem em que aparecem para o usuário. O desempate por `id` é
 * essencial: `ordem` pode vir repetida (perguntas antigas, importadas) e sem
 * isso o Vue passa a intercalar perguntas a cada refetch.
 */
function perguntasDe(cat: FormularioCategoria): FormularioPergunta[] {
  return [...(cat.perguntas ?? [])].sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id))
}

/** Próxima `ordem` livre: sempre `max(ordem) + 1`, nunca a quantidade de perguntas. */
function proximaOrdem(cat: FormularioCategoria): number {
  const maior = (cat.perguntas ?? []).reduce((max, p) => Math.max(max, p.ordem), 0)
  return maior + 1
}

const ROTULOS_TIPO: Record<FormularioPerguntaTipo, string> = {
  OPCOES: 'Opções',
  TEXTO: 'Texto',
  TEXTO_LONGO: 'Texto longo',
  ESCOLA: 'Escola',
  ARQUIVO: 'Anexo',
}

/* ---------- Expansão ---------- */
const expandidas = ref<Set<string>>(new Set())

function alternarExpansao(id: string) {
  const novo = new Set(expandidas.value)
  if (novo.has(id)) novo.delete(id)
  else novo.add(id)
  expandidas.value = novo
}

/* ---------- Categorias ---------- */
const catModalAberto = ref(false)
const catEditando = ref<FormularioCategoria | null>(null)

function abrirNovaCategoria() {
  catEditando.value = null
  catModalAberto.value = true
}

function abrirEdicaoCategoria(cat: FormularioCategoria) {
  catEditando.value = cat
  catModalAberto.value = true
}

async function excluirCategoria(cat: FormularioCategoria) {
  const msg = `Excluir a categoria "${cat.nome}"? TODAS as perguntas dela serão apagadas.`
  if (!window.confirm(msg)) return
  try {
    await excluirCategoriaFormulario(cat.id)
    ui.success('Categoria excluída.')
    await carregar()
  } catch (e) {
    ui.error(apiError(e, 'Falha ao excluir a categoria.'))
  }
}

/* ---------- Perguntas ---------- */
const pergModalAberto = ref(false)
const pergCategoria = ref<FormularioCategoria | null>(null)
const pergEditando = ref<FormularioPergunta | null>(null)

function abrirNovaPergunta(cat: FormularioCategoria) {
  pergCategoria.value = cat
  pergEditando.value = null
  pergModalAberto.value = true
}

function abrirEdicaoPergunta(cat: FormularioCategoria, p: FormularioPergunta) {
  pergCategoria.value = cat
  pergEditando.value = p
  pergModalAberto.value = true
}

async function excluirPergunta(p: FormularioPergunta) {
  if (!window.confirm(`Excluir a pergunta "${p.rotulo}"?`)) return
  try {
    await excluirPerguntaFormulario(p.id)
    ui.success('Pergunta excluída.')
    await carregar()
  } catch (e) {
    ui.error(apiError(e, 'Falha ao excluir a pergunta.'))
  }
}

const reordenando = ref(false)

/**
 * Grava `ordem` = 1..N na ordem visual desejada, enviando apenas as perguntas
 * cuja `ordem` realmente muda. Renumerar tudo (em vez de trocar duas vizinhas)
 * é o que conserta lacunas e `ordem` repetida: a troca simples saía sem fazer
 * nada quando as duas perguntas tinham o mesmo número.
 */
async function aplicarOrdens(listaOrdenada: FormularioPergunta[]) {
  const mudancas = listaOrdenada
    .map((p, i) => ({ id: p.id, ordem: i + 1, atual: p.ordem }))
    .filter((c) => c.atual !== c.ordem)
  if (!mudancas.length) return
  reordenando.value = true
  try {
    for (const m of mudancas) {
      await atualizarPerguntaFormulario(m.id, { ordem: m.ordem })
    }
    await carregar()
  } catch (e) {
    ui.error(apiError(e, 'Falha ao reordenar as perguntas.'))
  } finally {
    reordenando.value = false
  }
}

async function moverPergunta(cat: FormularioCategoria, idx: number, delta: number) {
  const lista = perguntasDe(cat)
  const alvo = idx + delta
  if (alvo < 0 || alvo >= lista.length) return
  const movida = lista[idx]
  if (!movida) return
  const nova = [...lista]
  nova.splice(idx, 1)
  nova.splice(alvo, 0, movida)
  await aplicarOrdens(nova)
}

/** Reescreve `ordem` = 1..N na ordem já exibida, apagando lacunas e repetições. */
async function renumerarPerguntas(cat: FormularioCategoria) {
  await aplicarOrdens(perguntasDe(cat))
}

/** Só oferece a renumeração quando há `ordem` fora da sequência 1..N. */
function foraDaSequencia(cat: FormularioCategoria): boolean {
  return perguntasDe(cat).some((p, i) => p.ordem !== i + 1)
}

onMounted(() => {
  void carregar()
})
</script>

<template>
  <div class="fa">
    <div class="fa-head">
      <div>
        <h3>Formulário de chamados</h3>
        <p class="fa-desc">Categorias e perguntas exibidas na abertura pública de chamado.</p>
      </div>
      <button class="btn btn-primary" type="button" @click="abrirNovaCategoria">
        <Plus :size="15" />
        Nova categoria
      </button>
    </div>

    <div v-if="carregando" class="fa-estado">
      <Loader2 class="spin" :size="18" />
      Carregando...
    </div>
    <div v-else-if="erroCarga" class="fa-estado fa-estado-erro">
      <span>{{ erroCarga }}</span>
      <button class="btn btn-outline" type="button" @click="carregar">Tentar novamente</button>
    </div>
    <p v-else-if="categorias.length === 0" class="fa-estado">
      Nenhuma categoria cadastrada. Crie a primeira para montar o formulário público.
    </p>

    <ul v-else class="cat-lista">
      <li v-for="c in categoriasOrdenadas" :key="c.id" class="cat-item">
        <div class="cat-linha">
          <button
            class="cat-expand"
            type="button"
            :title="expandidas.has(c.id) ? 'Recolher perguntas' : 'Ver perguntas'"
            @click="alternarExpansao(c.id)"
          >
            <ChevronDown v-if="expandidas.has(c.id)" :size="16" />
            <ChevronRight v-else :size="16" />
          </button>
          <span class="cat-swatch" :style="{ background: c.cor || 'var(--sidebar-bg)' }" />
          <div class="cat-info">
            <button class="cat-nome" type="button" title="Ver perguntas" @click="alternarExpansao(c.id)">
              {{ c.nome }}
            </button>
            <div class="cat-meta">
              <code class="cat-chave">{{ c.chave }}</code>
              <span>ordem {{ c.ordem }}</span>
              <span>{{ c.perguntas?.length ?? 0 }} pergunta(s)</span>
              <span v-if="c.descricao" class="cat-descricao">{{ c.descricao }}</span>
              <span class="badge" :class="c.ativa ? 'badge-on' : 'badge-off'">
                {{ c.ativa ? 'Ativa' : 'Inativa' }}
              </span>
            </div>
          </div>
          <div class="cat-acoes">
            <button class="ico-btn" type="button" title="Editar categoria" @click="abrirEdicaoCategoria(c)">
              <Pencil :size="15" />
            </button>
            <button
              class="ico-btn perigo"
              type="button"
              title="Excluir categoria (apaga as perguntas)"
              @click="excluirCategoria(c)"
            >
              <Trash2 :size="15" />
            </button>
          </div>
        </div>

        <!-- Perguntas da categoria -->
        <div v-if="expandidas.has(c.id)" class="perguntas">
          <ul v-if="perguntasDe(c).length" class="perg-lista">
            <li v-for="(p, i) in perguntasDe(c)" :key="p.id" class="perg-item">
              <span class="perg-ordem">{{ i + 1 }}</span>
              <div class="perg-info">
                <div class="perg-titulo-linha">
                  <strong class="perg-rotulo">{{ p.rotulo }}</strong>
                  <span class="tipo-chip">{{ ROTULOS_TIPO[p.tipo] }}</span>
<span v-if="p.obrigatoria" class="badge badge-info">Obrigatória</span>
                  <span
                    v-if="condicoesDe(p).length"
                    class="badge badge-cond"
                    :title="resumoCondicoes(c, p)"
                  >
                    {{ condicoesDe(p).length > 1 ? `${condicoesDe(p).length} condições` : 'Condicional' }}
                  </span>
                  <span v-if="!p.ativa" class="badge badge-off">Inativa</span>
                </div>
                <p v-if="condicoesDe(p).length" class="perg-cond">
                  Exibida se
                  <template v-for="(cd, i) in condicoesDe(p)" :key="cd.perguntaId + cd.opcao">
                    <span v-if="i > 0"> ou </span>«{{ rotuloDaOrigem(c.perguntas ?? [], cd.perguntaId) }}» = «{{ cd.opcao }}»
                  </template>
                </p>
              </div>
              <div class="perg-acoes">
                <button
                  class="ico-btn"
                  type="button"
                  title="Mover para cima"
                  :disabled="i === 0 || reordenando"
                  @click="moverPergunta(c, i, -1)"
                >
                  <ArrowUp :size="14" />
                </button>
                <button
                  class="ico-btn"
                  type="button"
                  title="Mover para baixo"
                  :disabled="i === perguntasDe(c).length - 1 || reordenando"
                  @click="moverPergunta(c, i, 1)"
                >
                  <ArrowDown :size="14" />
                </button>
                <button class="ico-btn" type="button" title="Editar pergunta" @click="abrirEdicaoPergunta(c, p)">
                  <Pencil :size="14" />
                </button>
                <button class="ico-btn perigo" type="button" title="Excluir pergunta" @click="excluirPergunta(p)">
                  <Trash2 :size="14" />
                </button>
              </div>
            </li>
          </ul>
          <p v-else class="perg-vazia">Nenhuma pergunta nesta categoria ainda.</p>
          <div class="perg-rodape">
            <button
              v-if="foraDaSequencia(c)"
              class="btn btn-outline btn-renumerar"
              type="button"
              :disabled="reordenando"
              title="Reescrever a ordem das perguntas como 1, 2, 3..."
              @click="renumerarPerguntas(c)"
            >
              <ListOrdered :size="15" />
              Corrigir ordem
            </button>
            <button class="btn btn-outline btn-nova-perg" type="button" @click="abrirNovaPergunta(c)">
              <Plus :size="15" />
              Nova pergunta
            </button>
          </div>
        </div>
      </li>
    </ul>

    <CategoriaFormModal
      v-if="catModalAberto"
      :categoria="catEditando"
      :ordem-sugerida="categorias.length"
      @fechar="catModalAberto = false"
      @salvo="carregar"
    />
    <PerguntaFormModal
      v-if="pergModalAberto && pergCategoria"
      :categoria="pergCategoria"
      :pergunta="pergEditando"
      :ordem-sugerida="proximaOrdem(pergCategoria)"
      @fechar="pergModalAberto = false"
      @salvo="carregar"
    />
  </div>
</template>

<style scoped>
.fa-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}

.fa-head h3 {
  font-size: 15px;
  margin-bottom: 4px;
}

.fa-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}

.fa-estado {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 30px 16px;
  color: var(--text-muted);
  font-size: 13.5px;
  text-align: center;
}

.fa-estado-erro {
  flex-direction: column;
  color: var(--red);
  font-weight: 500;
}

/* ---------- Categorias ---------- */
.cat-lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cat-item {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.cat-linha {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
}

.cat-expand {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  color: var(--text-muted);
  flex-shrink: 0;
}

.cat-expand:hover {
  background: var(--surface-muted);
  color: var(--text-primary);
}

.cat-swatch {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
  border: 1px solid rgb(0 0 0 / 0.08);
}

.cat-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cat-nome {
  text-align: left;
  font-weight: 700;
  font-size: 13.5px;
  color: var(--text-primary);
  padding: 0;
}

.cat-nome:hover {
  color: var(--blue);
}

.cat-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--text-muted);
}

.cat-chave {
  background: var(--surface-muted);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 1px 7px;
  font-size: 11.5px;
}

.cat-descricao {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 320px;
}

.cat-acoes {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

/* ---------- Badges ---------- */
.badge {
  display: inline-block;
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.badge-on {
  color: var(--green);
  background: var(--green-soft);
}

.badge-off {
  color: var(--text-secondary);
  background: var(--surface-muted);
  border: 1px solid var(--border);
}

.badge-info {
  color: var(--blue);
  background: var(--blue-soft);
}

.badge-cond {
  color: var(--yellow);
  background: var(--yellow-soft);
  cursor: help;
}

/* ---------- Perguntas ---------- */
.perguntas {
  border-top: 1px solid var(--border);
  background: var(--surface-muted);
  padding: 12px;
}

.perg-lista {
  list-style: none;
  margin: 0 0 10px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.perg-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  flex-wrap: wrap;
}

.perg-ordem {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: var(--surface-muted);
  border: 1px solid var(--border);
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  flex-shrink: 0;
}

.perg-info {
  flex: 1;
  min-width: 220px;
}

.perg-titulo-linha {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.perg-rotulo {
  font-size: 13px;
  color: var(--text-primary);
}

.tipo-chip {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary);
  background: var(--slate-soft);
  border-radius: 999px;
  padding: 2px 9px;
  white-space: nowrap;
}

.perg-cond {
  margin: 2px 0 0;
  font-size: 11.5px;
  color: var(--text-muted);
}

.perg-acoes {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.perg-vazia {
  margin: 0 0 10px;
  font-size: 12.5px;
  color: var(--text-muted);
}

.perg-rodape {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.btn-nova-perg {
  padding: 7px 12px;
  font-size: 13px;
  border-style: dashed;
}

.btn-renumerar {
  padding: 7px 12px;
  font-size: 13px;
  border-style: dashed;
  color: var(--yellow);
}

/* ---------- Ícones / util ---------- */
.ico-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: var(--text-muted);
  background: transparent;
}

.ico-btn:hover:not(:disabled) {
  background: var(--surface-muted);
  color: var(--text-primary);
}

.perguntas .ico-btn:hover:not(:disabled) {
  background: var(--border);
}

.ico-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.ico-btn.perigo {
  color: var(--red);
}

.ico-btn.perigo:hover:not(:disabled) {
  background: var(--red-soft);
  color: var(--red);
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
  .cat-linha {
    flex-wrap: wrap;
  }
  .perg-info {
    min-width: 160px;
  }
}
</style>
