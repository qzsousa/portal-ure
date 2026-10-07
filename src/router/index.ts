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
    path: '/elogios',
    name: 'elogios',
    component: () => import('@/views/publico/ElogiosSugestoesView.vue'),
    meta: { public: true, title: 'Elogios e sugestões' },
  },
  {
    path: '/tutorial/:id',
    name: 'tutorial-publico',
    component: () => import('@/views/publico/TutorialPublicoView.vue'),
    meta: { public: true, title: 'Tutorial' },
  },
  {
    path: '/matriz',
    name: 'dash-matriz',
    component: () => import('@/views/publico/DashboardPublicoView.vue'),
    meta: { public: true, title: 'Painel geral' },
  },
  {
    // Rota antiga "/dirigente" mantida: links antigos e prints do sistema
    // anterior apontam para ela. O NOME visível é "Painel do Setor".
    path: '/dirigente',
    name: 'dirigente',
    component: () => import('@/views/publico/DashboardDirigenteView.vue'),
    meta: { public: true, title: 'Painel do Setor' },
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
        path: 'tutoriais',
        name: 'tutoriais',
        component: () => import('@/views/TutoriaisView.vue'),
        meta: { title: 'Tutoriais', breadcrumb: 'Tutoriais' },
      },
      {
        path: 'tutoriais/:id',
        name: 'tutorial-detalhe',
        component: () => import('@/views/TutorialDetalheView.vue'),
        meta: { title: 'Tutorial', breadcrumb: 'Tutorial' },
      },
      {
        path: 'feedback',
        name: 'feedback',
        component: () => import('@/views/FeedbackView.vue'),
        meta: {
          title: 'Elogios e avaliações',
          breadcrumb: 'Elogios e avaliações',
          roles: ['ADMIN', 'TECNICO'] as Nivel[],
        },
      },
      {
        path: 'unidades',
        name: 'unidades',
        component: () => import('@/views/UnidadesView.vue'),
        meta: { title: 'Unidades Escolares', breadcrumb: 'Unidades Escolares', roles: ['ADMIN', 'TECNICO'] as Nivel[] },
      },
      {
        path: 'cameras-dvr',
        name: 'cameras-dvr',
        component: () => import('@/views/MonitorDvrsView.vue'),
        meta: { title: 'Câmeras DVR', breadcrumb: 'Câmeras DVR', roles: ['ADMIN', 'TECNICO'] as Nivel[] },
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
          roles: ['ADMIN', 'GESTOR'] as Nivel[],
        },
      },
      {
        path: 'configuracoes',
        name: 'configuracoes',
        component: () => import('@/views/ConfiguracoesView.vue'),
        meta: {
          title: 'Configurações',
          breadcrumb: 'Configurações',
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
