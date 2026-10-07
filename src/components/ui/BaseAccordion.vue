<script setup lang="ts">
/**
 * Seção que abre e fecha, para caber muito conteúdo na mesma tela sem
 * transformar o modal numa parede de texto.
 *
 * Três decisões que vieram do uso no celular:
 *
 * - O cabeçalho é o botão inteiro, com 48px de altura. O alvo de toque não é o
 *   texto do título — apertar entre as palavras não abre nada.
 * - O estado é do pai (`:aberto` + `@alternar`), não interno. Com o estado aqui
 *   dentro, abrir o mesmo accordion em dois lugares (ou resetar ao recarregar o
 *   chamado) exige sincronizar duas cópias.
 * - `contador` vira um chip à direita: dá para ver que existe conteúdo dentro
 *   sem abrir, que é justamente o que se procura ("tem registro?").
 */
import { ChevronDown } from '@lucide/vue'

defineProps<{
  titulo: string
  aberto: boolean
  /** Numeração ou etiqueta à direita do título — quantos itens estão dentro. */
  contador?: number | string | null
  /** Tom do ícone, seguindo os tokens de status. */
  tom?: 'blue' | 'green' | 'yellow' | 'purple' | 'slate' | 'red'
}>()

const emit = defineEmits<{ (e: 'alternar'): void }>()
</script>

<template>
  <section class="accordion card" :class="{ aberto }">
    <h3>
      <button class="accordion-cabecalho" type="button" :aria-expanded="aberto" @click="emit('alternar')">
        <span class="accordion-icone" :class="`tom-${tom || 'slate'}`">
          <slot name="icone" />
        </span>
        <span class="accordion-titulo">{{ titulo }}</span>
        <span v-if="contador !== null && contador !== undefined && contador !== ''" class="accordion-contador">
          {{ contador }}
        </span>
        <ChevronDown class="accordion-seta" :class="{ virada: aberto }" :size="18" />
      </button>
    </h3>
    <div v-show="aberto" class="accordion-conteudo">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.accordion {
  overflow: hidden;
}

.accordion h3 {
  margin: 0;
  font-size: inherit;
  font-weight: inherit;
}

.accordion-cabecalho {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 48px;
  padding: 12px 14px;
  text-align: left;
  color: var(--text-primary);
  font-weight: 700;
  font-size: 14px;
}

.accordion-cabecalho:hover {
  background: var(--surface-muted);
}

.accordion.aberto .accordion-cabecalho {
  border-bottom: 1px solid var(--border);
}

.accordion-icone {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  flex-shrink: 0;
}

.tom-blue { background: var(--blue-soft); color: var(--blue); }
.tom-green { background: var(--green-soft); color: var(--green); }
.tom-yellow { background: var(--yellow-soft); color: var(--yellow); }
.tom-purple { background: var(--purple-soft); color: var(--purple); }
.tom-slate { background: var(--slate-soft); color: var(--slate); }
.tom-red { background: var(--red-soft); color: var(--red); }

.accordion-titulo {
  flex: 1;
  min-width: 0;
}

.accordion-contador {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--surface-muted);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.accordion-seta {
  color: var(--text-muted);
  flex-shrink: 0;
  transition: transform 0.18s ease;
}

.accordion-seta.virada {
  transform: rotate(180deg);
}

.accordion-conteudo {
  padding: 14px;
}

/* No celular o alvo precisa continuar grande depois de aberto */
@media (max-width: 640px) {
  .accordion-cabecalho {
    min-height: 52px;
    font-size: 15px;
  }

  .accordion-conteudo {
    padding: 12px;
  }
}
</style>