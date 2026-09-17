import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { Nivel } from '@/types'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true, title: 'Entrar' },
  },
  {
    path: '/trocar-senha',
    name: 'trocar-senha',
    component: () => import('@/views/TrocarSenhaView.vue'),
    meta: { title: 'Trocar senha' },
  },

  // ---- Páginas públicas (sem autenticação, sem shell) ----
  {
    path: '/chamado/novo',
    name: 'chamado-novo',
    component: () => import('@/views/publico/NovoChamadoView.vue'),
    meta: { public: true, title: 'Novo chamado' },
  },
  {
    path: '/consulta',
    name: 'consulta',
    component: () => import('@/views/publico/ConsultaProtocoloView.vue'),
    meta: { public: true, title: 'Consultar chamado' },
  },
  {
    path: '/matriz',
    name: 'dash-matriz',
    component: () => import('@/views/publico/DashboardPublicoView.vue'),
    meta: { public: true, title: 'Painel geral' },
  },
  {
    path: '/dirigente',
    name: 'dirigente',
    component: () => import('@/views/publico/DashboardDirigenteView.vue'),
    meta: { public: true, title: 'Painel do dirigente' },
  },

  // ---- Área autenticada (shell com sidebar/topbar) ----
  {
    path: '/',
    component: () => import('@/components/layout/AppShell.vue'),
    children: [
      { path: '', redirect: { name: 'painel' } },
      {
        path: 'painel',
        name: 'painel',
        component: () => import('@/views/PainelView.vue'),
        meta: { title: 'Painel', breadcrumb: 'Painel' },
      },
      {
        path: 'equipamentos',
        name: 'equipamentos',
        component: () => import('@/views/EquipamentosView.vue'),
        meta: { title: 'Equipamentos', breadcrumb: 'Equipamentos' },
      },
      {
        path: 'manutencao',
        name: 'manutencao',
        component: () => import('@/views/ManutencaoView.vue'),
        meta: { title: 'Manutenção', breadcrumb: 'Manutenção' },
      },
      {
        path: 'chamados',
        name: 'chamados',
        component: () => import('@/views/ChamadosView.vue'),
        meta: { title: 'Chamados', breadcrumb: 'Chamados' },
      },
      {
        path: 'unidades',
        name: 'unidades',
        component: () => import('@/views/UnidadesView.vue'),
        meta: { title: 'Unidades Escolares', breadcrumb: 'Unidades Escolares' },
      },
      {
        path: 'relatorios',
        name: 'relatorios',
        component: () => import('@/views/RelatoriosView.vue'),
        meta: { title: 'Relatórios', breadcrumb: 'Relatórios' },
      },
      {
        path: 'usuarios',
        name: 'usuarios',
        component: () => import('@/views/UsuariosView.vue'),
        meta: {
          title: 'Usuários',
          breadcrumb: 'Usuários',
          roles: ['ADMIN'] as Nivel[],
        },
      },
      {
        path: 'configuracoes',
        name: 'configuracoes',
        component: () => import('@/views/StubView.vue'),
        meta: {
          title: 'Configurações',
          breadcrumb: 'Configurações',
          modulo: 'Configurações',
          roles: ['ADMIN'] as Nivel[],
        },
      },
    ],
  },

  { path: '/:pathMatch(.*)*', redirect: { name: 'painel' } },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.isInitialized) {
    await auth.initialize()
  }

  const isPublic = to.meta.public === true

  if (!isPublic && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (isPublic && auth.isAuthenticated && to.name === 'login') {
    return { name: 'painel' }
  }

  if (auth.isAuthenticated && auth.mustChangePassword && to.name !== 'trocar-senha') {
    return { name: 'trocar-senha' }
  }

  const roles = to.meta.roles as Nivel[] | undefined
  if (roles && auth.user && !roles.includes(auth.user.nivel)) {
    return { name: 'painel' }
  }

  document.title = to.meta.title ? `${to.meta.title} · PORTAL URE LESTE 3` : 'PORTAL URE LESTE 3'

  return true
})
