<script setup lang="ts">
/**
 * Modal de criar/editar equipamento (portal → SCE).
 * Segue as regras do backend SCE:
 * - numeroSerie obrigatório OU justificativaNumeroSerie
 * - status 'Extraviado' exige boletimOcorrencia + anexo do B.O.
 * - status 'Quebrado' exige descricaoQuebrado
 * - status 'Manutenção' aceita numeroChamadoManutencao
 * - status 'Em verificação' exige justificativaVerificacao
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Loader2, Paperclip, X } from '@lucide/vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { apiError } from '@/utils/apiError'
import {
  atualizarEquipamento,
  criarEquipamento,
  listarCatalogo,
  listarFiliais,
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

const STATUS_OPCOES = [
  'Disponível',
  'Manutenção',
  'Quebrado',
  'Em verificação',
  'Extraviado',
  'Emprestado',
  'Inservível',
]

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
  justificativaVerificacao: '',
  boletimOcorrencia: '',
  observacoes: '',
})

const anexo = ref<{ base64: string; mimeType: string; fileName: string } | null>(null)
const filiais = ref<string[]>([])
const catalogo = ref<ItemLista[]>([])
const carregandoBase = ref(false)
const salvando = ref(false)
const erroLocal = ref('')

const editando = computed(() => props.item !== null)

const categorias = computed(() => [...new Set(catalogo.value.map((i) => i.categoria))].sort())
const marcasFiltradas = computed(() =>
  [...new Set(catalogo.value.filter((i) => !form.categoria || i.categoria === form.categoria).map((i) => i.marca))].sort(),
)
const modelosFiltrados = computed(() =>
  [
    ...new Set(
      catalogo.value
        .filter((i) => (!form.categoria || i.categoria === form.categoria) && (!form.marca || i.marca === form.marca))
        .map((i) => i.modelo),
    ),
  ].sort(),
)

function preencher(item: Equipamento | null) {
  erroLocal.value = ''
  anexo.value = null
  if (item) {
    form.unidade = item.unidade
    form.categoria = item.categoria
    form.marca = item.marca
    form.modelo = item.modelo
    form.patrimonio = item.patrimonio || ''
    form.numeroSerie = item.numeroSerie || ''
    form.justificativaNumeroSerie = ''
    form.status = item.status
    form.numeroChamadoManutencao = item.numeroChamadoManutencao || ''
    form.descricaoQuebrado = item.descricaoQuebrado || ''
    form.justificativaVerificacao = ''
    form.boletimOcorrencia = ''
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
    form.justificativaVerificacao = ''
    form.boletimOcorrencia = ''
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

function selecionarAnexo(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (file.size > 8 * 1024 * 1024) {
    erroLocal.value = 'O anexo deve ter no máximo 8MB.'
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    const base64 = String(reader.result).split(',')[1] || ''
    anexo.value = { base64, mimeType: file.type, fileName: file.name }
    erroLocal.value = ''
  }
  reader.readAsDataURL(file)
}

function validar(): string | null {
  if (!form.unidade) return 'Selecione a unidade escolar.'
  if (!form.categoria.trim() || !form.marca.trim() || !form.modelo.trim())
    return 'Categoria, marca e modelo são obrigatórios.'
  if (!form.numeroSerie.trim() && !form.justificativaNumeroSerie.trim())
    return 'Informe o número de série ou justifique a ausência.'
  if (form.status === 'Quebrado' && !form.descricaoQuebrado.trim())
    return 'Para o status "Quebrado", descreva o problema.'
  if (form.status === 'Em verificação' && !form.justificativaVerificacao.trim())
    return 'Para "Em verificação", informe a justificativa.'
  if (form.status === 'Extraviado') {
    if (!form.boletimOcorrencia.trim()) return 'Para "Extraviado", informe o número do Boletim de Ocorrência.'
    if (!editando.value && !anexo.value) return 'Para "Extraviado", anexe o Boletim de Ocorrência.'
  }
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
      categoria: form.categoria.trim(),
      marca: form.marca.trim(),
      modelo: form.modelo.trim(),
      patrimonio: form.patrimonio.trim(),
      numeroSerie: form.numeroSerie.trim(),
      justificativaNumeroSerie: form.justificativaNumeroSerie.trim(),
      status: form.status,
      numeroChamadoManutencao: form.numeroChamadoManutencao.trim(),
      descricaoQuebrado: form.descricaoQuebrado.trim(),
      justificativaVerificacao: form.justificativaVerificacao.trim(),
      boletimOcorrencia: form.boletimOcorrencia.trim(),
      observacoes: form.observacoes.trim(),
    }
    if (anexo.value) payload._anexoBoletim = anexo.value

    if (editando.value && props.item) {
      // update-equipamento espera apenas os campos alterados
      const it = props.item
      const campos: Record<string, string | undefined> = {}
      const chComp: Array<[keyof EquipamentoPayload, string | undefined | null]> = [
        ['categoria', it.categoria],
        ['marca', it.marca],
        ['modelo', it.modelo],
        ['patrimonio', it.patrimonio],
        ['numeroSerie', it.numeroSerie],
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
      if (form.boletimOcorrencia.trim()) campos.boletimOcorrencia = form.boletimOcorrencia.trim()
      if (form.justificativaVerificacao.trim()) campos.justificativaVerificacao = form.justificativaVerificacao.trim()
      if (anexo.value) campos._anexoBoletim = anexo.value as unknown as string

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
    const [f, c] = await Promise.all([listarFiliais(), listarCatalogo()])
    filiais.value = f
    catalogo.value = c
  } catch {
    // catálogo/filiais indisponíveis não bloqueiam (campos livres)
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
          <option v-for="f in filiais" :key="f" :value="f">{{ f }}</option>
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
        <input v-model="form.categoria" class="input" list="dl-categorias" placeholder="Ex.: Notebook" />
        <datalist id="dl-categorias">
          <option v-for="c in categorias" :key="c" :value="c" />
        </datalist>
      </div>

      <div class="field">
        <label>Marca *</label>
        <input v-model="form.marca" class="input" list="dl-marcas" placeholder="Ex.: Lenovo" />
        <datalist id="dl-marcas">
          <option v-for="m in marcasFiltradas" :key="m" :value="m" />
        </datalist>
      </div>

      <div class="field">
        <label>Modelo *</label>
        <input v-model="form.modelo" class="input" list="dl-modelos" placeholder="Ex.: ThinkCentre M720" />
        <datalist id="dl-modelos">
          <option v-for="m in modelosFiltrados" :key="m" :value="m" />
        </datalist>
      </div>

      <div class="field">
        <label>Patrimônio</label>
        <input v-model="form.patrimonio" class="input" placeholder="Opcional" />
      </div>

      <div class="field">
        <label>Nº de série</label>
        <input v-model="form.numeroSerie" class="input" placeholder="Ou justifique abaixo" />
      </div>

      <div v-if="!form.numeroSerie" class="field">
        <label>Justificativa (sem nº de série)</label>
        <input v-model="form.justificativaNumeroSerie" class="input" placeholder="Ex.: etiqueta apagada" />
      </div>

      <div v-if="form.status === 'Manutenção'" class="field">
        <label>Nº do chamado de manutenção</label>
        <input v-model="form.numeroChamadoManutencao" class="input" placeholder="Ex.: CH-20260916-0004" />
      </div>

      <div v-if="form.status === 'Quebrado'" class="field full">
        <label>Descrição do problema *</label>
        <textarea v-model="form.descricaoQuebrado" class="input textarea" placeholder="O que aconteceu com o equipamento?" />
      </div>

      <div v-if="form.status === 'Em verificação'" class="field full">
        <label>Justificativa da verificação *</label>
        <input v-model="form.justificativaVerificacao" class="input" placeholder="Motivo da verificação" />
      </div>

      <template v-if="form.status === 'Extraviado'">
        <div class="field">
          <label>Nº do Boletim de Ocorrência *</label>
          <input v-model="form.boletimOcorrencia" class="input" placeholder="Ex.: BO 2026/123456" />
        </div>
        <div class="field">
          <label>Anexo do B.O. {{ editando ? '(se novo)' : '*' }}</label>
          <label class="anexo-btn" :class="{ 'tem-anexo': anexo }">
            <Paperclip :size="15" />
            <span>{{ anexo ? anexo.fileName : 'Escolher arquivo (máx. 8MB)' }}</span>
            <input type="file" hidden accept=".pdf,image/*" @change="selecionarAnexo" />
            <button v-if="anexo" type="button" class="anexo-x" @click.stop.prevent="anexo = null"><X :size="14" /></button>
          </label>
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

.anexo-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  position: relative;
}

.anexo-btn:hover {
  border-color: var(--blue);
  color: var(--blue);
}

.anexo-btn.tem-anexo {
  border-style: solid;
  color: var(--text-primary);
}

.anexo-x {
  margin-left: auto;
  display: grid;
  place-items: center;
  color: var(--text-muted);
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
