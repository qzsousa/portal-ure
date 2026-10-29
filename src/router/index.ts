import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { Nivel, RotaUsuario } from '@/types'

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
    path: '/assistente',
    name: 'assistente',
    component: () => import('@/views/publico/ChatChamadoView.vue'),
    meta: { public: true, title: 'Assistente CaféIA' },
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
        path: 'chat',
        name: 'chat',
        component: () => import('@/views/ChatIaView.vue'),
        meta: { title: 'Chat IA', breadcrumb: 'Chat IA', roles: ['ADMIN'] as Nivel[], rota: 'dashboard' },
      },
      {
        path: 'painel',
        name: 'painel',
        component: () => import('@/views/PainelView.vue'),
        meta: { title: 'Painel', breadcrumb: 'Painel', rota: 'dashboard' },
      },
      {
        path: 'equipamentos',
        name: 'equipamentos',
        component: () => import('@/views/EquipamentosView.vue'),
        meta: { title: 'Equipamentos', breadcrumb: 'Equipamentos', rota: 'equipamentos' },
      },
      {
        path: 'manutencao',
        name: 'manutencao',
        component: () => import('@/views/ManutencaoView.vue'),
        meta: { title: 'Manutenção', breadcrumb: 'Manutenção', rota: 'equipamentos' },
      },
      {
        path: 'chamados',
        name: 'chamados',
        component: () => import('@/views/ChamadosView.vue'),
        meta: { title: 'Chamados', breadcrumb: 'Chamados', rota: 'chamados' },
      },
      {
        path: 'tutoriais',
        name: 'tutoriais',
        component: () => import('@/views/TutoriaisView.vue'),
        meta: { title: 'Tutoriais', breadcrumb: 'Tutoriais', rota: 'tutoriais' },
      },
      {
        path: 'tutoriais/:id',
        name: 'tutorial-detalhe',
        component: () => import('@/views/TutorialDetalheView.vue'),
        meta: { title: 'Tutorial', breadcrumb: 'Tutorial', rota: 'tutoriais' },
      },
      {
        path: 'feedback',
        name: 'feedback',
        component: () => import('@/views/FeedbackView.vue'),
        meta: {
          title: 'Elogios e avaliações',
          breadcrumb: 'Elogios e avaliações',
          // Só o ADMIN responde a caixa. O Técnico atende chamado e vai à
          // escola — o backend exige o mesmo nível, então liberar aqui sem
          // liberar lá só daria tela que abre e volta 403.
          roles: ['ADMIN'] as Nivel[],
          rota: 'feedback',
        },
      },
      {
        path: 'unidades',
        name: 'unidades',
        component: () => import('@/views/UnidadesView.vue'),
        meta: { title: 'Unidades Escolares', breadcrumb: 'Unidades Escolares', roles: ['ADMIN', 'TECNICO'] as Nivel[], rota: 'escolas' },
      },
      {
        path: 'cameras-dvr',
        name: 'cameras-dvr',
        component: () => import('@/views/MonitorDvrsView.vue'),
        // O monitor confere o nível sozinho (`NIVEIS_PERMITIDOS` no monitor).
        meta: { title: 'Câmeras DVR', breadcrumb: 'Câmeras DVR', roles: ['ADMIN'] as Nivel[], rota: 'equipamentos' },
      },
      {
        path: 'relatorios',
        name: 'relatorios',
        component: () => import('@/views/RelatoriosView.vue'),
        meta: { title: 'Relatórios', breadcrumb: 'Relatórios', rota: 'chamados' },
      },
      {
        path: 'usuarios',
        name: 'usuarios',
        component: () => import('@/views/UsuariosView.vue'),
        meta: {
          title: 'Usuários',
          breadcrumb: 'Usuários',
          roles: ['ADMIN', 'GESTOR'] as Nivel[],
          rota: 'usuarios',
        },
      },
      {
        path: 'links-internet',
        name: 'links-internet',
        component: () => import('@/views/LinksInternetView.vue'),
        meta: {
          title: 'Links de Internet',
          breadcrumb: 'Links de Internet',
          roles: ['ADMIN'] as Nivel[],
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
          rota: 'formulario',
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
    return { name: auth.rotaInicial }
  }

  // Restrição de rota: o usuário só abre as telas da lista que o backend
  // devolve em `rotasPermitidas`. Sem isto o menu esconde o item mas a tela
  // abre pela URL, e o 403 do servidor chega depois — tela quebrada em vez de
  // recusa. A segurança é o 403 do backend; isto é a experiência.
  const rota = to.meta.rota as RotaUsuario | undefined
  if (rota && !auth.podeAcessarRota(rota)) {
    return { name: auth.rotaInicial }
  }

  document.title = to.meta.title ? `${to.meta.title} · PORTAL URE LESTE 3` : 'PORTAL URE LESTE 3'

  return true
})
