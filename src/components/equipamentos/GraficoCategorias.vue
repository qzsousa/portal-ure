<script setup lang="ts">
import { computed } from 'vue'
import { ChevronDown } from '@lucide/vue'

/** Linha do drilldown: "Marca Modelo" → quantidade. */
export interface ModeloQtd {
  rotulo: string
  qtd: number
}

/**
 * Gráfico compacto de barras horizontais (CSS puro): quantidade de
 * equipamentos por categoria, ordenado da maior para a menor.
 * Clicar numa categoria expande logo abaixo os modelos/marcas com
 * as quantidades correspondentes (drilldown).
 *
 * O detalhe chega pronto nos agregados da tela — não há carregamento aqui,
 * e por isso a soma dos modelos sempre fecha com o total da categoria.
 */
const props = withDefaults(
  defineProps<{
    /** categoria → quantidade */
    fatias: Record<string, number>
    titulo?: string
    /** categoria atualmente expandida (null = nenhuma) */
    aberta?: string | null
    /** modelos da categoria expandida (já ordenados por quantidade) */
    detalhe?: ModeloQtd[]
  }>(),
  { titulo: 'Equipamentos por categoria', aberta: null, detalhe: () => [] },
)

const emit = defineEmits<{ selecionar: [categoria: string] }>()

const entradas = computed(() => Object.entries(props.fatias).sort((a, b) => b[1] - a[1]))
const maior = computed(() => entradas.value[0]?.[1] ?? 0)
const total = computed(() => entradas.value.reduce((acc, [, v]) => acc + v, 0))
const maiorDetalhe = computed(() => props.detalhe[0]?.qtd ?? 0)
/** Soma dos modelos listados: tem que fechar com o total da categoria aberta. */
const somaDetalhe = computed(() => props.detalhe.reduce((acc, d) => acc + d.qtd, 0))
const totalDaAberta = computed(() => (props.aberta ? (props.fatias[props.aberta] ?? 0) : 0))

/* Piso de 2% para valores pequenos continuarem visíveis */
function largura(valor: number): string {
  if (!maior.value) return '0%'
  return `${Math.max(2, Math.round((valor / maior.value) * 100))}%`
}

function larguraDetalhe(qtd: number): string {
  if (!maiorDetalhe.value) return '0%'
  return `${Math.max(2, Math.round((qtd / maiorDetalhe.value) * 100))}%`
}
</script>

<template>
  <div class="cat-card card">
    <header class="cat-head">
      <h3>{{ titulo }}</h3>
      <span class="cat-total">{{ total.toLocaleString('pt-BR') }} equipamentos</span>
    </header>

    <ul v-if="entradas.length" class="cat-list">
      <li v-for="[categoria, qtd] in entradas" :key="categoria">
        <button
          type="button"
          class="cat-linha"
          :class="{ ativa: aberta === categoria }"
          :aria-expanded="aberta === categoria"
          :title="`${categoria}: ${qtd} — clique para ver os modelos`"
          @click="emit('selecionar', categoria)"
        >
          <span class="cat-nome">{{ categoria }}</span>
          <span class="cat-trilha">
            <span class="cat-barra" :style="{ width: largura(qtd) }" />
          </span>
          <span class="cat-qtd">{{ qtd.toLocaleString('pt-BR') }}</span>
          <ChevronDown :size="13" class="cat-seta" />
        </button>

        <!-- Drilldown: modelos e quantidades da categoria clicada -->
        <div v-if="aberta === categoria" class="cat-detalhe">
          <p v-if="detalhe.length" class="det-resumo">
            {{ detalhe.length }} {{ detalhe.length === 1 ? 'modelo' : 'modelos' }}
            · {{ somaDetalhe.toLocaleString('pt-BR') }} de
            {{ totalDaAberta.toLocaleString('pt-BR') }} equipamentos
          </p>
          <p v-if="detalhe.length === 0" class="det-vazio">Nenhum modelo nesta categoria.</p>
          <ul v-else class="det-lista">
            <li v-for="m in detalhe" :key="m.rotulo" :title="`${m.rotulo}: ${m.qtd}`">
              <span class="det-nome">{{ m.rotulo }}</span>
              <span class="cat-trilha det-trilha">
                <span class="cat-barra det-barra" :style="{ width: larguraDetalhe(m.qtd) }" />
              </span>
              <span class="cat-qtd">{{ m.qtd.toLocaleString('pt-BR') }}</span>
            </li>
          </ul>
        </div>
      </li>
    </ul>
    <p v-else class="cat-vazio">Sem dados para exibir.</p>
  </div>
</template>

<style scoped>
.cat-card {
  padding: 12px 16px;
}

.cat-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.cat-head h3 {
  font-size: 13px;
}

.cat-total {
  font-size: 11.5px;
  color: var(--text-muted);
  white-space: nowrap;
}

.cat-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  /* Altura contida: muitas categorias rolam dentro do próprio cartão */
  max-height: 178px;
  overflow-y: auto;
}

/* A linha clicável carrega o grid (categoria | barra | qtd | seta) */
.cat-linha {
  display: grid;
  grid-template-columns: minmax(90px, 200px) 1fr 44px 14px;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 20px;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  font: inherit;
}

.cat-linha:hover .cat-nome {
  color: var(--blue);
}

.cat-nome {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.12s ease;
}

.cat-linha.ativa .cat-nome {
  color: var(--blue);
  font-weight: 700;
}

.cat-trilha {
  height: 10px;
  border-radius: 999px;
  background: var(--slate-soft);
  overflow: hidden;
}

.cat-barra {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--blue);
  transition: width 0.4s ease;
}

.cat-qtd {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  text-align: right;
  white-space: nowrap;
}

.cat-seta {
  color: var(--text-muted);
  transition: transform 0.15s ease;
}

.cat-linha.ativa .cat-seta {
  transform: rotate(180deg);
  color: var(--blue);
}

.cat-vazio,
.det-vazio {
  margin: 0;
  font-size: 12.5px;
  color: var(--text-muted);
}

/* ---------- Drilldown de modelos ---------- */
.cat-detalhe {
  margin: 4px 0 6px;
  padding: 8px 10px;
  border-left: 2px solid var(--blue);
  background: var(--surface-muted);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.det-lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  /* Contido: muitas variantes rolam dentro do próprio painel */
  max-height: 150px;
  overflow-y: auto;
}

.det-resumo {
  margin: 0 0 6px;
  font-size: 11px;
  color: var(--text-muted);
}

.det-lista li {
  display: grid;
  grid-template-columns: minmax(90px, 200px) 1fr 44px;
  align-items: center;
  gap: 10px;
  min-height: 18px;
}

.det-nome {
  font-size: 11.5px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.det-trilha {
  height: 8px;
}

.det-lista .cat-qtd {
  font-size: 11.5px;
}
</style>
