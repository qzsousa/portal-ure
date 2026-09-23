import { computed, reactive } from 'vue'
import {
  listarEquipamentosDaFilial,
  listarEquipamentosGlobal,
  resumirStatus,
  type EquipStats,
} from '@/api/sce'
import { useAuthStore } from '@/stores/auth'
import type { Equipamento } from '@/types'

export interface EquipFiltros {
  busca: string
  unidade: string
  categoria: string
  status: string
}

function filtrarLocal(todos: Equipamento[], f: EquipFiltros): Equipamento[] {
  const busca = f.busca.trim().toLowerCase()
  return todos.filter((e) => {
    if (f.status && e.status !== f.status) return false
    if (f.unidade && e.unidade !== f.unidade) return false
    if (f.categoria && e.categoria !== f.categoria) return false
    if (busca) {
      const alvo = `${e.modelo || ''} ${e.patrimonio || ''} ${e.numeroSerie || ''} ${e.unidade || ''}`.toLowerCase()
      if (!alvo.includes(busca)) return false
    }
    return true
  })
}

function agregar(items: Equipamento[]) {
  const porStatus: Record<string, number> = {}
  const porCategoria: Record<string, number> = {}
  const porUnidade: Record<string, number> = {}
  for (const e of items) {
    porStatus[e.status || 'Não definido'] = (porStatus[e.status || 'Não definido'] || 0) + 1
    porCategoria[e.categoria || 'Sem categoria'] = (porCategoria[e.categoria || 'Sem categoria'] || 0) + 1
    porUnidade[e.unidade || 'Sem unidade'] = (porUnidade[e.unidade || 'Sem unidade'] || 0) + 1
  }
  return { porStatus, porCategoria, porUnidade }
}

/**
 * Fonte de dados de equipamentos unificada:
 * - Perfil ADMIN (Matriz no SCE): usa /equipamentos-global (paginação e agregações do servidor)
 * - Demais perfis: baixa o escopo da filial e filtra/pagina localmente
 */
export function useEquipamentos(pageSize = 10) {
  const auth = useAuthStore()
  const isGlobal = computed(() => auth.user?.nivel === 'ADMIN')

  const state = reactive({
    loading: true,
    erro: '',
    page: 1,
    items: [] as Equipamento[],
    total: 0,
    porStatus: {} as Record<string, number>,
    porCategoria: {} as Record<string, number>,
    porUnidade: {} as Record<string, number>,
    todosCache: [] as Equipamento[],
    cacheCarregado: false,
  })

  const filtros = reactive<EquipFiltros>({ busca: '', unidade: '', categoria: '', status: '' })

  const stats = computed<EquipStats>(() => resumirStatus(state.porStatus))
  const unidadesOpcoes = computed(() => Object.keys(state.porUnidade).sort())
  const categoriasOpcoes = computed(() => Object.keys(state.porCategoria).sort())
  const statsCarregadas = computed(() => Object.keys(state.porStatus).length > 0)

  async function carregarServidor() {
    const { data, total, stats: s } = await listarEquipamentosGlobal({
      limite: pageSize,
      offset: (state.page - 1) * pageSize,
      busca: filtros.busca,
      status: filtros.status,
      unidade: filtros.unidade,
      categoria: filtros.categoria,
      ordem: 'modelo',
    })
    state.items = data
    state.total = total
    state.porStatus = s.porStatus
    state.porCategoria = s.porCategoria
    state.porUnidade = s.porUnidade
  }

  async function carregarLocal(atualizarCache = false) {
    if (!state.cacheCarregado || atualizarCache) {
      state.todosCache = await listarEquipamentosDaFilial()
      state.cacheCarregado = true
    }
    const filtrados = filtrarLocal(state.todosCache, filtros)
    const ag = agregar(filtrados)
    state.porStatus = ag.porStatus
    state.porCategoria = ag.porCategoria
    state.porUnidade = ag.porUnidade
    state.total = filtrados.length
    const ini = (state.page - 1) * pageSize
    state.items = filtrados.slice(ini, ini + pageSize)
  }

  /**
   * `silencioso`: usado pela atualização automática — não mostra spinner nem
   * mensagem de erro (a tela mantém os dados anteriores). No modo filial,
   * também força a atualização do cache local para enxergar equipamentos
   * recém-cadastrados no SCE.
   */
  async function carregar(silencioso = false) {
    if (!silencioso) {
      state.loading = true
      state.erro = ''
    }
    try {
      if (isGlobal.value) await carregarServidor()
      else await carregarLocal(silencioso)
    } catch (e) {
      if (silencioso) return
      state.erro = e instanceof Error ? e.message : 'Falha ao carregar equipamentos.'
      state.items = []
      state.total = 0
    } finally {
      state.loading = false
    }
  }

  /**
   * Todos os equipamentos de UMA categoria (respeitando os filtros atuais),
   * para o drilldown do gráfico de categorias. No modo filial usa o cache
   * local (sem nova requisição); no modo global consulta a categoria inteira.
   */
  async function itensDaCategoria(categoria: string): Promise<Equipamento[]> {
    if (isGlobal.value) {
      const { data } = await listarEquipamentosGlobal({
        limite: 10000,
        offset: 0,
        busca: filtros.busca,
        status: filtros.status,
        unidade: filtros.unidade,
        categoria,
        ordem: 'modelo',
      })
      return data
    }
    if (!state.cacheCarregado) {
      state.todosCache = await listarEquipamentosDaFilial()
      state.cacheCarregado = true
    }
    return filtrarLocal(state.todosCache, { ...filtros, categoria })
  }

  function aplicarFiltros() {
    state.page = 1
    void carregar()
  }

  function irParaPagina(p: number) {
    state.page = p
    void carregar()
  }

  return {
    state,
    filtros,
    stats,
    isGlobal,
    unidadesOpcoes,
    categoriasOpcoes,
    statsCarregadas,
    carregar,
    itensDaCategoria,
    aplicarFiltros,
    irParaPagina,
  }
}
