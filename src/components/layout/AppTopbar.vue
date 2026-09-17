<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Bell, ChevronDown, KeyRound, LogOut } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import { rotuloPerfil } from '@/types'

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

function fecharMenu(e: MouseEvent) {
  if (!(e.target as HTMLElement).closest('.user-menu-wrap')) {
    userMenuOpen.value = false
  }
}
</script>

<template>
  <header class="topbar" @click.self="fecharMenu">
    <div class="title-block">
      <h1>{{ titulo }}</h1>
      <span class="breadcrumb">Início / {{ breadcrumb }}</span>
    </div>

    <div class="actions">
      <button class="icon-btn" title="Notificações (em breve)" type="button">
        <Bell :size="19" />
      </button>

      <div class="user-menu-wrap">
        <button class="user-trigger" type="button" @click="userMenuOpen = !userMenuOpen">
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
