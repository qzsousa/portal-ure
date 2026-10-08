<script setup lang="ts">
/**
 * Modal de criar/editar PERGUNTA do formulário de chamados (ADMIN).
 *
 * - Tipo OPCOES abre o editor de opções (ordenação, rótulo e alerta por opção).
 * - Exibição pode ser condicionada à resposta de outra pergunta de opções
 *   da MESMA categoria (dependeDePerguntaId + dependeDeOpcao).
 *
 * Montado sob demanda com v-if. Emite `salvo` após gravar — o pai recarrega.
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ArrowDown, ArrowUp, Loader2, MessageSquareWarning, Plus, X } from '@lucide/vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { apiError } from '@/utils/apiError'
import { condicoesDe, podeSerOrigem } from '@/utils/formulario'
import {
  atualizarPerguntaFormulario,
  criarPerguntaFormulario,
  type AtualizarPerguntaFormularioPayload,
  type FormularioCondicao,
  type FormularioCategoria,
  type FormularioOpcao,
  type FormularioOpcaoAlerta,
  type FormularioPergunta,
  type FormularioPerguntaTipo,
} from '@/api/formulario'
import { useUiStore } from '@/stores/ui'

/** Opção em edição no modal (alerta sempre presente para facilitar o v-model). */
interface OpcaoEdicao {
  rotulo: string
  alerta: FormularioOpcaoAlerta | null
}

const props = withDefaults(
  defineProps<{
    categoria: FormularioCategoria
    pergunta?: FormularioPergunta | null // null/ausente = criar
    ordemSugerida?: number
  }>(),
  { pergunta: null, ordemSugerida: 0 },
)

const emit = defineEmits<{
  (e: 'fechar'): void
  (e: 'salvo'): void
}>()

const ui = useUiStore()
const editando = computed(() => props.pergunta !== null)

const form = reactive({
  rotulo: '',
  ajuda: '',
  tipo: 'TEXTO' as FormularioPerguntaTipo,
  obrigatoria: false,
  ativa: true,
  ordem: 0,
})

/* ---------- Exibição condicional ---------- */
/**
 * Uma condição = par (pergunta de origem, opção). A pergunta é exibida quando
 * QUALQUER uma delas for satisfeita (OU). Lista vazia = sempre exibir.
 */
interface CondicaoEdicao {
  perguntaId: string
  opcao: string
}

const condicoes = ref<CondicaoEdicao[]>([])

/** Somente perguntas de OPÇÕES da mesma categoria podem ser "base" (nunca ela mesma). */
const perguntasCondicionaveis = computed(() =>
  podeSerOrigem(props.categoria.perguntas ?? [], props.categoria.id, props.pergunta?.id ?? null),
)

function opcoesDa(perguntaId: string) {
  return perguntasCondicionaveis.value.find((p) => p.id === perguntaId)?.opcoes ?? []
}

function adicionarCondicao() {
  condicoes.value.push({ perguntaId: '', opcao: '' })
}

function removerCondicao(idx: number) {
  condicoes.value.splice(idx, 1)
}

/** Trocar a pergunta de origem invalida a opção: as opções são de outra lista. */
function trocarOrigem(c: CondicaoEdicao) {
  c.opcao = ''
}

/* ---------- Opções (tipo OPCOES) ---------- */
const opcoes = ref<OpcaoEdicao[]>([])

function adicionarOpcao() {
  opcoes.value.push({ rotulo: '', alerta: null })
}

function removerOpcao(idx: number) {
  opcoes.value.splice(idx, 1)
}

function moverOpcao(idx: number, delta: number) {
  const alvo = idx + delta
  if (alvo < 0 || alvo >= opcoes.value.length) return
  const [item] = opcoes.value.splice(idx, 1)
  if (!item) return
  opcoes.value.splice(alvo, 0, item)
}

function alternarAlerta(op: OpcaoEdicao) {
  op.alerta = op.alerta ? null : { texto: '', tipo: 'aviso' }
}

/* Garante ao menos uma linha em branco quando o tipo vira OPCOES. */
watch(
  () => form.tipo,
  (tipo) => {
    if (tipo === 'OPCOES' && opcoes.value.length === 0) adicionarOpcao()
  },
)

/* ---------- Salvar ---------- */
const salvando = ref(false)
const erroLocal = ref('')

function validar(): string | null {
  if (!form.rotulo.trim()) return 'Informe o rótulo da pergunta.'
  if (form.tipo === 'OPCOES') {
    if (opcoes.value.length === 0) return 'Adicione pelo menos uma opção de resposta.'
    if (opcoes.value.some((o) => !o.rotulo.trim())) {
      return 'Preencha o rótulo de todas as opções (ou remova as vazias).'
    }
  }
  for (const [i, c] of condicoes.value.entries()) {
    if (!c.perguntaId) return `Escolha a pergunta de origem da condição ${i + 1}.`
    if (!c.opcao) return `Escolha a opção da condição ${i + 1}.`
  }
  // Duas condições iguais não mudam nada e só confundem quem lê a lista.
  const vistas = new Set<string>()
  for (const c of condicoes.value) {
    const chave = `${c.perguntaId}::${c.opcao}`
    if (vistas.has(chave)) return 'Há condições repetidas — remova a duplicada.'
    vistas.add(chave)
  }
  return null
}

/** Monta as opções limpas: rótulos aparados; alerta só vai se tiver texto. */
function montarOpcoes(): FormularioOpcao[] {
  return opcoes.value.map((o) => {
    const op: FormularioOpcao = { rotulo: o.rotulo.trim() }
    if (o.alerta && o.alerta.texto.trim()) {
      const alerta: FormularioOpcaoAlerta = { texto: o.alerta.texto.trim(), tipo: o.alerta.tipo }
      if (o.alerta.encerra) alerta.encerra = true
      if (o.alerta.exigeAnexo) alerta.exigeAnexo = true
      if (o.alerta.linkRotulo?.trim() && o.alerta.linkUrl?.trim()) {
        alerta.linkRotulo = o.alerta.linkRotulo.trim()
        alerta.linkUrl = o.alerta.linkUrl.trim()
      }
      op.alerta = alerta
    }
    return op
  })
}

/** Condições limpas: descarta linha abandonada (origem ou opção vazia). */
function montarCondicoes(): FormularioCondicao[] {
  return condicoes.value
    .filter((c) => c.perguntaId && c.opcao)
    .map((c) => ({ perguntaId: c.perguntaId, opcao: c.opcao }))
}

async function salvar() {
  const problema = validar()
  if (problema) {
    erroLocal.value = problema
    return
  }
  erroLocal.value = ''
  salvando.value = true
  const payload: AtualizarPerguntaFormularioPayload = {
    rotulo: form.rotulo.trim(),
    ...(form.ajuda.trim() ? { ajuda: form.ajuda.trim() } : {}),
    tipo: form.tipo,
    obrigatoria: form.obrigatoria,
    ativa: form.ativa,
    ordem: Number.isFinite(form.ordem) ? form.ordem : 0,
    // Na EDIÇÃO, enviar null/[] limpa vínculos/opções antigos; na criação, omite.
    ...(form.tipo === 'OPCOES' ? { opcoes: montarOpcoes() } : editando.value ? { opcoes: [] } : {}),
    // `condicoes` é a fonte da verdade; o backend espelha o par legado sozinho.
    ...(condicoes.value.length || editando.value ? { condicoes: montarCondicoes() } : {}),
  }
  try {
    if (editando.value && props.pergunta) {
      await atualizarPerguntaFormulario(props.pergunta.id, payload)
    } else {
      await criarPerguntaFormulario({
        ...payload,
        categoriaId: props.categoria.id,
        rotulo: form.rotulo.trim(),
        tipo: form.tipo,
      })
    }
    ui.success('Pergunta salva.')
    emit('salvo')
    emit('fechar')
  } catch (e) {
    ui.error(apiError(e, 'Falha ao salvar a pergunta.'))
  } finally {
    salvando.value = false
  }
}

onMounted(() => {
  if (props.pergunta) {
    const p = props.pergunta
    form.rotulo = p.rotulo
    form.ajuda = p.ajuda || ''
    form.tipo = p.tipo
    form.obrigatoria = p.obrigatoria
    form.ativa = p.ativa
    form.ordem = p.ordem
    condicoes.value = condicoesDe(p).map((c) => ({ perguntaId: c.perguntaId, opcao: c.opcao }))
    opcoes.value = (p.opcoes ?? []).map((o) => ({
      rotulo: o.rotulo,
      alerta: o.alerta ? { ...o.alerta } : null,
    }))
  } else {
    form.ordem = props.ordemSugerida
  }
})
</script>

<template>
  <BaseModal
    :aberto="true"
    :titulo="editando ? 'Editar pergunta' : `Nova pergunta — ${categoria.nome}`"
    @fechar="emit('fechar')"
  >
    <div class="form-col">
      <div class="field">
        <label>Rótulo da pergunta *</label>
        <input v-model="form.rotulo" class="input" placeholder="Ex.: Qual o tipo de problema?" />
      </div>

      <div class="field">
        <label>Texto de ajuda <span class="opcional">(opcional)</span></label>
        <input v-model="form.ajuda" class="input" placeholder="Exibido abaixo da pergunta, em texto menor" />
      </div>

      <div class="grid-2">
        <div class="field">
          <label>Tipo de resposta *</label>
          <select v-model="form.tipo" class="select-input">
            <option value="OPCOES">Opções (escolha única)</option>
            <option value="TEXTO">Texto (linha única)</option>
            <option value="TEXTO_LONGO">Texto longo (parágrafo)</option>
            <option value="ESCOLA">Escola (lista de unidades)</option>
            <option value="ARQUIVO">Anexo (foto ou PDF)</option>
          </select>
        </div>
        <div class="field">
          <label>Ordem de exibição</label>
          <input v-model.number="form.ordem" type="number" class="input" min="0" step="1" />
        </div>
      </div>

      <p v-if="form.tipo === 'ESCOLA'" class="dica">
        Aparece uma lista com todas as escolas cadastradas. A resposta vai junto do chamado como texto
        e também pode ser usada como condição de outras perguntas.
      </p>
      <p v-else-if="form.tipo === 'ARQUIVO'" class="dica">
        Aparece um campo para anexar foto ou PDF. Cada pergunta de anexo tem o seu próprio arquivo, e o
        anexo é permanente — diferente do anexo do atendimento, que expira em 7 dias.
      </p>

      <div class="checks-linha">
        <label class="check-linha">
          <input v-model="form.obrigatoria" type="checkbox" />
          Resposta obrigatória
        </label>
        <label class="check-linha">
          <input v-model="form.ativa" type="checkbox" />
          Pergunta ativa
        </label>
      </div>

      <!-- Exibição condicional: sempre, ou quando qualquer uma das condições for satisfeita -->
      <div class="field">
        <label>Exibição</label>
        <ul v-if="condicoes.length === 0" class="cond-opcoes">
          <li>
            <button class="cond-opcao ativa" type="button" disabled>
              <strong>Sempre exibir</strong>
              <span>A pergunta aparece para todo mundo.</span>
            </button>
          </li>
          <li>
            <button class="cond-opcao" type="button" @click="adicionarCondicao">
              <strong>Exibir quando...</strong>
              <span>Só aparece se a resposta for uma das opções marcadas.</span>
            </button>
          </li>
        </ul>

        <div v-else class="cond-bloco">
          <p class="dica">
            A pergunta aparece quando <strong>qualquer uma</strong> das condições abaixo for verdadeira.
          </p>

          <ul class="cond-lista">
            <li v-for="(c, i) in condicoes" :key="i" class="cond-item">
              <div class="cond-linha">
                <select v-model="c.perguntaId" class="select-input" @change="trocarOrigem(c)">
                  <option value="" disabled>Pergunta de origem...</option>
                  <option v-for="p in perguntasCondicionaveis" :key="p.id" :value="p.id">{{ p.rotulo }}</option>
                </select>
                <select v-model="c.opcao" class="select-input" :disabled="!c.perguntaId">
                  <option value="" disabled>Opção que a libera...</option>
                  <option v-for="(o, j) in opcoesDa(c.perguntaId)" :key="j" :value="o.rotulo">{{ o.rotulo }}</option>
                </select>
                <button class="ico-btn perigo" type="button" title="Remover condição" @click="removerCondicao(i)">
                  <X :size="15" />
                </button>
              </div>
            </li>
          </ul>

          <div class="cond-rodape">
            <button class="btn btn-outline cond-add" type="button" @click="adicionarCondicao">
              <Plus :size="14" />
              Adicionar condição
            </button>
            <button class="btn btn-outline cond-limpar" type="button" @click="condicoes = []">
              Exibir sempre
            </button>
          </div>
        </div>

        <p v-if="condicoes.length > 0 && perguntasCondicionaveis.length === 0" class="dica">
          Nenhuma pergunta de opções nesta categoria para usar como condição.
        </p>
      </div>

      <!-- Editor de opções -->
      <div v-if="form.tipo === 'OPCOES'" class="field">
        <label>Opções de resposta *</label>
        <ul class="ops-lista">
          <li v-for="(op, i) in opcoes" :key="i" class="op-item">
            <div class="op-linha">
              <div class="op-ordem">
                <button
                  class="ico-btn"
                  type="button"
                  title="Mover para cima"
                  :disabled="i === 0"
                  @click="moverOpcao(i, -1)"
                >
                  <ArrowUp :size="13" />
                </button>
                <button
                  class="ico-btn"
                  type="button"
                  title="Mover para baixo"
                  :disabled="i === opcoes.length - 1"
                  @click="moverOpcao(i, 1)"
                >
                  <ArrowDown :size="13" />
                </button>
              </div>
              <input v-model="op.rotulo" class="input" :placeholder="`Opção ${i + 1}`" />
              <button
                class="ico-btn op-alertar"
                :class="{ ativo: !!op.alerta }"
                type="button"
                :title="op.alerta ? 'Remover alerta desta opção' : 'Adicionar alerta a esta opção'"
                @click="alternarAlerta(op)"
              >
                <MessageSquareWarning :size="15" />
              </button>
              <button class="ico-btn perigo" type="button" title="Remover opção" @click="removerOpcao(i)">
                <X :size="15" />
              </button>
            </div>

            <div v-if="op.alerta" class="alerta-box">
              <textarea
                v-model="op.alerta.texto"
                class="input"
                rows="2"
                placeholder="Texto do alerta exibido ao selecionar esta opção *"
              ></textarea>
              <div class="alerta-linha">
                <select v-model="op.alerta.tipo" class="select-input alerta-tipo">
                  <option value="info">Informativo (azul)</option>
                  <option value="aviso">Aviso (amarelo)</option>
                </select>
                <label class="check-linha">
                  <input v-model="op.alerta.encerra" type="checkbox" />
                  Bloqueia o avanço do formulário
                </label>
                <label class="check-linha">
                  <input v-model="op.alerta.exigeAnexo" type="checkbox" />
                  Exige anexo na etapa final
                </label>
              </div>
              <div class="grid-2">
                <input v-model="op.alerta.linkRotulo" class="input" placeholder="Rótulo do link (opcional)" />
                <input v-model="op.alerta.linkUrl" class="input" placeholder="URL do link (opcional)" />
              </div>
            </div>
          </li>
        </ul>
        <div>
          <button class="btn btn-outline btn-add-op" type="button" @click="adicionarOpcao">
            <Plus :size="15" />
            Adicionar opção
          </button>
        </div>
      </div>
    </div>

    <p v-if="erroLocal" class="erro-form">{{ erroLocal }}</p>

    <template #footer>
      <button class="btn btn-outline" type="button" @click="emit('fechar')">Cancelar</button>
      <button class="btn btn-primary" type="button" :disabled="salvando" @click="salvar">
        <Loader2 v-if="salvando" class="spin" :size="16" />
        {{ editando ? 'Salvar alterações' : 'Adicionar pergunta' }}
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.form-col {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.opcional {
  font-weight: 400;
  color: var(--text-muted);
  font-size: 11px;
}

.dica {
  margin: 6px 0 0;
  font-size: 11.5px;
  color: var(--text-muted);
}

.checks-linha {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.check-linha {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
}

.check-linha input {
  accent-color: var(--sidebar-bg);
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

/* Escolha inicial entre "sempre" e "condicionada". */
.cond-opcoes {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cond-opcao {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 9px 12px;
  text-align: left;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  cursor: pointer;
}

.cond-opcao span {
  font-size: 12px;
  color: var(--text-muted);
}

.cond-opcao.ativa {
  border-color: var(--brand-gold);
  background: var(--surface-muted);
  cursor: default;
}

.cond-bloco {
  margin-top: 10px;
  padding: 12px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
}

.cond-lista {
  list-style: none;
  margin: 0 0 10px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cond-item {
  display: flex;
  align-items: center;
}

.cond-linha {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 8px;
  align-items: center;
  width: 100%;
}

.cond-rodape {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cond-add,
.cond-limpar {
  padding: 6px 10px;
  font-size: 12.5px;
  border-style: dashed;
}

/* ---------- Opções ---------- */
.ops-lista {
  list-style: none;
  margin: 0 0 10px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.op-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.op-linha {
  display: flex;
  align-items: center;
  gap: 6px;
}

.op-linha .input {
  flex: 1;
  min-width: 0;
}

.op-ordem {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
}

.ico-btn {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  color: var(--text-muted);
  flex-shrink: 0;
}

.ico-btn:hover:not(:disabled) {
  background: var(--surface-muted);
  color: var(--text-primary);
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
}

.op-alertar.ativo {
  color: var(--yellow);
  background: var(--yellow-soft);
}

.btn-add-op {
  padding: 7px 12px;
  font-size: 13px;
}

.alerta-box {
  margin-left: 32px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-left: 3px solid var(--yellow);
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alerta-linha {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.alerta-tipo {
  max-width: 190px;
}

.erro-form {
  margin-top: 14px;
  font-size: 13px;
  font-weight: 500;
  color: var(--red);
  background: var(--red-soft);
  border-radius: var(--radius-sm);
  padding: 9px 12px;
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
  .grid-2 {
    grid-template-columns: 1fr;
  }
  .alerta-box {
    margin-left: 0;
  }
  .alerta-tipo {
    max-width: none;
    width: 100%;
  }
}
</style>
