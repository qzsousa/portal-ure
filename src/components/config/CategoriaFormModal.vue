<script setup lang="ts">
/**
 * Modal de criar/editar categoria do formulário de chamados (ADMIN).
 * Montado sob demanda com v-if (o BaseModal fica sempre aberto enquanto
 * o componente existir). Ao criar, a chave é sugerida como slug do nome,
 * mas continua editável. Emite `salvo` após gravar — o pai recarrega a lista.
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { Loader2 } from '@lucide/vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { apiError } from '@/utils/apiError'
import {
  atualizarCategoriaFormulario,
  criarCategoriaFormulario,
  type CriarCategoriaFormularioPayload,
  type FormularioCategoria,
} from '@/api/formulario'
import { useUiStore } from '@/stores/ui'

const props = withDefaults(
  defineProps<{
    categoria?: FormularioCategoria | null // null/ausente = criar
    ordemSugerida?: number
  }>(),
  { categoria: null, ordemSugerida: 0 },
)

const emit = defineEmits<{
  (e: 'fechar'): void
  (e: 'salvo'): void
}>()

const ui = useUiStore()
const editando = computed(() => props.categoria !== null)

/** Slug usado como sugestão de chave (minúsculas, sem acento, separado por hífens). */
function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const form = reactive({ nome: '', chave: '', descricao: '', cor: '#081a33', ordem: 0, ativa: true })
/** Enquanto o admin não editar a chave manualmente, ela acompanha o nome. */
const chaveTocada = ref(false)

function aoDigitarNome() {
  if (!editando.value && !chaveTocada.value) form.chave = slugify(form.nome)
}

const salvando = ref(false)
const erroLocal = ref('')

async function salvar() {
  if (!form.nome.trim()) {
    erroLocal.value = 'Informe o nome da categoria.'
    return
  }
  erroLocal.value = ''
  salvando.value = true
  const payload: CriarCategoriaFormularioPayload = {
    nome: form.nome.trim(),
    chave: form.chave.trim() || undefined,
    descricao: form.descricao.trim() || undefined,
    cor: form.cor || undefined,
    ordem: Number.isFinite(form.ordem) ? form.ordem : 0,
    ativa: form.ativa,
  }
  try {
    if (editando.value && props.categoria) {
      await atualizarCategoriaFormulario(props.categoria.id, payload)
    } else {
      await criarCategoriaFormulario(payload)
    }
    ui.success('Categoria salva.')
    emit('salvo')
    emit('fechar')
  } catch (e) {
    ui.error(apiError(e, 'Falha ao salvar a categoria.'))
  } finally {
    salvando.value = false
  }
}

onMounted(() => {
  if (props.categoria) {
    form.nome = props.categoria.nome
    form.chave = props.categoria.chave
    form.descricao = props.categoria.descricao || ''
    form.cor = props.categoria.cor || '#081a33'
    form.ordem = props.categoria.ordem
    form.ativa = props.categoria.ativa
    chaveTocada.value = true
  } else {
    form.ordem = props.ordemSugerida
  }
})
</script>

<template>
  <BaseModal :aberto="true" :titulo="editando ? 'Editar categoria' : 'Nova categoria'" @fechar="emit('fechar')">
    <div class="form-col">
      <div class="grid-2">
        <div class="field">
          <label>Nome *</label>
          <input v-model="form.nome" class="input" placeholder="Ex.: Rede e internet" @input="aoDigitarNome" />
        </div>
        <div class="field">
          <label>Chave</label>
          <input
            v-model="form.chave"
            class="input"
            placeholder="rede-e-internet"
            @input="chaveTocada = true"
          />
          <p class="dica">Identificador único (slug). Gerado a partir do nome, mas pode ser editado.</p>
        </div>
      </div>

      <div class="field">
        <label>Descrição <span class="opcional">(opcional)</span></label>
        <input v-model="form.descricao" class="input" placeholder="Texto curto exibido na abertura de chamado" />
      </div>

      <div class="grid-3">
        <div class="field">
          <label>Cor</label>
          <input v-model="form.cor" type="color" class="cor-input" title="Cor da categoria" />
        </div>
        <div class="field">
          <label>Ordem de exibição</label>
          <input v-model.number="form.ordem" type="number" class="input" min="0" step="1" />
        </div>
        <div class="field">
          <label>Status</label>
          <label class="check-linha">
            <input v-model="form.ativa" type="checkbox" />
            Categoria ativa (visível no formulário público)
          </label>
        </div>
      </div>
    </div>

    <p v-if="erroLocal" class="erro-form">{{ erroLocal }}</p>

    <template #footer>
      <button class="btn btn-outline" type="button" @click="emit('fechar')">Cancelar</button>
      <button class="btn btn-primary" type="button" :disabled="salvando" @click="salvar">
        <Loader2 v-if="salvando" class="spin" :size="16" />
        {{ editando ? 'Salvar alterações' : 'Criar categoria' }}
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

.grid-3 {
  display: grid;
  grid-template-columns: auto 140px 1fr;
  gap: 12px;
  align-items: start;
}

.opcional {
  font-weight: 400;
  color: var(--text-muted);
  font-size: 11px;
}

.dica {
  margin: 0;
  font-size: 11.5px;
  color: var(--text-muted);
}

.cor-input {
  width: 48px;
  height: 40px;
  padding: 2px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
  cursor: pointer;
}

.check-linha {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  min-height: 40px;
  cursor: pointer;
}

.check-linha input {
  accent-color: var(--sidebar-bg);
  width: 15px;
  height: 15px;
  flex-shrink: 0;
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
  .grid-2,
  .grid-3 {
    grid-template-columns: 1fr;
  }
}
</style>
