<script setup lang="ts">
/**
 * Modal de criar/editar equipamento (portal → SCE).
 * Regras:
 * - cascata Categoria → Marca → Modelo (catálogo do próprio parque instalado)
 * - número de série OBRIGATÓRIO
 * - detalhes técnicos (SO, processador, RAM, armazenamento, tela) são
 *   autopreenchidos pelo modelo selecionado e podem ser ajustados
 * - status "Extraviado" exige o Boletim de Ocorrência (nº + anexo) — o SCE
 *   recusa o cadastro sem o anexo
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { FileUp, Loader2, Paperclip, X } from '@lucide/vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { apiError } from '@/utils/apiError'
import { getEspecificacoesPorModelo } from '@/utils/catalogoModelos'
import {
  atualizarEquipamento,
  buscarEspecificacoesModelo,
  criarEquipamento,
  listarCatalogoCompleto,
  listarUnidadesResumo,
  type EquipamentoPayload,
  type ItemLista,
} from '@/api/sce'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import type { Equipamento } from '@/types'

/** Escola FILHA: só visualiza o parque compartilhado com a MÃE. */
const somenteLeitura = computed(() => auth.somenteLeituraEquipamentos)

const MODO_LEITURA_MSG =
  'Sua unidade tem acesso somente de visualização aos equipamentos compartilhados com a escola principal.'

const props = defineProps<{
  aberto: boolean
  item: Equipamento | null // null = criar
}>()

const emit = defineEmits<{ (e: 'fechar'): void; (e: 'salvo'): void }>()

const auth = useAuthStore()
const ui = useUiStore()

const STATUS_OPCOES = ['Disponível', 'Manutenção', 'Quebrado', 'Emprestado', 'Extraviado']

/** Marcador para a opção "Outro (digitar)" da cascata. */
const OUTRO = '__OUTRO__'

/** Mesmos limites do SCE (`validarAnexoBoletim` em security.js). */
const ANEXO_MAX_MB = 8
const ANEXO_EXTENSOES = ['.pdf', '.jpg', '.jpeg', '.png', '.webp']

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
  boletimOcorrencia: '',
  sistemaOperacional: '',
  processador: '',
  memoriaRAM: '',
  armazenamento: '',
  tamanhoTela: '',
  responsavelAtual: '',
  observacoes: '',
})

/** Valores livres quando a opção "Outro" é escolhida. */
const custom = reactive({ categoria: '', marca: '', modelo: '' })

const unidades = ref<string[]>([])
const catalogo = ref<ItemLista[]>([])
const carregandoBase = ref(false)
const salvando = ref(false)
const erroLocal = ref('')

/* ---------- Boletim de Ocorrência (status "Extraviado") ---------- */

/** Objeto selecionado pelo usuário, ainda não convertido em base64. */
const anexoArquivo = ref<File | null>(null)
/** Caminho do anexo já gravado no SCE (modo editar) — dispensa novo upload. */
const anexoJaSalvo = ref<string>('')
/** Input de arquivo real, escondido — o botão é o que o usuário aciona. */
const inputAnexo = ref<HTMLInputElement | null>(null)
/** Erro de validação do arquivo, mostrado junto ao campo. */
const erroAnexo = ref('')
/** Nome do arquivo recém-escolhido, exibido na lista. */
const nomeAnexo = ref('')

/** Busca as specs do modelo no SCE (o catálogo embutido responde na hora). */
const carregarSpecs = ref(false)

/** Evita que o autopreenchimento de specs rode enquanto o form é hidratado. */
let hidratando = true
/** Token anti-corrida das respostas de `especificacoes-modelo`. */
let tokenSpecs = 0

const editando = computed(() => props.item !== null)
const extraviado = computed(() => form.status === 'Extraviado')
/** Já existe B.O. no banco (ou upload novo): o SCE só exige UM dos dois. */
const temBoletim = computed(() => Boolean(anexoArquivo.value) || Boolean(anexoJaSalvo.value))

/** Extrai o nome do arquivo do caminho `boletins/<uuid>-anexo.pdf`. */
const arquivoDoAnexoSalvo = computed(() => {
  const p = anexoJaSalvo.value
  if (!p) return ''
  const base = p.split('/').pop() || p
  return base.replace(/^[0-9a-f-]{36}-/, '')
})

const nomeAnexoExibido = computed(() => nomeAnexo.value || arquivoDoAnexoSalvo.value)

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

/* ---------- Detalhes técnicos: autopreenchimento por modelo ---------- */

const CAMPOS_SPEC = ['sistemaOperacional', 'processador', 'memoriaRAM', 'armazenamento'] as const

/**
 * Preenche os detalhes técnicos a partir do modelo escolhido.
 *
 * Ordem: catálogo embutido (resposta imediata) e, se o modelo não estiver
 * nele, o endpoint `especificacoes-modelo`, que devolve as specs do
 * equipamento mais recente daquele modelo. As specs são sugestão — os campos
 * continuam editáveis, e o usuário pode apagar o que não se aplicar.
 */
async function autoPreencherSpecs() {
  tokenSpecs++
  const meuToken = tokenSpecs

  const modelo = valorModelo.value
  for (const c of CAMPOS_SPEC) form[c] = ''
  carregarSpecs.value = false
  if (!modelo || form.modelo === OUTRO) return

  const local = getEspecificacoesPorModelo(modelo)
  if (local) {
    if (meuToken !== tokenSpecs) return
    for (const c of CAMPOS_SPEC) form[c] = local[c]
    carregarSpecs.value = true
    return
  }

  carregarSpecs.value = true // mostra o "carregando" enquanto consulta o SCE
  try {
    const specs = await buscarEspecificacoesModelo(modelo)
    if (meuToken !== tokenSpecs || !specs) return
    for (const c of CAMPOS_SPEC) {
      if (specs[c]) form[c] = specs[c]
    }
  } catch {
    // Sem specs conhecidas: o usuário preenche à mão.
  } finally {
    if (meuToken === tokenSpecs) carregarSpecs.value = false
  }
}

/** Dispara o autopreenchimento quando o modelo muda. */
function onModelo() {
  if (!hidratando) autoPreencherSpecs()
}

/* ---------- Boletim de Ocorrência: escolha/limpeza do anexo ---------- */

function limparAnexo() {
  anexoArquivo.value = null
  nomeAnexo.value = ''
  erroAnexo.value = ''
  if (inputAnexo.value) inputAnexo.value.value = ''
}

function abrirSeletorAnexo() {
  erroAnexo.value = ''
  inputAnexo.value?.click()
}

/** Descarta o anexo. O arquivo no storage sai na proxima edicao. */
function removerAnexo() {
  limparAnexo()
  anexoJaSalvo.value = ''
}

/** Valida o arquivo escolhido e guarda o `File` (base64 só no envio). */
function onArquivoEscolhido(e: Event) {
  const alvo = e.target as HTMLInputElement
  const file = alvo.files?.[0]
  if (!file) return

  const ext = '.' + (file.name.split('.').pop() || '').toLowerCase()
  const problema = !ANEXO_EXTENSOES.includes(ext)
    ? `Formato não aceito. Envie ${ANEXO_EXTENSOES.join(', ')}.`
    : file.size > ANEXO_MAX_MB * 1024 * 1024
      ? `Arquivo muito grande. O tamanho máximo é de ${ANEXO_MAX_MB}MB.`
      : ''

  // Arquivo recusado: some com a seleção, mas mantém o motivo na tela.
  if (problema) {
    anexoArquivo.value = null
    nomeAnexo.value = ''
    anexoJaSalvo.value = ''
    if (inputAnexo.value) inputAnexo.value.value = ''
    erroAnexo.value = problema
    return
  }

  erroAnexo.value = ''
  anexoArquivo.value = file
  nomeAnexo.value = file.name
  // Trocar de arquivo substitui o B.O. já existente no banco: quem apaga o
  // arquivo antigo é o `update-equipamento`, não esta tela.
  anexoJaSalvo.value = ''

}

/** Lê o arquivo como base64 puro (sem o prefixo `data:`). */
function arquivoParaBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const resultado = String(reader.result || '')
      const virgula = resultado.indexOf(',')
      resolve(virgula >= 0 ? resultado.slice(virgula + 1) : resultado)
    }
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'))
    reader.readAsDataURL(file)
  })
}

function preencher(item: Equipamento | null) {
  // Enquanto hidrata, o watcher de `form.modelo` não pode sobrescrever os
  // detalhes técnicos que já vêm gravados no equipamento.
  hidratando = true
  tokenSpecs++
  erroLocal.value = ''
  erroAnexo.value = ''
  carregarSpecs.value = false
  anexoArquivo.value = null
  nomeAnexo.value = ''
  anexoJaSalvo.value = ''

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
    form.boletimOcorrencia = item.boletimOcorrencia || ''
    form.sistemaOperacional = item.sistemaOperacional || ''
    form.processador = item.processador || ''
    form.memoriaRAM = item.memoriaRAM || ''
    form.armazenamento = item.armazenamento || ''
    form.tamanhoTela = item.tamanhoTela || ''
    form.responsavelAtual = item.responsavelAtual || ''
    form.observacoes = item.observacoes || ''
    anexoJaSalvo.value = item.boletimOcorrenciaAnexoUrl || ''
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
    form.boletimOcorrencia = ''
    form.sistemaOperacional = ''
    form.processador = ''
    form.memoriaRAM = ''
    form.armazenamento = ''
    form.tamanhoTela = ''
    form.responsavelAtual = ''
    form.observacoes = ''
  }
  hidratando = false
}

/** Sai do "Extraviado" descarta o anexo escolhido (e o B.O. já salvo). */
watch(
  () => form.status,
  (novo, antigo) => {
    if (novo !== 'Extraviado' && antigo === 'Extraviado') {
      form.boletimOcorrencia = ''
      limparAnexo()
      anexoJaSalvo.value = ''
    }
  },
)

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
  // Marca e modelo são opcionais — há equipamentos sem essa identificação.
  if (!form.numeroSerie.trim() && !form.justificativaNumeroSerie.trim())
    return 'Informe o número de série — ou justifique a ausência dele.'
  if (form.status === 'Quebrado' && !form.descricaoQuebrado.trim())
    return 'Para o status "Quebrado", descreva o problema.'
  if (extraviado.value) {
    // O SCE exige o anexo do B.O. no cadastro e na edição para este status.
    if (!temBoletim.value)
      return 'Para o status "Extraviado", anexe o Boletim de Ocorrência.'
    if (!form.boletimOcorrencia.trim())
      return 'Informe o número do Boletim de Ocorrência.'
  }
  return null
}

async function salvar() {
  if (somenteLeitura.value) {
    erroLocal.value = MODO_LEITURA_MSG
    return
  }
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
      boletimOcorrencia: extraviado.value ? form.boletimOcorrencia.trim() : '',
      sistemaOperacional: form.sistemaOperacional.trim(),
      processador: form.processador.trim(),
      memoriaRAM: form.memoriaRAM.trim(),
      armazenamento: form.armazenamento.trim(),
      tamanhoTela: form.tamanhoTela.trim(),
      responsavelAtual: form.responsavelAtual.trim(),
      observacoes: form.observacoes.trim(),
    }

    // O anexo entra como base64 no corpo do POST (o SCE valida pelos magic
    // bytes e devolve o caminho em `boletim_ocorrencia_anexo_url`).
    if (extraviado.value && anexoArquivo.value) {
      payload._anexoBoletim = {
        base64: await arquivoParaBase64(anexoArquivo.value),
        mimeType: anexoArquivo.value.type,
        fileName: anexoArquivo.value.name,
      }
    }

    if (editando.value && props.item) {
      const it = props.item
      const campos: Record<string, unknown> = {}
      const chComp: Array<[keyof EquipamentoPayload, string | undefined | null]> = [
        ['categoria', it.categoria],
        ['marca', it.marca],
        ['modelo', it.modelo],
        ['patrimonio', it.patrimonio],
        ['numeroSerie', it.numeroSerie],
        ['justificativaNumeroSerie', it.justificativaNumeroSerie],
        ['status', it.status],
        ['numeroChamadoManutencao', it.numeroChamadoManutencao],
        ['descricaoQuebrado', it.descricaoQuebrado],
        ['boletimOcorrencia', it.boletimOcorrencia],
        ['sistemaOperacional', it.sistemaOperacional],
        ['processador', it.processador],
        ['memoriaRAM', it.memoriaRAM],
        ['armazenamento', it.armazenamento],
        ['tamanhoTela', it.tamanhoTela],
        ['responsavelAtual', it.responsavelAtual],
        ['observacoes', it.observacoes],
        ['unidade', it.unidade],
      ]
      for (const [campo, original] of chComp) {
        const novo = payload[campo] as string | undefined
        if (String(novo || '') !== String(original || '')) campos[campo] = novo || ''
      }
      // Anexo novo é uma mudança por si só (o SCE troca o arquivo no storage).
      if (payload._anexoBoletim) campos._anexoBoletim = payload._anexoBoletim
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
        <label>Marca <span class="opcional">(opcional)</span></label>
        <select v-model="form.marca" class="select-input" :disabled="!form.categoria" @change="onMarca">
          <option value="">{{ form.categoria ? '— Sem marca —' : 'Escolha a categoria primeiro' }}</option>
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
        <label>Modelo <span class="opcional">(opcional)</span></label>
        <select
          v-model="form.modelo"
          class="select-input"
          :disabled="!form.categoria || form.marca === OUTRO"
          @change="onModelo"
        >
          <option value="">{{ form.marca ? '— Sem modelo —' : 'Escolha a marca primeiro' }}</option>
          <option v-for="m in modelosFiltrados" :key="m" :value="m">{{ m }}</option>
          <option v-if="form.marca && form.marca !== OUTRO" :value="OUTRO">Outro (digitar manualmente)</option>
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

      <div v-if="extraviado" class="field full">
        <label>Boletim de Ocorrência *</label>
        <input
          v-model="form.boletimOcorrencia"
          class="input"
          placeholder="Nº do B.O. (ex.: B.O. 1234/2026)"
        />
        <p class="dica">
          O anexo do boletim é obrigatório: sem ele o SCE recusa o cadastro do equipamento.
        </p>

        <input
          ref="inputAnexo"
          type="file"
          class="hidden-file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          @change="onArquivoEscolhido"
        />

        <div v-if="nomeAnexoExibido" class="anexo-escolhido">
          <Paperclip :size="15" />
          <span class="anexo-nome">{{ nomeAnexoExibido }}</span>
          <span v-if="!anexoArquivo" class="anexo-tag">já anexado</span>
          <button class="anexo-remover" type="button" title="Remover anexo" @click="removerAnexo">
            <X :size="14" />
          </button>
        </div>

        <button
          v-else
          class="btn-upload"
          type="button"
          :disabled="somenteLeitura"
          @click="abrirSeletorAnexo"
        >
          <FileUp :size="16" />
          Anexar boletim *
        </button>

        <p v-if="erroAnexo" class="erro-form">{{ erroAnexo }}</p>
        <p class="dica">PDF, JPG, PNG ou WEBP — até {{ ANEXO_MAX_MB }}MB.</p>
      </div>

      <!-- Detalhes técnicos: autopreenchidos pelo modelo, editáveis. -->
      <template v-if="valorModelo">
        <div class="field full">
          <div class="secao-titulo">
            <span>Detalhes do equipamento</span>
            <span v-if="carregarSpecs" class="secao-dica">
              <Loader2 :size="12" class="spin" /> buscando especificações...
            </span>
            <span v-else-if="form.sistemaOperacional || form.processador" class="secao-dica">
              preenchido pelo modelo {{ valorModelo }}
            </span>
          </div>
        </div>

        <div class="field">
          <label>Sistema operacional <span class="opcional">(opcional)</span></label>
          <input v-model="form.sistemaOperacional" class="input" placeholder="Ex.: Windows 11 / Windows 10" />
        </div>

        <div class="field">
          <label>Processador <span class="opcional">(opcional)</span></label>
          <input v-model="form.processador" class="input" placeholder="Ex.: i5-1135G7" />
        </div>

        <div class="field">
          <label>Memória RAM <span class="opcional">(opcional)</span></label>
          <input v-model="form.memoriaRAM" class="input" placeholder="Ex.: 8 GB DDR4" />
        </div>

        <div class="field">
          <label>Armazenamento <span class="opcional">(opcional)</span></label>
          <input v-model="form.armazenamento" class="input" placeholder="Ex.: SSD M.2 256 GB" />
        </div>

        <div class="field">
          <label>Tamanho da tela <span class="opcional">(opcional)</span></label>
          <input v-model="form.tamanhoTela" class="input" placeholder="Ex.: 14&quot;" />
        </div>

        <div class="field">
          <label>Responsável atual <span class="opcional">(opcional)</span></label>
          <input v-model="form.responsavelAtual" class="input" placeholder="Quem está usando o equipamento" />
        </div>
      </template>

      <div class="field full">
        <label>Observações</label>
        <textarea v-model="form.observacoes" class="input textarea" placeholder="Opcional" />
      </div>
    </div>

    <p v-if="erroLocal" class="erro-form">{{ erroLocal }}</p>

    <template #footer>
      <button class="btn btn-outline" type="button" @click="emit('fechar')">
        {{ somenteLeitura ? 'Fechar' : 'Cancelar' }}
      </button>
      <button
        v-if="!somenteLeitura"
        class="btn btn-primary"
        type="button"
        :disabled="salvando"
        @click="salvar"
      >
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

.opcional {
  font-weight: 400;
  color: var(--text-muted);
  font-size: 11px;
}

.textarea {
  min-height: 74px;
  resize: vertical;
}

.mt6 {
  margin-top: 6px;
}

/* ---------- Detalhes técnicos ---------- */

.secao-titulo {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding-bottom: 8px;
  margin-bottom: 2px;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.secao-dica {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
  font-size: 11px;
  color: var(--text-muted);
}

/* ---------- Anexo do Boletim de Ocorrência ---------- */

.hidden-file {
  display: none;
}

.dica {
  margin-top: 6px;
  font-size: 11.5px;
  line-height: 1.45;
  color: var(--text-muted);
}

.btn-upload {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-top: 10px;
  padding: 9px 14px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--surface-muted);
  width: 100%;
  justify-content: center;
}

.btn-upload:hover:not(:disabled) {
  border-color: var(--blue);
  color: var(--blue);
  background: var(--blue-soft);
}

.btn-upload:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.anexo-escolhido {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding: 9px 12px;
  border: 1px solid var(--green);
  border-radius: var(--radius-sm);
  background: var(--green-soft);
  color: var(--green);
  font-size: 13px;
}

.anexo-nome {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.anexo-tag {
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--surface);
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.anexo-remover {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  color: inherit;
}

.anexo-remover:hover {
  background: var(--surface);
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

@media (max-width: 640px) {
  :deep(.modal-footer) {
    flex-wrap: wrap;
  }
}
</style>
