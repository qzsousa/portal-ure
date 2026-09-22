<script setup lang="ts">
/**
 * Modal de criar/editar tutorial (base de conhecimento).
 * Montado sob demanda pelas views com v-if (por isso o BaseModal fica sempre
 * aberto enquanto o componente existir). Emite `salvo` após gravar e
 * `categoria-criada` quando a mini-form de categoria cria uma nova.
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { Loader2, Paperclip, Plus, X } from '@lucide/vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { apiError } from '@/utils/apiError'
import {
  arquivoParaBase64,
  atualizarTutorial,
  criarCategoriaTutorial,
  criarTutorial,
  type AtualizarTutorialPayload,
  type Tutorial,
  type TutorialAnexo,
  type TutorialAnexoNovo,
  type TutorialCategoria,
} from '@/api/tutoriais'
import { useUiStore } from '@/stores/ui'

const props = withDefaults(
  defineProps<{
    tutorial?: Tutorial | null // null/ausente = criar
    categorias: TutorialCategoria[]
  }>(),
  { tutorial: null },
)

const emit = defineEmits<{
  (e: 'fechar'): void
  (e: 'salvo'): void
  (e: 'categoria-criada', categoria: TutorialCategoria): void
}>()

const ui = useUiStore()

const LIMITE_ANEXOS = 5
const TAMANHO_MAX_ANEXO = 5 * 1024 * 1024 // 5 MB por arquivo

const form = reactive({ titulo: '', subtitulo: '', conteudo: '', categoriaId: '' })
const editando = computed(() => props.tutorial !== null)

/* ---------- Anexos ---------- */
const anexosAtuais = ref<TutorialAnexo[]>([]) // já existentes (edição)
const removerAnexoIds = ref<string[]>([]) // existentes marcados para remover
const novosAnexos = ref<TutorialAnexoNovo[]>([]) // novos, já em base64

const anexosMantidos = computed(() => anexosAtuais.value.filter((a) => !removerAnexoIds.value.includes(a.id)))
const totalAnexos = computed(() => anexosMantidos.value.length + novosAnexos.value.length)

function alternarRemocaoAnexo(a: TutorialAnexo) {
  removerAnexoIds.value = removerAnexoIds.value.includes(a.id)
    ? removerAnexoIds.value.filter((id) => id !== a.id)
    : [...removerAnexoIds.value, a.id]
}

async function onArquivosSelecionados(e: Event) {
  const input = e.target as HTMLInputElement
  const arquivos = Array.from(input.files || [])
  input.value = '' // permite escolher o mesmo arquivo de novo
  for (const file of arquivos) {
    if (totalAnexos.value >= LIMITE_ANEXOS) {
      ui.error(`Máximo de ${LIMITE_ANEXOS} anexos por tutorial.`)
      break
    }
    if (file.size > TAMANHO_MAX_ANEXO) {
      ui.error(`O arquivo "${file.name}" excede o limite de 5 MB.`)
      continue
    }
    try {
      const base64 = await arquivoParaBase64(file)
      novosAnexos.value.push({ nome: file.name, tipo: file.type || undefined, base64 })
    } catch {
      ui.error(`Não foi possível ler o arquivo "${file.name}".`)
    }
  }
}

function removerNovoAnexo(indice: number) {
  novosAnexos.value.splice(indice, 1)
}

/* ---------- Criação rápida de categoria ---------- */
const novaCategoriaAberta = ref(false)
const novaCategoria = reactive({ nome: '', cor: '#081a33', descricao: '' })
const criandoCategoria = ref(false)

async function criarNovaCategoria() {
  if (!novaCategoria.nome.trim()) {
    ui.error('Informe o nome da categoria.')
    return
  }
  criandoCategoria.value = true
  try {
    const criada = await criarCategoriaTutorial({
      nome: novaCategoria.nome.trim(),
      cor: novaCategoria.cor || undefined,
      descricao: novaCategoria.descricao.trim() || undefined,
    })
    ui.success('Categoria criada.')
    form.categoriaId = criada.id
    emit('categoria-criada', criada)
    novaCategoriaAberta.value = false
    novaCategoria.nome = ''
    novaCategoria.descricao = ''
  } catch (e) {
    ui.error(apiError(e, 'Falha ao criar a categoria.'))
  } finally {
    criandoCategoria.value = false
  }
}

/* ---------- Salvar ---------- */
const salvando = ref(false)
const erroLocal = ref('')

function validar(): string | null {
  if (!form.titulo.trim()) return 'Informe o título do tutorial.'
  if (!form.categoriaId) return 'Selecione a categoria.'
  if (!form.conteudo.trim()) return 'Escreva o conteúdo do tutorial.'
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
    if (editando.value && props.tutorial) {
      const payload: AtualizarTutorialPayload = {
        titulo: form.titulo.trim(),
        subtitulo: form.subtitulo.trim(),
        conteudo: form.conteudo,
        categoriaId: form.categoriaId,
      }
      if (novosAnexos.value.length) payload.anexosNovos = novosAnexos.value
      if (removerAnexoIds.value.length) payload.removerAnexoIds = removerAnexoIds.value
      await atualizarTutorial(props.tutorial.id, payload)
    } else {
      await criarTutorial({
        titulo: form.titulo.trim(),
        subtitulo: form.subtitulo.trim() || undefined,
        conteudo: form.conteudo,
        categoriaId: form.categoriaId,
        anexos: novosAnexos.value.length ? novosAnexos.value : undefined,
      })
    }
    ui.success('Tutorial salvo.')
    emit('salvo')
    emit('fechar')
  } catch (e) {
    ui.error(apiError(e, 'Falha ao salvar tutorial.'))
  } finally {
    salvando.value = false
  }
}

onMounted(() => {
  if (props.tutorial) {
    form.titulo = props.tutorial.titulo
    form.subtitulo = props.tutorial.subtitulo || ''
    form.conteudo = props.tutorial.conteudo
    form.categoriaId = props.tutorial.categoriaId
    anexosAtuais.value = [...props.tutorial.anexos]
  }
})
</script>

<template>
  <BaseModal :aberto="true" :titulo="editando ? 'Editar tutorial' : 'Novo tutorial'" @fechar="emit('fechar')">
    <div class="form-col">
      <div class="field">
        <label>Título *</label>
        <input v-model="form.titulo" class="input" placeholder="Ex.: Como resetar a senha do e-mail institucional" />
      </div>

      <div class="field">
        <label>Subtítulo <span class="opcional">(opcional)</span></label>
        <input v-model="form.subtitulo" class="input" placeholder="Resumo curto exibido nos cartões" />
      </div>

      <div class="field">
        <label>Categoria *</label>
        <div class="categoria-linha">
          <select v-model="form.categoriaId" class="select-input">
            <option value="" disabled>Selecione...</option>
            <option v-for="c in categorias" :key="c.id" :value="c.id">{{ c.nome }}</option>
          </select>
          <button
            class="btn btn-outline btn-nova-categoria"
            type="button"
            @click="novaCategoriaAberta = !novaCategoriaAberta"
          >
            <Plus :size="15" />
            Nova categoria
          </button>
        </div>

        <div v-if="novaCategoriaAberta" class="nova-categoria">
          <div class="nova-categoria-linha">
            <input v-model="novaCategoria.nome" class="input" placeholder="Nome da categoria *" />
            <input v-model="novaCategoria.cor" type="color" class="cor-input" title="Cor da categoria" />
          </div>
          <input v-model="novaCategoria.descricao" class="input" placeholder="Descrição (opcional)" />
          <div class="nova-categoria-acoes">
            <button class="btn btn-primary" type="button" :disabled="criandoCategoria" @click="criarNovaCategoria">
              <Loader2 v-if="criandoCategoria" class="spin" :size="15" />
              Criar
            </button>
            <button
              class="btn btn-outline"
              type="button"
              :disabled="criandoCategoria"
              @click="novaCategoriaAberta = false"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>

      <div class="field">
        <label>Conteúdo *</label>
        <textarea
          v-model="form.conteudo"
          class="input textarea"
          rows="10"
          placeholder="Escreva o passo a passo, uma linha por etapa..."
        ></textarea>
        <p class="dica">As quebras de linha são preservadas na exibição.</p>
      </div>

      <div class="field">
        <label>
          Anexos
          <span class="opcional">(opcional — até {{ LIMITE_ANEXOS }} arquivos de 5 MB cada)</span>
        </label>
        <input type="file" class="arquivo-input" multiple @change="onArquivosSelecionados" />

        <ul v-if="anexosAtuais.length || novosAnexos.length" class="anexos-lista">
          <li
            v-for="a in anexosAtuais"
            :key="a.id"
            class="anexo-item"
            :class="{ removido: removerAnexoIds.includes(a.id) }"
          >
            <Paperclip :size="14" />
            <span class="anexo-nome">{{ a.nome }}</span>
            <template v-if="removerAnexoIds.includes(a.id)">
              <span class="badge-remover">Será removido</span>
              <button class="anexo-desfazer" type="button" @click="alternarRemocaoAnexo(a)">Desfazer</button>
            </template>
            <button
              v-else
              class="anexo-remover"
              type="button"
              title="Remover anexo"
              @click="alternarRemocaoAnexo(a)"
            >
              <X :size="14" />
            </button>
          </li>
          <li v-for="(n, i) in novosAnexos" :key="`novo-${i}`" class="anexo-item">
            <Paperclip :size="14" />
            <span class="anexo-nome">{{ n.nome }}</span>
            <span class="badge-novo">Novo</span>
            <button class="anexo-remover" type="button" title="Remover anexo" @click="removerNovoAnexo(i)">
              <X :size="14" />
            </button>
          </li>
        </ul>
      </div>
    </div>

    <p v-if="erroLocal" class="erro-form">{{ erroLocal }}</p>

    <template #footer>
      <button class="btn btn-outline" type="button" @click="emit('fechar')">Cancelar</button>
      <button class="btn btn-primary" type="button" :disabled="salvando" @click="salvar">
        <Loader2 v-if="salvando" class="spin" :size="16" />
        {{ editando ? 'Salvar alterações' : 'Publicar tutorial' }}
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

.opcional {
  font-weight: 400;
  color: var(--text-muted);
  font-size: 11px;
}

.textarea {
  resize: vertical;
  min-height: 200px;
}

.dica {
  margin: 0;
  font-size: 11.5px;
  color: var(--text-muted);
}

.categoria-linha {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.categoria-linha .select-input {
  flex: 1;
  min-width: 0;
}

.btn-nova-categoria {
  flex-shrink: 0;
  white-space: nowrap;
}

.nova-categoria {
  margin-top: 10px;
  padding: 12px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nova-categoria-linha {
  display: flex;
  gap: 8px;
  align-items: center;
}

.cor-input {
  width: 42px;
  height: 38px;
  padding: 2px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
  cursor: pointer;
  flex-shrink: 0;
}

.nova-categoria-acoes {
  display: flex;
  gap: 8px;
}

.nova-categoria-acoes .btn {
  padding: 7px 12px;
  font-size: 13px;
}

.arquivo-input {
  font-size: 12.5px;
  color: var(--text-muted);
}

.anexos-lista {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.anexo-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 12.5px;
  color: var(--text-secondary);
}

.anexo-item.removido {
  opacity: 0.65;
  background: var(--surface-muted);
}

.anexo-item.removido .anexo-nome {
  text-decoration: line-through;
}

.anexo-nome {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge-remover {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--red);
  background: var(--red-soft);
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
}

.badge-novo {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--green);
  background: var(--green-soft);
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
}

.anexo-remover {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  color: var(--text-muted);
  flex-shrink: 0;
}

.anexo-remover:hover {
  background: var(--red-soft);
  color: var(--red);
}

.anexo-desfazer {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--blue);
  white-space: nowrap;
}

.anexo-desfazer:hover {
  text-decoration: underline;
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
</style>
