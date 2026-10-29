<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  BarChart3,
  Bot,
  Globe,
  BookOpen,
  CalendarDays,
  Camera,
  ChevronDown,
  Clock,
  Headset,
  LayoutDashboard,
  Monitor,
  School,
  Settings,
  Star,
  Users,
  Wrench,
} from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import { useSidebar } from '@/composables/useSidebar'
import type { RotaUsuario } from '@/types'

interface MenuItem {
  to: string
  label: string
  icon: unknown
  grupo: string
  adminOnly?: boolean
  gestorTambem?: boolean
  /** Visível apenas para a matriz (ADMIN/TECNICO) */
  matrizOnly?: boolean
  /**
   * Esconde para usuário com ESCOPO DE TIPOS — a conta criada para atender só
   * alguns tipos de chamado, que não tem inventário nem manutenção sob
   * responsabilidade. Some do menu, não do servidor: digitar a URL ainda
   * abriria a tela (o SCE tem authz própria, e as telas de manutenção só
   * leem o SCE).
   */
  semEscopoTipos?: boolean
  /**
   * Domínio de rota que esta tela atende. Vazio = a tela não é restritiva.
   *
   * Quando o usuário tem `rotasPermitidas` preenchida, só entra no menu o que
   * estiver na lista. É a MESMA chave que o `meta.rota` do router e que o
   * backend usa no 403 — os três contam a mesma lista.
   */
  rota?: RotaUsuario
}

const route = useRoute()
const auth = useAuthStore()
const { menuAberto, fechar } = useSidebar()

const gruposOrdem = ['Início', 'Atendimento', 'Equipamentos', 'Escolas', 'Administração']

const items: MenuItem[] = [
  { to: '/painel', label: 'Painel', icon: LayoutDashboard, grupo: 'Início', rota: 'dashboard' },
  { to: '/chat', label: 'Chat IA', icon: Bot, grupo: 'Início', adminOnly: true, rota: 'dashboard' },
  { to: '/chamados', label: 'Chamados', icon: Headset, grupo: 'Atendimento', rota: 'chamados' },
  { to: '/tutoriais', label: 'Tutoriais', icon: BookOpen, grupo: 'Atendimento', semEscopoTipos: true, rota: 'tutoriais' },
  { to: '/feedback', label: 'Elogios e Avaliações', icon: Star, grupo: 'Atendimento', adminOnly: true, semEscopoTipos: true, rota: 'feedback' },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3, grupo: 'Atendimento', semEscopoTipos: true, rota: 'chamados' },
  { to: '/equipamentos', label: 'Equipamentos', icon: Monitor, grupo: 'Equipamentos', semEscopoTipos: true, rota: 'equipamentos' },
  { to: '/manutencao', label: 'Manutenção', icon: Wrench, grupo: 'Equipamentos', semEscopoTipos: true, rota: 'equipamentos' },
  { to: '/unidades', label: 'Unidades Escolares', icon: School, grupo: 'Escolas', matrizOnly: true, semEscopoTipos: true, rota: 'escolas' },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays, grupo: 'Escolas', matrizOnly: true, semEscopoTipos: true, rota: 'escolas' },
  { to: '/links-internet', label: 'Links de Internet', icon: Globe, grupo: 'Escolas', adminOnly: true },
  { to: '/cameras-dvr', label: 'Câmeras DVR', icon: Camera, grupo: 'Escolas', adminOnly: true, semEscopoTipos: true, rota: 'equipamentos' },
  { to: '/ponto', label: 'Ponto', icon: Clock, grupo: 'Administração', matrizOnly: true },
  { to: '/usuarios', label: 'Usuários', icon: Users, grupo: 'Administração', gestorTambem: true, rota: 'usuarios' },
  { to: '/configuracoes', label: 'Configurações', icon: Settings, grupo: 'Administração', adminOnly: true, rota: 'formulario' },
]

const visibleItems = computed(() =>
  items.filter((i) => {
    // Restrição de rota do usuário. Fica PRIMEIRO de propósito: é a restrição
    // mais forte, e um item fora da lista não deve aparecer mesmo que as outras
    // flags o deixariam passar.
    if (i.rota && !auth.podeAcessarRota(i.rota)) return false
    if (i.semEscopoTipos && auth.temEscopoTipos) return false
    if (i.adminOnly) return auth.user?.nivel === 'ADMIN'
    if (i.gestorTambem) return ['ADMIN', 'GESTOR'].includes(auth.user?.nivel || '')
    if (i.matrizOnly) return ['ADMIN', 'TECNICO'].includes(auth.user?.nivel || '')
    return true
  }),
)

interface MenuGroup {
  label: string
  items: MenuItem[]
}

const visibleGroups = computed<MenuGroup[]>(() =>
  gruposOrdem
    .map((label) => ({ label, items: visibleItems.value.filter((i) => i.grupo === label) }))
    .filter((g) => g.items.length > 0),
)

const abertos = ref<Record<string, boolean>>({})

function grupoDoCaminho(caminho: string): string | null {
  const grupo = visibleGroups.value.find((g) => g.items.some((i) => caminho.startsWith(i.to)))
  return grupo?.label ?? null
}

watch(
  visibleGroups,
  (groups) => {
  for (const g of groups) {
    if (abertos.value[g.label] === undefined) {
      abertos.value[g.label] = true
    }
  }
  },
  { immediate: true },
)

watch(
  () => route.path,
  (caminho) => {
    const label = grupoDoCaminho(caminho)
    if (label) abertos.value[label] = true
  },
)

function alternarGrupo(label: string) {
  abertos.value[label] = !abertos.value[label]
}
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
      <section v-for="grupo in visibleGroups" :key="grupo.label" class="menu-group">
        <button
          type="button"
          class="menu-group-header"
          :aria-expanded="!!abertos[grupo.label]"
          @click="alternarGrupo(grupo.label)"
        >
          <span class="menu-group-title">{{ grupo.label }}</span>
          <ChevronDown
            class="menu-group-chevron"
            :class="{ virada: !!abertos[grupo.label] }"
            :size="14"
            :stroke-width="2.5"
          />
        </button>
        <div v-show="!!abertos[grupo.label]" class="menu-group-items">
          <RouterLink
            v-for="item in grupo.items"
            :key="item.to"
            :to="item.to"
            class="menu-item"
            :class="{ active: route.path.startsWith(item.to) }"
          >
            <component :is="item.icon" :size="18" :stroke-width="2" />
            <span>{{ item.label }}</span>
          </RouterLink>
        </div>
      </section>
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

.menu-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.menu-group + .menu-group {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgb(255 255 255 / 0.06);
}

.menu-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 14px;
  border: 0;
  background: transparent;
  color: rgb(255 255 255 / 0.42);
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.menu-group-header:hover {
  background: rgb(255 255 255 / 0.05);
  color: rgb(255 255 255 / 0.62);
}

.menu-group-title {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.menu-group-chevron {
  transition: transform 0.18s ease;
  flex-shrink: 0;
}

.menu-group-chevron.virada {
  transform: rotate(180deg);
}

.menu-group-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
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
