<script setup lang="ts">
/**
 * Modal de criar/editar equipamento (portal → SCE).
 * Regras:
 * - cascata Categoria → Marca → Modelo (catálogo do próprio parque instalado)
 * - número de série OBRIGATÓRIO
 * - status reduzidos: Disponível / Manutenção / Quebrado / Emprestado
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Loader2 } from '@lucide/vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { apiError } from '@/utils/apiError'
import {
  atualizarEquipamento,
  criarEquipamento,
  listarCatalogoCompleto,
  listarUnidadesResumo,
  type EquipamentoPayload,
  type ItemLista,
} from '@/api/sce'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import type { Equipamento } from '@/types'

const props = defineProps<{
  aberto: boolean
  item: Equipamento | null // null = criar
}>()

const emit = defineEmits<{ (e: 'fechar'): void; (e: 'salvo'): void }>()

const auth = useAuthStore()
const ui = useUiStore()

const STATUS_OPCOES = ['Disponível', 'Manutenção', 'Quebrado', 'Emprestado']

/** Marcador para a opção "Outro (digitar)" da cascata. */
const OUTRO = '__OUTRO__'

const form = reactive({
  unidade: '',
  categoria: '',
  marca: '',
  modelo: '',
  patrimonio: '',
  numeroSerie: '',
  justificativaNumeroSerie: '',
  status: 'Disponível',
  numeroChamadoManutencao: '',
  descricaoQuebrado: '',
  observacoes: '',
})

/** Valores livres quando a opção "Outro" é escolhida. */
const custom = reactive({ categoria: '', marca: '', modelo: '' })

const unidades = ref<string[]>([])
const catalogo = ref<ItemLista[]>([])
const carregandoBase = ref(false)
const salvando = ref(false)
const erroLocal = ref('')

const editando = computed(() => props.item !== null)

const categorias = computed(() => [...new Set(catalogo.value.map((i) => i.categoria))].sort())
const marcasFiltradas = computed(() =>
  form.categoria
    ? [...new Set(catalogo.value.filter((i) => i.categoria === form.categoria).map((i) => i.marca))].sort()
    : [],
)
const modelosFiltrados = computed(() =>
  form.categoria && form.marca
    ? [
        ...new Set(
          catalogo.value
            .filter((i) => i.categoria === form.categoria && i.marca === form.marca)
            .map((i) => i.modelo),
        ),
      ].sort()
    : [],
)

function onCategoria() {
  form.marca = form.categoria === OUTRO ? OUTRO : ''
  form.modelo = form.categoria === OUTRO ? OUTRO : ''
}
function onMarca() {
  form.modelo = form.marca === OUTRO ? OUTRO : ''
}

/** Valor final (texto livre quando "Outro"). */
const valorCategoria = computed(() => (form.categoria === OUTRO ? custom.categoria.trim() : form.categoria))
const valorMarca = computed(() => (form.marca === OUTRO ? custom.marca.trim() : form.marca))
const valorModelo = computed(() => (form.modelo === OUTRO ? custom.modelo.trim() : form.modelo))

function preencher(item: Equipamento | null) {
  erroLocal.value = ''
  custom.categoria = ''
  custom.marca = ''
  custom.modelo = ''
  if (item) {
    form.unidade = item.unidade
    form.categoria = item.categoria
    form.marca = item.marca
    form.modelo = item.modelo
    form.patrimonio = item.patrimonio || ''
    form.numeroSerie = item.numeroSerie || ''
    form.justificativaNumeroSerie = ''
    form.status = STATUS_OPCOES.includes(item.status) ? item.status : 'Disponível'
    form.numeroChamadoManutencao = item.numeroChamadoManutencao || ''
    form.descricaoQuebrado = item.descricaoQuebrado || ''
    form.observacoes = item.observacoes || ''
  } else {
    form.unidade = auth.user?.nivel === 'ADMIN' ? '' : auth.user?.filial || ''
    form.categoria = ''
    form.marca = ''
    form.modelo = ''
    form.patrimonio = ''
    form.numeroSerie = ''
    form.justificativaNumeroSerie = ''
    form.status = 'Disponível'
    form.numeroChamadoManutencao = ''
    form.descricaoQuebrado = ''
    form.observacoes = ''
  }
}

watch(
  () => [props.aberto, props.item],
  () => {
    if (props.aberto) preencher(props.item)
  },
  { immediate: true },
)

function validar(): string | null {
  if (!form.unidade) return 'Selecione a unidade escolar.'
  if (!valorCategoria.value) return 'Selecione (ou digite) a categoria.'
  if (!valorMarca.value) return 'Selecione (ou digite) a marca.'
  if (!valorModelo.value) return 'Selecione (ou digite) o modelo.'
  if (!form.numeroSerie.trim() && !form.justificativaNumeroSerie.trim())
    return 'Informe o número de série — ou justifique a ausência dele.'
  if (form.status === 'Quebrado' && !form.descricaoQuebrado.trim())
    return 'Para o status "Quebrado", descreva o problema.'
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
  try {
    const payload: EquipamentoPayload = {
      unidade: form.unidade,
      categoria: valorCategoria.value,
      marca: valorMarca.value,
      modelo: valorModelo.value,
      patrimonio: form.patrimonio.trim(),
      numeroSerie: form.numeroSerie.trim(),
      justificativaNumeroSerie: form.justificativaNumeroSerie.trim(),
      status: form.status,
      numeroChamadoManutencao: form.numeroChamadoManutencao.trim(),
      descricaoQuebrado: form.descricaoQuebrado.trim(),
      observacoes: form.observacoes.trim(),
    }

    if (editando.value && props.item) {
      const it = props.item
      const campos: Record<string, string | undefined> = {}
      const chComp: Array<[keyof EquipamentoPayload, string | undefined | null]> = [
        ['categoria', it.categoria],
        ['marca', it.marca],
        ['modelo', it.modelo],
        ['patrimonio', it.patrimonio],
        ['numeroSerie', it.numeroSerie],
        ['justificativaNumeroSerie', (it as unknown as Record<string, string>).justificativaNumeroSerie],
        ['status', it.status],
        ['numeroChamadoManutencao', it.numeroChamadoManutencao],
        ['descricaoQuebrado', it.descricaoQuebrado],
        ['observacoes', it.observacoes],
        ['unidade', it.unidade],
      ]
      for (const [campo, original] of chComp) {
        const novo = payload[campo] as string | undefined
        if (String(novo || '') !== String(original || '')) campos[campo] = novo || ''
      }
      if (Object.keys(campos).length === 0) {
        ui.info('Nenhuma alteração para salvar.')
        emit('fechar')
        return
      }
      await atualizarEquipamento(it.id, campos as Partial<EquipamentoPayload>)
      ui.success('Equipamento atualizado.')
    } else {
      await criarEquipamento(payload)
      ui.success('Equipamento cadastrado.')
    }
    emit('salvo')
    emit('fechar')
  } catch (e) {
    erroLocal.value = apiError(e, 'Falha ao salvar o equipamento.')
  } finally {
    salvando.value = false
  }
}

onMounted(async () => {
  carregandoBase.value = true
  try {
    const [u, c] = await Promise.all([listarUnidadesResumo(), listarCatalogoCompleto()])
    unidades.value = u.map((x) => x.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'))
    catalogo.value = c
  } catch {
    // catálogo/unidades indisponíveis: usuário ainda pode digitar livremente
  } finally {
    carregandoBase.value = false
  }
})
</script>

<template>
  <BaseModal
    :aberto="aberto"
    :titulo="editando ? `Editar — ${item?.modelo}` : 'Adicionar equipamento'"
    @fechar="emit('fechar')"
  >
    <div class="form-grid">
      <div class="field">
        <label>Unidade escolar *</label>
        <select
          v-if="auth.user?.nivel === 'ADMIN'"
          v-model="form.unidade"
          class="select-input"
          :disabled="carregandoBase"
        >
          <option value="" disabled>Selecione...</option>
          <option v-for="u in unidades" :key="u" :value="u">{{ u }}</option>
        </select>
        <input v-else class="input" :value="form.unidade" disabled />
      </div>

      <div class="field">
        <label>Status *</label>
        <select v-model="form.status" class="select-input">
          <option v-for="s in STATUS_OPCOES" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>

      <div class="field">
        <label>Categoria *</label>
        <select v-model="form.categoria" class="select-input" :disabled="carregandoBase" @change="onCategoria">
          <option value="" disabled>Selecione...</option>
          <option v-for="c in categorias" :key="c" :value="c">{{ c }}</option>
          <option :value="OUTRO">Outra (digitar manualmente)</option>
        </select>
        <input
          v-if="form.categoria === OUTRO"
          v-model="custom.categoria"
          class="input mt6"
          placeholder="Digite a categoria (ex.: Impressora)"
        />
      </div>

      <div class="field">
        <label>Marca *</label>
        <select v-model="form.marca" class="select-input" :disabled="!form.categoria" @change="onMarca">
          <option value="" disabled>{{ form.categoria ? 'Selecione...' : 'Escolha a categoria primeiro' }}</option>
          <option v-for="m in marcasFiltradas" :key="m" :value="m">{{ m }}</option>
          <option :value="OUTRO">Outra (digitar manualmente)</option>
        </select>
        <input
          v-if="form.marca === OUTRO"
          v-model="custom.marca"
          class="input mt6"
          placeholder="Digite a marca"
        />
      </div>

      <div class="field">
        <label>Modelo *</label>
        <select v-model="form.modelo" class="select-input" :disabled="!form.marca">
          <option value="" disabled>{{ form.marca ? 'Selecione...' : 'Escolha a marca primeiro' }}</option>
          <option v-for="m in modelosFiltrados" :key="m" :value="m">{{ m }}</option>
          <option :value="OUTRO">Outro (digitar manualmente)</option>
        </select>
        <input
          v-if="form.modelo === OUTRO"
          v-model="custom.modelo"
          class="input mt6"
          placeholder="Digite o modelo"
        />
      </div>

      <div class="field">
        <label>Patrimônio</label>
        <input v-model="form.patrimonio" class="input" placeholder="Opcional" />
      </div>

      <div class="field">
        <label>Nº de série</label>
        <input v-model="form.numeroSerie" class="input" placeholder="Se não houver, justifique abaixo" />
        <input
          v-if="!form.numeroSerie.trim()"
          v-model="form.justificativaNumeroSerie"
          class="input mt6"
          placeholder="Justificativa da ausência do nº de série *"
        />
      </div>

      <div v-if="form.status === 'Manutenção'" class="field">
        <label>Nº do chamado de manutenção</label>
        <input v-model="form.numeroChamadoManutencao" class="input" placeholder="Ex.: CH-20260916-0004" />
      </div>

      <div v-if="form.status === 'Quebrado'" class="field full">
        <label>Descrição do problema *</label>
        <textarea v-model="form.descricaoQuebrado" class="input textarea" placeholder="O que aconteceu com o equipamento?" />
      </div>

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
        {{ editando ? 'Salvar alterações' : 'Cadastrar equipamento' }}
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.field.full {
  grid-column: 1 / -1;
}

.textarea {
  min-height: 74px;
  resize: vertical;
}

.mt6 {
  margin-top: 6px;
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
