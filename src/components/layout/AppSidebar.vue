<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  BarChart3,
  BookOpen,
  Headset,
  LayoutDashboard,
  Monitor,
  School,
  Settings,
  Users,
  Wrench,
} from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import { useSidebar } from '@/composables/useSidebar'

interface MenuItem {
  to: string
  label: string
  icon: unknown
  adminOnly?: boolean
  gestorTambem?: boolean
}

const route = useRoute()
const auth = useAuthStore()
const { menuAberto, fechar } = useSidebar()

const items: MenuItem[] = [
  { to: '/painel', label: 'Painel', icon: LayoutDashboard },
  { to: '/equipamentos', label: 'Equipamentos', icon: Monitor },
  { to: '/manutencao', label: 'Manutenção', icon: Wrench },
  { to: '/chamados', label: 'Chamados', icon: Headset },
  { to: '/tutoriais', label: 'Tutoriais', icon: BookOpen },
  { to: '/unidades', label: 'Unidades Escolares', icon: School },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/usuarios', label: 'Usuários', icon: Users, gestorTambem: true },
  { to: '/configuracoes', label: 'Configurações', icon: Settings, adminOnly: true },
]

const visibleItems = computed(() =>
  items.filter((i) => {
    if (i.adminOnly) return auth.user?.nivel === 'ADMIN'
    if (i.gestorTambem) return ['ADMIN', 'GESTOR'].includes(auth.user?.nivel || '')
    return true
  }),
)
</script>

<template>
  <Transition name="overlay-fade">
    <div v-if="menuAberto" class="sidebar-overlay" aria-hidden="true" @click="fechar" />
  </Transition>

  <aside class="sidebar" :class="{ aberta: menuAberto }">
    <div class="brand">
      <img class="brand-logo" src="/logo-ure.png" alt="Brasão da URE Leste 3" />
      <div class="brand-text">
        <strong>PORTAL URE LESTE 3</strong>
        <span>Unidade Regional de Ensino</span>
      </div>
    </div>

    <nav class="menu">
      <RouterLink
        v-for="item in visibleItems"
        :key="item.to"
        :to="item.to"
        class="menu-item"
        :class="{ active: route.path.startsWith(item.to) }"
      >
        <component :is="item.icon" :size="18" :stroke-width="2" />
        <span>{{ item.label }}</span>
      </RouterLink>
    </nav>

    <div class="sidebar-footer">
      <em>Tecnologia a serviço<br />da educação</em>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  height: 100vh;
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, var(--sidebar-bg) 0%, var(--sidebar-bg-deep) 100%);
  color: var(--sidebar-text);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 18px 18px;
  border-bottom: 1px solid rgb(255 255 255 / 0.08);
}

.brand-logo {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  flex-shrink: 0;
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.brand-text strong {
  color: #fff;
  font-size: 13px;
  letter-spacing: 0.02em;
}

.brand-text span {
  font-size: 11px;
  color: var(--sidebar-text);
}

.menu {
  flex: 1;
  padding: 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  border-radius: var(--radius-sm);
  color: var(--sidebar-text);
  font-size: 13.5px;
  font-weight: 500;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.menu-item:hover {
  background: rgb(255 255 255 / 0.07);
  color: #fff;
}

.menu-item.active {
  background: var(--brand-gold);
  color: var(--sidebar-text-active);
  font-weight: 700;
}

.sidebar-footer {
  padding: 18px;
  border-top: 1px solid rgb(255 255 255 / 0.08);
  text-align: center;
  color: var(--brand-gold);
  font-family: Georgia, 'Times New Roman', serif;
  font-style: italic;
  font-size: 13px;
  line-height: 1.5;
  opacity: 0.9;
}

/* Overlay do drawer: existe apenas no mobile (oculto no desktop). */
.sidebar-overlay {
  display: none;
}

@media (max-width: 900px) {
  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 220;
    height: 100vh;
    height: 100dvh;
    transform: translateX(-105%);
    transition: transform 0.25s ease;
    box-shadow: none;
  }

  .sidebar.aberta {
    transform: translateX(0);
    box-shadow: 0 8px 40px rgb(0 0 0 / 0.4);
  }

  .sidebar-overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: rgb(15 23 42 / 0.55);
    z-index: 210;
  }
}

.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity 0.25s ease;
}

.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}
</style>
