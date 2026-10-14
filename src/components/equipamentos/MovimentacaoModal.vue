<script setup lang="ts">
/**
 * Empréstimo e devolução de equipamentos.
 *
 * Um componente para os dois movimentos porque eles compartilham a seleção e o
 * cabeçalho da lista de equipamentos — no SCE eram dois modais separados
 * acionados por botões próprios ("Emprestar" / "Devolver").
 *
 * O SCE aceita N equipamentos por requisição (`ids`), então a mesma tela
 * atende o clique na linha e a ação em lote da tabela.
 */
import { computed, ref, watch } from 'vue'
import { Loader2 } from '@lucide/vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { apiError } from '@/utils/apiError'
import {
  listarFiliais,
  registrarDevolucao,
  registrarEmprestimo,
  type TipoEmprestimo,
} from '@/api/sce'
import { formatDate } from '@/utils/format'
import { useUiStore } from '@/stores/ui'
import type { Equipamento } from '@/types'

const props = defineProps<{
  aberto: boolean
  modo: 'emprestar' | 'devolver'
  /** Equipamentos da linha acionada ou da seleção em lote. */
  itens: Equipamento[]
}>()

const emit = defineEmits<{ (e: 'fechar'): void; (e: 'concluido'): void }>()

const ui = useUiStore()

const form = ref({
  tipoEmprestimo: 'interno' as TipoEmprestimo,
  responsavel: '',
  cpf: '',
  emailResponsavel: '',
  dataPrevistaDevolucao: '',
  escolaDestino: '',
  observacoes: '',
})

const filiais = ref<string[]>([])
const carregandoFiliais = ref(false)
const salvando = ref(false)
const erroLocal = ref('')

const emprestando = computed(() => props.modo === 'emprestar')
const titulo = computed(() =>
  emprestando.value
    ? `Registrar empréstimo — ${props.itens.length} equipamento(s)`
    : `Registrar devolução — ${props.itens.length} equipamento(s)`,
)
const interEscolar = computed(() => emprestando.value && form.value.tipoEmprestimo === 'interestadual')

/** A escola de origem não pode ser o destino — nem a de nenhum item do lote. */
const escolasDestino = computed(() => {
  const origem = new Set(props.itens.map((i) => i.unidade))
  return filiais.value.filter((f) => !origem.has(f))
})

/** Máscara de CPF: o usuário digita só números. */
const cpfFormatado = computed({
  get: () => {
    const d = form.value.cpf.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 3) return d
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  },
  set: (v: string) => {
    form.value.cpf = v.replace(/\D/g, '').slice(0, 11)
  },
})

function reset() {
  form.value = {
    tipoEmprestimo: 'interno',
    responsavel: '',
    cpf: '',
    emailResponsavel: '',
    dataPrevistaDevolucao: '',
    escolaDestino: '',
    observacoes: '',
  }
  erroLocal.value = ''
  if (emprestando.value && !filiais.value.length) void carregarFiliais()
}

async function carregarFiliais() {
  carregandoFiliais.value = true
  try {
    filiais.value = await listarFiliais()
  } catch {
    filiais.value = []
  } finally {
    carregandoFiliais.value = false
  }
}

watch(
  () => [props.aberto, props.modo],
  () => {
    if (props.aberto) reset()
  },
)

function validar(): string | null {
  if (props.itens.length === 0) return 'Selecione pelo menos um equipamento.'
  if (emprestando.value) {
    if (!form.value.responsavel.trim()) return 'Informe o responsável pelo equipamento.'
    if (interEscolar.value && !form.value.escolaDestino) return 'Selecione a escola de destino.'
    return null
  }
  // O SCE ignora equipamento sem empréstimo ativo (não há o que encerrar), e a
  // resposta volta 200 — sem esta trava a devolução pareceria ter funcionado.
  const semEmprestimo = props.itens.filter((i) => !i.emprestimo)
  if (semEmprestimo.length === props.itens.length)
    return 'Nenhum dos equipamentos selecionados está com empréstimo em aberto.'
  return null
}

async function salvar() {
  const problema = validar()
  if (problema) {
    erroLocal.value = problema
    return
  }
  erroLocal.value = ''
  salvando.value = true
  const ids = props.itens.map((i) => i.id)
  try {
    if (emprestando.value) {
      await registrarEmprestimo({
        ids,
        responsavel: form.value.responsavel.trim(),
        cpf: form.value.cpf,
        emailResponsavel: form.value.emailResponsavel.trim(),
        dataPrevistaDevolucao: form.value.dataPrevistaDevolucao,
        observacoes: form.value.observacoes.trim(),
        tipoEmprestimo: form.value.tipoEmprestimo,
        escolaDestino: interEscolar.value ? form.value.escolaDestino : '',
      })
      ui.success(`${props.itens.length} equipamento(s) marcado(s) como Emprestado.`)
    } else {
      await registrarDevolucao(ids, form.value.observacoes.trim())
      ui.success(`${props.itens.length} equipamento(s) devolvido(s).`)
    }
    emit('concluido')
    emit('fechar')
  } catch (e) {
    erroLocal.value = apiError(e, emprestando.value ? 'Falha ao registrar o empréstimo.' : 'Falha ao registrar a devolução.')
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <BaseModal :aberto="aberto" :titulo="titulo" @fechar="emit('fechar')">
    <!-- Equipamentos afetados: loans em lote precisam de conferência antes. -->
    <div class="lista-itens">
      <span class="lista-rotulo">Equipamentos</span>
      <ul>
        <li v-for="i in itens" :key="i.id">
          <strong>{{ i.modelo || 'Sem modelo' }}</strong>
          <span>{{ i.patrimonio || 'sem patrimônio' }} · {{ i.unidade }}</span>
          <!-- Devolução: mostra quem levou e há quanto tempo está fora. Um item
               emprestado semloan aberto não pode ser devolvido — o SCE ignora
               silenciosamente, então avisar aqui evita a devolução "fantasma". -->
          <span v-if="!emprestando && i.emprestimo" class="linha-emprestado">
            {{ i.emprestimo.responsavel || 'sem responsável' }}
            <template v-if="i.emprestimo.dataPrevistaDevolucao">
              · previsto {{ formatDate(i.emprestimo.dataPrevistaDevolucao) }}
            </template>
            <template v-if="i.emprestimo.emAtraso">
              · <strong>{{ i.emprestimo.diasAtraso }} dia(s) em atraso</strong>
            </template>
          </span>
          <span v-else-if="!emprestando" class="linha-sem-emprestimo">sem empréstimo em aberto</span>
        </li>
      </ul>
    </div>

    <div class="form-grid">
      <template v-if="emprestando">
        <div class="field full">
          <label>Tipo de empréstimo *</label>
          <div class="radio-linha">
            <label class="radio">
              <input v-model="form.tipoEmprestimo" type="radio" value="interno" />
              <span>Para responsável da mesma unidade</span>
            </label>
            <label class="radio">
              <input v-model="form.tipoEmprestimo" type="radio" value="interestadual" />
              <span>Para outra unidade/escola</span>
            </label>
          </div>
        </div>

        <div v-if="interEscolar" class="field full">
          <label>Escola de destino *</label>
          <select v-model="form.escolaDestino" class="select-input" :disabled="carregandoFiliais">
            <option value="" disabled>
              {{ carregandoFiliais ? 'Carregando...' : 'Selecione...' }}
            </option>
            <option v-for="f in escolasDestino" :key="f" :value="f">{{ f }}</option>
          </select>
        </div>

        <div class="field">
          <label>Responsável *</label>
          <input v-model="form.responsavel" class="input" placeholder="Quem vai usar o equipamento" />
        </div>

        <div class="field">
          <label>CPF <span class="opcional">(opcional)</span></label>
          <input v-model="cpfFormatado" class="input" inputmode="numeric" placeholder="000.000.000-00" />
        </div>

        <div class="field">
          <label>E-mail do responsável <span class="opcional">(opcional)</span></label>
          <input
            v-model="form.emailResponsavel"
            class="input"
            type="email"
            placeholder="responsavel@escola.sp.gov.br"
          />
        </div>

        <div class="field">
          <label>Data prevista de devolução <span class="opcional">(opcional)</span></label>
          <input v-model="form.dataPrevistaDevolucao" class="input" type="date" />
        </div>
      </template>

      <div class="field full">
        <label>Observações</label>
        <textarea v-model="form.observacoes" class="input textarea" placeholder="Opcional" />
      </div>
    </div>

    <p v-if="erroLocal" class="erro-form">{{ erroLocal }}</p>

    <template #footer>
      <button class="btn btn-outline" type="button" @click="emit('fechar')">Cancelar</button>
      <button class="btn btn-primary" type="button" :disabled="salvando" @click="salvar">
        <Loader2 v-if="salvando" class="spin" :size="16" />
        {{ emprestando ? 'Registrar empréstimo' : 'Registrar devolução' }}
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.lista-itens {
  margin-bottom: 16px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
}

.lista-rotulo {
  display: block;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.lista-itens ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 140px;
  overflow-y: auto;
}

.lista-itens li {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: baseline;
  font-size: 12.5px;
  color: var(--text-secondary);
}

.lista-itens strong {
  color: var(--text-primary);
}

/* Recado de devolução: quem levou, o prazo e o atraso, logo abaixo do item. */
.linha-emprestado {
  flex-basis: 100%;
  padding-left: 10px;
  border-left: 2px solid var(--border-strong);
  color: var(--text-muted);
  font-size: 12px;
}

.linha-emprestado strong {
  color: var(--red);
}

.linha-sem-emprestimo {
  flex-basis: 100%;
  padding-left: 10px;
  border-left: 2px dashed var(--border);
  color: var(--text-muted);
  font-size: 12px;
  font-style: italic;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.field.full {
  grid-column: 1 / -1;
}

.opcional {
  font-weight: 400;
  color: var(--text-muted);
  font-size: 11px;
}

.textarea {
  min-height: 74px;
  resize: vertical;
}

.radio-linha {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  padding-top: 4px;
}

.radio {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
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

@media (max-width: 560px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
