import { ref, watch } from 'vue'

/**
 * Estado global do drawer da sidebar (mobile). Singleton em escopo de módulo
 * (refs compartilhadas entre todos os consumidores — não é uma store pinia).
 */
const menuAberto = ref(false)

function abrir() {
  menuAberto.value = true
}

function fechar() {
  menuAberto.value = false
}

function alternar() {
  menuAberto.value = !menuAberto.value
}

let scrollGuardIniciado = false

/** Trava o scroll do body enquanto o drawer estiver aberto. Idempotente. */
function iniciarScrollGuard() {
  if (scrollGuardIniciado || typeof window === 'undefined') return
  scrollGuardIniciado = true
  watch(menuAberto, (v) => {
    document.body.style.overflow = v ? 'hidden' : ''
  })
}

/** Destrava o scroll do body (chamado no unmount do AppShell). */
function liberarScroll() {
  if (typeof window === 'undefined') return
  document.body.style.overflow = ''
}

export function useSidebar() {
  iniciarScrollGuard()
  return { menuAberto, abrir, fechar, alternar, liberarScroll }
}
