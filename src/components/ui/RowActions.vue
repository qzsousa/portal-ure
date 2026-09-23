<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'
import { MoreVertical } from '@lucide/vue'

interface ItemAcao {
  rotulo: string
  icone?: any
  perigo?: boolean
  acao: () => void
}

defineProps<{ itens: ItemAcao[] }>()

const aberto = ref(false)
const posicionado = ref(false)
const botaoRef = ref<HTMLButtonElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const posTopo = ref(0)
const posEsquerda = ref(0)

const MARGEM = 8

function aoPointerDownFora(e: PointerEvent) {
  const alvo = e.target as Node
  // Clique no próprio botão de alternar: o @click do botão cuida de fechar/abrir
  if (botaoRef.value?.contains(alvo) || menuRef.value?.contains(alvo)) return
  fechar()
}

function aoKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') fechar()
}

function registrarOuvintes() {
  document.addEventListener('pointerdown', aoPointerDownFora)
  document.addEventListener('keydown', aoKeydown)
  // capture:true pega scroll de contêineres internos (ex.: .table-wrap)
  window.addEventListener('scroll', fechar, true)
  window.addEventListener('resize', fechar)
}

function removerOuvintes() {
  document.removeEventListener('pointerdown', aoPointerDownFora)
  document.removeEventListener('keydown', aoKeydown)
  window.removeEventListener('scroll', fechar, true)
  window.removeEventListener('resize', fechar)
}

function posicionarMenu() {
  const btn = botaoRef.value
  const menu = menuRef.value
  if (!btn || !menu) return
  const rect = btn.getBoundingClientRect()
  const caixa = menu.getBoundingClientRect()

  // Padrão: abaixo do botão; se estourar a base da viewport, abre para cima
  let top = rect.bottom + 4
  if (rect.bottom + caixa.height + MARGEM > window.innerHeight) {
    top = rect.top - caixa.height - 4
  }
  top = Math.max(MARGEM, Math.min(top, window.innerHeight - caixa.height - MARGEM))

  // Alinhado à borda direita do botão, limitado a 8px das bordas da viewport
  const largura = Math.max(caixa.width, 190)
  let left = rect.right - largura
  left = Math.max(MARGEM, Math.min(left, window.innerWidth - largura - MARGEM))

  posTopo.value = top
  posEsquerda.value = left
  posicionado.value = true
}

async function alternar() {
  if (aberto.value) {
    fechar()
    return
  }
  aberto.value = true
  posicionado.value = false
  await nextTick()
  posicionarMenu()
  registrarOuvintes()
}

function fechar() {
  if (!aberto.value) return
  aberto.value = false
  removerOuvintes()
}

function executar(item: ItemAcao) {
  item.acao()
  fechar()
}

onBeforeUnmount(removerOuvintes)
</script>

<template>
  <button
    ref="botaoRef"
    class="ra-btn"
    type="button"
    aria-label="Ações"
    aria-haspopup="menu"
    :aria-expanded="aberto"
    @click="alternar"
  >
    <MoreVertical :size="17" />
  </button>
  <Teleport to="body">
    <div
      v-if="aberto"
      ref="menuRef"
      class="ra-menu"
      role="menu"
      :style="{
        top: `${posTopo}px`,
        left: `${posEsquerda}px`,
        visibility: posicionado ? 'visible' : 'hidden',
      }"
    >
      <button
        v-for="item in itens"
        :key="item.rotulo"
        type="button"
        role="menuitem"
        :class="{ perigo: item.perigo }"
        @click="executar(item)"
      >
        <component :is="item.icone" v-if="item.icone" :size="14" />
        {{ item.rotulo }}
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
/* Área de toque de 40x40px (antes: 32px) — o tamanho visual acompanha a área clicável */
.ra-btn {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: var(--text-secondary);
}

.ra-btn:hover {
  background: var(--surface-muted);
}

.ra-menu {
  position: fixed;
  z-index: 300;
  min-width: 190px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 6px;
}

.ra-menu button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 9px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.ra-menu button:hover {
  background: var(--surface-muted);
}

.ra-menu button.perigo {
  color: var(--red);
}

.ra-menu button.perigo:hover {
  background: var(--red-soft);
}
</style>
