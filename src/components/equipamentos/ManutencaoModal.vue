<script setup lang="ts">
/**
 * Registro de manutenção a partir do equipamento.
 *
 * O SCE guarda um registro por intervenção (autor, data, descrição, status) e
 * espelha o status em `equipamentos.statusManutencao`. A tela `/manutencao`
 * continua sendo só de leitura: o registro nasce aqui, na linha do
 * equipamento, como no SCE.
 */
import { computed, ref, watch } from 'vue'
import { Loader2, Wrench } from '@lucide/vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import { apiError } from '@/utils/apiError'
import {
  atualizarStatusManutencao,
  listarRegistrosManutencao,
  registrarManutencao,
  type RegistroManutencao,
} from '@/api/sce'
import { formatDateTime } from '@/utils/format'
import { useUiStore } from '@/stores/ui'
import type { Equipamento, StatusManutencao } from '@/types'

const props = defineProps<{
  aberto: boolean
  item: Equipamento | null
}>()

const emit = defineEmits<{ (e: 'fechar'): void; (e: 'registrado'): void }>()

const ui = useUiStore()

/** Mesmas opções aceitas pelo SCE (`statusManutencaoValidos` em server.js). */
const STATUS_OPCOES: StatusManutencao[] = ['Pendente', 'Em andamento', 'Concluído']

const status = ref<StatusManutencao>('Pendente')
const descricao = ref('')
const registros = ref<RegistroManutencao[]>([])
const carregando = ref(false)
const salvando = ref(false)
const erroLocal = ref('')

const titulo = computed(() => `Manutenção — ${props.item?.modelo || 'equipamento'}`)

async function carregarRegistros(item: Equipamento) {
  carregando.value = true
  try {
    registros.value = await listarRegistrosManutencao(item.id)
  } catch {
    registros.value = []
  } finally {
    carregando.value = false
  }
}

/** Acompanha o equipamento para trocar as intervenções sem reabrir o modal. */
watch(
  () => [props.aberto, props.item?.id],
  () => {
    if (!props.aberto || !props.item) return
    status.value = 'Pendente'
    descricao.value = ''
    erroLocal.value = ''
    /* Abrir já no status que o equipamento carrega evita gravar um
     * "Pendente" sobre um serviço que já estava em andamento. */
    const atual = (props.item.statusManutencao || '') as StatusManutencao
    if (STATUS_OPCOES.includes(atual)) status.value = atual
    void carregarRegistros(props.item)
  },
)

function validar(): string | null {
  if (!descricao.value.trim()) return 'Descreva o que foi feito.'
  return null
}

async function salvar() {
  if (!props.item) return
  const problema = validar()
  if (problema) {
    erroLocal.value = problema
    return
  }
  erroLocal.value = ''
  salvando.value = true
  try {
    await registrarManutencao(props.item.id, descricao.value.trim(), status.value)
    ui.success('Manutenção registrada.')
    emit('registrado')
    emit('fechar')
  } catch (e) {
    erroLocal.value = apiError(e, 'Falha ao registrar a manutenção.')
  } finally {
    salvando.value = false
  }
}

/**
 * Troca o andamento sem abrir registro novo — é o que a lista de registros
 * oferece por linha, para quem só precisa sair de "Pendente".
 */
async function mover(r: RegistroManutencao, novo: StatusManutencao) {
  if (novo === r.status) return
  try {
    await atualizarStatusManutencao(r.equipamento_id, novo)
    r.status = novo
    ui.success('Status da manutenção atualizado.')
    emit('registrado')
  } catch (e) {
    ui.error(apiError(e, 'Falha ao atualizar o status da manutenção.'))
  }
}
</script>

<template>
  <BaseModal :aberto="aberto" :titulo="titulo" @fechar="emit('fechar')">
    <div class="alvo">
      <span class="alvo-rotulo">Equipamento</span>
      <strong>{{ item?.modelo || '—' }}</strong>
      <span class="alvo-meta">
        {{ item?.patrimonio || 'sem patrimônio' }} · {{ item?.unidade }}
      </span>
    </div>

    <div class="form-grid">
      <div class="field">
        <label>Status da manutenção *</label>
        <select v-model="status" class="select-input">
          <option v-for="s in STATUS_OPCOES" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>

      <div class="field full">
        <label>O que foi feito / observado *</label>
        <textarea
          v-model="descricao"
          class="input textarea"
          placeholder="Descreva a intervenção, a troca de peça, a-peça que voltou..."
        />
      </div>
    </div>

    <h4 class="hist-title">Registros anteriores</h4>
    <p v-if="carregando" class="hist-vazio">Carregando registros...</p>
    <p v-else-if="registros.length === 0" class="hist-vazio">Nenhum registro ainda.</p>
    <ul v-else class="registros">
      <li v-for="r in registros" :key="r.id">
        <div class="reg-topo">
          <StatusPill :status="r.status" />
          <small>{{ r.autor }} · {{ formatDateTime(r.data) }}</small>
        </div>
        <p class="reg-desc">{{ r.descricao }}</p>
        <div class="reg-acoes">
          <button
            v-for="s in STATUS_OPCOES"
            :key="s"
            class="btn-mini"
            type="button"
            :disabled="s === r.status"
            @click="mover(r, s)"
          >
            {{ s }}
          </button>
        </div>
      </li>
    </ul>

    <p v-if="erroLocal" class="erro-form">{{ erroLocal }}</p>

    <template #footer>
      <button class="btn btn-outline" type="button" @click="emit('fechar')">Fechar</button>
      <button class="btn btn-primary" type="button" :disabled="salvando || !item" @click="salvar">
        <Loader2 v-if="salvando" class="spin" :size="16" />
        <Wrench v-else :size="16" />
        Registrar manutenção
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.alvo {
  margin-bottom: 16px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
}

.alvo-rotulo {
  display: block;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.alvo strong {
  display: block;
  color: var(--text-primary);
  font-size: 14px;
}

.alvo-meta {
  display: block;
  font-size: 12.5px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.field.full {
  grid-column: 1 / -1;
}

.textarea {
  min-height: 84px;
  resize: vertical;
}

.hist-title {
  font-size: 14px;
  margin: 20px 0 10px;
}

.hist-vazio {
  color: var(--text-muted);
  font-size: 13px;
}

.registros {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 220px;
  overflow-y: auto;
}

.registros li {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.reg-topo {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.reg-topo small {
  color: var(--text-muted);
  font-size: 11.5px;
}

.reg-desc {
  margin: 6px 0 8px;
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.45;
}

.reg-acoes {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.btn-mini {
  padding: 3px 9px;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--surface);
}

.btn-mini:hover:not(:disabled) {
  border-color: var(--blue);
  color: var(--blue);
  background: var(--blue-soft);
}

.btn-mini:disabled {
  opacity: 0.45;
  cursor: default;
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
