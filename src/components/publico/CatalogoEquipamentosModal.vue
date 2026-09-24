<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { AlertTriangle, Eraser, Loader2 } from '@lucide/vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import {
  listarCategoriasEquipamento,
  listarMarcasEquipamento,
  listarModelosEquipamento,
} from '@/api/publico'

/**
 * Catálogo de equipamentos SOMENTE LEITURA (versão pública): os selects de
 * categoria/marca/modelo funcionam como FILTROS em cascata e a tabela abaixo
 * lista o recorte resultante. Espelha a "consulta de catálogo" do formulário
 * Apps Script antigo ("Atende Leste 3").
 */

const props = defineProps<{ aberto: boolean }>()
defineEmits<{ (e: 'fechar'): void }>()

interface LinhaCatalogo {
  categoria: string
  marca: string
  modelo: string
}

const categorias = ref<string[]>([])
const marcas = ref<string[]>([])
const modelos = ref<string[]>([])
const carregando = ref(false)
const erro = ref('')
const buscou = ref(false)

const filtro = reactive({ categoria: '', marca: '', modelo: '' })

watch(
  () => props.aberto,
  (aberto) => {
    if (aberto && !buscou.value && !carregando.value) void carregarCategorias()
  },
)

async function carregarCategorias() {
  carregando.value = true
  erro.value = ''
  try {
    categorias.value = await listarCategoriasEquipamento()
    buscou.value = true
  } catch {
    erro.value = 'Não foi possível carregar o catálogo. Tente novamente.'
  } finally {
    carregando.value = false
  }
}

watch(
  () => filtro.categoria,
  async (categoria) => {
    filtro.marca = ''
    filtro.modelo = ''
    marcas.value = []
    modelos.value = []
    if (!categoria) return
    try {
      marcas.value = await listarMarcasEquipamento(categoria)
    } catch {
      marcas.value = []
    }
  },
)

watch(
  () => filtro.marca,
  async (marca) => {
    filtro.modelo = ''
    modelos.value = []
    if (!filtro.categoria || !marca) return
    try {
      modelos.value = await listarModelosEquipamento(filtro.categoria, marca)
    } catch {
      modelos.value = []
    }
  },
)

/** Linhas exibidas: recorte conforme o nível de filtro aplicado. */
const linhas = computed<LinhaCatalogo[]>(() => {
  if (filtro.categoria && filtro.marca) {
    const lista = filtro.modelo ? [filtro.modelo] : modelos.value
    if (lista.length) {
      return lista.map((modelo) => ({ categoria: filtro.categoria, marca: filtro.marca, modelo }))
    }
    return [{ categoria: filtro.categoria, marca: filtro.marca, modelo: '' }]
  }
  if (filtro.categoria) {
    if (marcas.value.length) {
      return marcas.value.map((marca) => ({ categoria: filtro.categoria, marca, modelo: '' }))
    }
    return [{ categoria: filtro.categoria, marca: '', modelo: '' }]
  }
  return categorias.value.map((categoria) => ({ categoria, marca: '', modelo: '' }))
})

function limparFiltros() {
  filtro.categoria = ''
  filtro.marca = ''
  filtro.modelo = ''
}
</script>

<template>
  <BaseModal titulo="Catálogo de Equipamentos" :aberto="aberto" @fechar="$emit('fechar')">
    <div class="catalogo">
      <p class="catalogo-dica">
        Consulte os equipamentos cadastrados. Use os filtros em cascata para refinar a lista.
      </p>

      <div v-if="erro" class="catalogo-erro">
        <AlertTriangle :size="15" />
        <span>{{ erro }}</span>
        <button type="button" class="catalogo-retry" @click="carregarCategorias">Tentar novamente</button>
      </div>

      <div class="filtros">
        <div class="field">
          <label for="cat-cat">Categoria</label>
          <select id="cat-cat" v-model="filtro.categoria" class="select-input" :disabled="carregando">
            <option value="">— Todas —</option>
            <option v-for="c in categorias" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div class="field">
          <label for="cat-marca">Marca</label>
          <select id="cat-marca" v-model="filtro.marca" class="select-input" :disabled="!filtro.categoria">
            <option value="">— Todas —</option>
            <option v-for="m in marcas" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
        <div class="field">
          <label for="cat-modelo">Modelo</label>
          <select id="cat-modelo" v-model="filtro.modelo" class="select-input" :disabled="!filtro.marca">
            <option value="">— Todos —</option>
            <option v-for="m in modelos" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
      </div>

      <div class="catalogo-barra">
        <span class="catalogo-contador">{{ linhas.length }} {{ linhas.length === 1 ? 'item' : 'itens' }}</span>
        <button type="button" class="btn-limpar" :disabled="!filtro.categoria && !filtro.marca && !filtro.modelo" @click="limparFiltros">
          <Eraser :size="14" />
          Limpar filtros
        </button>
      </div>

      <div class="catalogo-lista table-wrap">
        <div v-if="carregando" class="catalogo-carregando">
          <Loader2 class="spin" :size="18" />
          <span>Carregando catálogo...</span>
        </div>
        <table v-else class="table">
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Marca</th>
              <th>Modelo</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(l, i) in linhas" :key="`${l.categoria}-${l.marca}-${l.modelo}-${i}`">
              <td>{{ l.categoria || '—' }}</td>
              <td>{{ l.marca || '—' }}</td>
              <td>{{ l.modelo || '—' }}</td>
            </tr>
            <tr v-if="!linhas.length">
              <td colspan="3" class="catalogo-vazio">Nenhum equipamento encontrado.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.catalogo {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.catalogo-dica {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}

.catalogo-erro {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 13px;
  font-weight: 600;
  color: var(--red);
  background: var(--red-soft);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
}

.catalogo-retry {
  color: var(--red);
  font-size: 12.5px;
  font-weight: 700;
  text-decoration: underline;
}

.filtros {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
}

@media (max-width: 640px) {
  .filtros {
    grid-template-columns: 1fr;
  }
}

.catalogo-barra {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.catalogo-contador {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-muted);
}

.btn-limpar {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-secondary);
  padding: 6px 10px;
  border-radius: var(--radius-sm);
}

.btn-limpar:hover:not(:disabled) {
  background: var(--surface-muted);
}

.btn-limpar:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.catalogo-lista {
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.catalogo-carregando {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 0;
  color: var(--text-muted);
  font-size: 13px;
}

.catalogo-vazio {
  text-align: center;
  color: var(--text-muted);
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
