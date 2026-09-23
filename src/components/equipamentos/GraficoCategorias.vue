<script setup lang="ts">
import { computed } from 'vue'

/**
 * Gráfico compacto de barras horizontais (CSS puro): quantidade de
 * equipamentos por categoria, ordenado da maior para a menor.
 * Projetado para ocupar pouco espaço vertical na tela de Equipamentos.
 */
const props = withDefaults(
  defineProps<{
    /** categoria → quantidade */
    fatias: Record<string, number>
    titulo?: string
  }>(),
  { titulo: 'Equipamentos por categoria' },
)

const entradas = computed(() => Object.entries(props.fatias).sort((a, b) => b[1] - a[1]))
const maior = computed(() => entradas.value[0]?.[1] ?? 0)
const total = computed(() => entradas.value.reduce((acc, [, v]) => acc + v, 0))

function largura(valor: number): string {
  if (!maior.value) return '0%'
  /* Piso de 2% para categorias pequenas continuarem visíveis */
  return `${Math.max(2, Math.round((valor / maior.value) * 100))}%`
}
</script>

<template>
  <div class="cat-card card">
    <header class="cat-head">
      <h3>{{ titulo }}</h3>
      <span class="cat-total">{{ total.toLocaleString('pt-BR') }} equipamentos</span>
    </header>

    <ul v-if="entradas.length" class="cat-list">
      <li v-for="[categoria, qtd] in entradas" :key="categoria" :title="`${categoria}: ${qtd}`">
        <span class="cat-nome">{{ categoria }}</span>
        <span class="cat-trilha">
          <span class="cat-barra" :style="{ width: largura(qtd) }" />
        </span>
        <span class="cat-qtd">{{ qtd.toLocaleString('pt-BR') }}</span>
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

.cat-list li {
  display: grid;
  grid-template-columns: minmax(90px, 200px) 1fr 44px;
  align-items: center;
  gap: 10px;
  min-height: 20px;
}

.cat-nome {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.cat-vazio {
  margin: 0;
  font-size: 12.5px;
  color: var(--text-muted);
}
</style>
