<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Bell, CheckCheck, ChevronDown, KeyRound, LogOut } from '@lucide/vue'
import {
  listarNotificacoes,
  marcarNotificacaoLida,
  marcarTodasNotificacoesLidas,
} from '@/api/notificacoes'
import { useAuthStore } from '@/stores/auth'
import { rotuloPerfil, type Notificacao } from '@/types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const titulo = computed(() => (route.meta.title as string) || 'Painel')
const breadcrumb = computed(() => (route.meta.breadcrumb as string) || 'Painel')

const userMenuOpen = ref(false)
const inicialNome = computed(() => (auth.user?.nome || '?').trim().charAt(0).toUpperCase())
const perfilLabel = computed(() => rotuloPerfil(auth.user?.nivel))

async function sair() {
  userMenuOpen.value = false
  await auth.logout()
  router.push({ name: 'login' })
}

function trocarSenha() {
  userMenuOpen.value = false
  router.push({ name: 'trocar-senha' })
}

/* ---------- Notificações ---------- */
const NOTIF_POLL_MS = 30_000

const notifAberto = ref(false)
const notificacoes = ref<Notificacao[]>([])
const naoLidas = ref(0)
let poller: ReturnType<typeof setInterval> | null = null

/** Falha silenciosa de propósito: a topbar não pode quebrar por causa do sino. */
async function buscarNotificacoes() {
  try {
    const res = await listarNotificacoes()
    notificacoes.value = res.data
    naoLidas.value = res.naoLidas
  } catch {
    /* estado vazio silencioso */
  }
}

function alternarNotificacoes() {
  notifAberto.value = !notifAberto.value
  if (notifAberto.value) {
    userMenuOpen.value = false
    void buscarNotificacoes()
  }
}

function alternarUserMenu() {
  userMenuOpen.value = !userMenuOpen.value
  if (userMenuOpen.value) notifAberto.value = false
}

/** Link de chamado vindo do backend (/chamados/<id>) vira a rota da SPA que abre o detalhe direto. */
type DestinoNotificacao = string | { name: string; query: Record<string, string> }

function destinoNotificacao(link: string): DestinoNotificacao {
  const m = link.match(/chamados\/([^/?#]+)/)
  if (m?.[1]) return { name: 'chamados', query: { chamado: m[1] } }
  return link
}

async function abrirNotificacao(n: Notificacao) {
  if (!n.lida) {
    n.lida = true
    naoLidas.value = Math.max(0, naoLidas.value - 1)
    try {
      await marcarNotificacaoLida(n.id)
    } catch {
      /* silencioso */
    }
  }
  if (n.link) {
    notifAberto.value = false
    router.push(destinoNotificacao(n.link))
  }
}

async function marcarTodas() {
  notificacoes.value.forEach((n) => {
    n.lida = true
  })
  naoLidas.value = 0
  try {
    await marcarTodasNotificacoesLidas()
  } catch {
    /* silencioso */
  }
}

function tempoRelativo(iso: string): string {
  const data = new Date(iso)
  if (isNaN(data.getTime())) return ''
  const seg = Math.max(0, Math.floor((Date.now() - data.getTime()) / 1000))
  if (seg < 60) return 'agora mesmo'
  const min = Math.floor(seg / 60)
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'ontem'
  if (d < 7) return `há ${d} dias`
  return data.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

function fecharMenu(e: MouseEvent) {
  const alvo = e.target as HTMLElement
  if (!alvo.closest('.user-menu-wrap')) userMenuOpen.value = false
  if (!alvo.closest('.notif-wrap')) notifAberto.value = false
}

onMounted(() => {
  void buscarNotificacoes()
  poller = setInterval(() => void buscarNotificacoes(), NOTIF_POLL_MS)
  document.addEventListener('click', fecharMenu)
})

onUnmounted(() => {
  if (poller) clearInterval(poller)
  document.removeEventListener('click', fecharMenu)
})
</script>

<template>
  <header class="topbar" @click.self="fecharMenu">
    <div class="title-block">
      <h1>{{ titulo }}</h1>
      <span class="breadcrumb">Início / {{ breadcrumb }}</span>
    </div>

    <div class="actions">
      <div class="notif-wrap">
        <button class="icon-btn notif-btn" title="Notificações" type="button" @click="alternarNotificacoes">
          <Bell :size="19" />
          <span v-if="naoLidas > 0" class="badge">{{ naoLidas > 99 ? '99+' : naoLidas }}</span>
        </button>

        <Transition name="fade">
          <div v-if="notifAberto" class="notif-dropdown">
            <header class="notif-head">
              <strong>Notificações</strong>
              <span v-if="naoLidas > 0" class="notif-count">{{ naoLidas }} não lida(s)</span>
            </header>

            <div class="notif-list">
              <p v-if="notificacoes.length === 0" class="notif-vazio">Nenhuma notificação por aqui.</p>
              <button
                v-for="n in notificacoes"
                :key="n.id"
                class="notif-item"
                :class="{ 'nao-lida': !n.lida }"
                type="button"
                @click="abrirNotificacao(n)"
              >
                <span class="notif-dot" :class="{ visivel: !n.lida }" />
                <span class="notif-corpo">
                  <strong>{{ n.titulo }}</strong>
                  <span class="notif-msg">{{ n.mensagem }}</span>
                  <span class="notif-tempo">{{ tempoRelativo(n.criadoEm) }}</span>
                </span>
              </button>
            </div>

            <footer class="notif-footer">
              <button type="button" :disabled="naoLidas === 0" @click="marcarTodas">
                <CheckCheck :size="15" />
                Marcar todas como lidas
              </button>
            </footer>
          </div>
        </Transition>
      </div>

      <div class="user-menu-wrap">
        <button class="user-trigger" type="button" @click="alternarUserMenu">
          <span class="avatar">{{ inicialNome }}</span>
          <span class="user-info">
            <strong>{{ auth.user?.nome }}</strong>
            <small>{{ perfilLabel }} · URE Leste 3</small>
          </span>
          <ChevronDown :size="16" />
        </button>

        <Transition name="fade">
          <div v-if="userMenuOpen" class="user-dropdown">
            <button class="dropdown-item" type="button" @click="trocarSenha">
              <KeyRound :size="16" />
              Trocar senha
            </button>
            <button class="dropdown-item danger" type="button" @click="sair">
              <LogOut :size="16" />
              Sair
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  height: var(--topbar-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 30;
}

.title-block {
  display: flex;
  flex-direction: column;
  justify-content: center;
  line-height: 1.2;
}

.title-block h1 {
  font-size: 17px;
}

.breadcrumb {
  font-size: 11.5px;
  color: var(--text-muted);
}

.actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.icon-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--text-secondary);
  border: 1px solid var(--border);
  background: var(--surface);
}

.icon-btn:hover {
  background: var(--surface-muted);
}

.user-menu-wrap {
  position: relative;
}

/* ---------- Notificações ---------- */

.notif-wrap {
  position: relative;
}

.notif-btn {
  position: relative;
}

.badge {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--red);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  display: grid;
  place-items: center;
  border: 2px solid var(--surface);
  pointer-events: none;
}

.notif-dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  width: 340px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 60;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.notif-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.notif-head strong {
  font-size: 13.5px;
}

.notif-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
}

.notif-list {
  max-height: 420px;
  overflow-y: auto;
}

.notif-vazio {
  margin: 0;
  padding: 30px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}

.notif-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

.notif-item:last-child {
  border-bottom: none;
}

.notif-item:hover {
  background: var(--surface-muted);
}

.notif-item.nao-lida {
  background: color-mix(in srgb, var(--blue-soft) 40%, var(--surface));
}

.notif-item.nao-lida:hover {
  background: color-mix(in srgb, var(--blue-soft) 60%, var(--surface));
}

.notif-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  margin-top: 5px;
  border-radius: 50%;
  background: transparent;
}

.notif-dot.visivel {
  background: var(--blue);
}

.notif-corpo {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.notif-corpo strong {
  font-size: 13px;
  color: var(--text-primary);
}

.notif-msg {
  font-size: 12.5px;
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.notif-tempo {
  font-size: 11px;
  color: var(--text-muted);
}

.notif-footer {
  border-top: 1px solid var(--border);
  padding: 8px;
}

.notif-footer button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 8px;
  border-radius: var(--radius-sm);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--blue);
}

.notif-footer button:hover:not(:disabled) {
  background: var(--blue-soft);
}

.notif-footer button:disabled {
  color: var(--text-muted);
  cursor: default;
}

.user-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 10px 5px 5px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-secondary);
}

.user-trigger:hover {
  background: var(--surface-muted);
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--sidebar-bg);
  color: var(--brand-gold);
  font-weight: 700;
  font-size: 14px;
}

.user-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.15;
}

.user-info strong {
  font-size: 13px;
  color: var(--text-primary);
}

.user-info small {
  font-size: 10.5px;
  color: var(--text-muted);
}

.user-dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  min-width: 200px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 6px;
  z-index: 50;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-secondary);
  text-align: left;
}

.dropdown-item:hover {
  background: var(--surface-muted);
}

.dropdown-item.danger {
  color: var(--red);
}

.dropdown-item.danger:hover {
  background: var(--red-soft);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.12s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
