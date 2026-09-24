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
import {
  atualizarPerguntaFormulario,
  criarPerguntaFormulario,
  type AtualizarPerguntaFormularioPayload,
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
const condicional = ref(false)
const dependeDePerguntaId = ref('')
const dependeDeOpcao = ref('')

/** Somente perguntas de OPÇÕES da mesma categoria podem ser "base" (nunca ela mesma). */
const perguntasCondicionaveis = computed(() =>
  [...(props.categoria.perguntas ?? [])]
    .filter((p) => p.tipo === 'OPCOES' && p.id !== props.pergunta?.id)
    .sort((a, b) => a.ordem - b.ordem),
)

const perguntaBase = computed(
  () => perguntasCondicionaveis.value.find((p) => p.id === dependeDePerguntaId.value) ?? null,
)
const opcoesDaBase = computed(() => perguntaBase.value?.opcoes ?? [])

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
  if (condicional.value) {
    if (!dependeDePerguntaId.value) return 'Escolha a pergunta da qual esta depende.'
    if (!dependeDeOpcao.value) return 'Escolha a opção que faz esta pergunta aparecer.'
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
    ...(condicional.value
      ? { dependeDePerguntaId: dependeDePerguntaId.value, dependeDeOpcao: dependeDeOpcao.value }
      : editando.value
        ? { dependeDePerguntaId: null, dependeDeOpcao: null }
        : {}),
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
    condicional.value = !!p.dependeDePerguntaId
    dependeDePerguntaId.value = p.dependeDePerguntaId || ''
    dependeDeOpcao.value = p.dependeDeOpcao || ''
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
          </select>
        </div>
        <div class="field">
          <label>Ordem de exibição</label>
          <input v-model.number="form.ordem" type="number" class="input" min="0" step="1" />
        </div>
      </div>

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

      <!-- Exibição condicional -->
      <div class="field">
        <label>Exibição</label>
        <select
          class="select-input"
          :value="condicional ? 'condicional' : 'sempre'"
          @change="condicional = ($event.target as HTMLSelectElement).value === 'condicional'"
        >
          <option value="sempre">Sempre exibir</option>
          <option value="condicional">Exibir quando...</option>
        </select>

        <div v-if="condicional" class="cond-bloco">
          <div class="grid-2">
            <select v-model="dependeDePerguntaId" class="select-input" @change="dependeDeOpcao = ''">
              <option value="" disabled>Pergunta de origem...</option>
              <option v-for="p in perguntasCondicionaveis" :key="p.id" :value="p.id">{{ p.rotulo }}</option>
            </select>
            <select v-model="dependeDeOpcao" class="select-input" :disabled="!perguntaBase">
              <option value="" disabled>Opção que a libera...</option>
              <option v-for="(o, i) in opcoesDaBase" :key="i" :value="o.rotulo">{{ o.rotulo }}</option>
            </select>
          </div>
          <p v-if="perguntasCondicionaveis.length === 0" class="dica">
            Nenhuma pergunta de opções nesta categoria para usar como condição.
          </p>
          <p v-else class="dica">
            A pergunta só aparece quando a resposta escolhida for exatamente essa opção.
          </p>
        </div>
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

.cond-bloco {
  margin-top: 10px;
  padding: 12px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
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
