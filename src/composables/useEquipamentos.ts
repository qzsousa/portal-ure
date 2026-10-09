import { computed, reactive, ref } from 'vue'
import {
  listarCatalogoCompleto,
  listarEquipamentosDaFilial,
  listarEquipamentosGlobal,
  resumirStatus,
  escolasDoAgregado,
  type EquipStats,
  type ItemLista,
  type ModeloCategoria,
  type UnidadeQuantidade,
} from '@/api/sce'
import { useAuthStore } from '@/stores/auth'
import type { Equipamento } from '@/types'

/**
 * Validade da lista completa em cache. Só é usada no caminho de compatibilidade
 * (SCE sem `porModelo`), que baixa a lista inteira para contar.
 */
const TTL_CACHE_MS = 2 * 60 * 1000

export interface EquipFiltros {
  busca: string
  unidade: string
  categoria: string
  status: string
  /** Marca e modelo: no modo global são aplicados pelo SCE, não no navegador. */
  marca: string
  modelo: string
}

function filtrarLocal(todos: Equipamento[], f: EquipFiltros): Equipamento[] {
  const busca = f.busca.trim().toLowerCase()
  return todos.filter((e) => {
    if (f.status && e.status !== f.status) return false
    if (f.unidade && e.unidade !== f.unidade) return false
    if (f.categoria && e.categoria !== f.categoria) return false
    if (f.marca && (e.marca || '') !== f.marca) return false
    if (f.modelo && (e.modelo || '') !== f.modelo) return false
    if (busca) {
      const alvo = `${e.modelo || ''} ${e.patrimonio || ''} ${e.numeroSerie || ''} ${e.unidade || ''}`.toLowerCase()
      if (!alvo.includes(busca)) return false
    }
    return true
  })
}

/** Sem repetidos e sem vazio, em ordem alfabética pt-BR. */
function semVazios(valores: string[]): string[] {
  return [...new Set(valores.filter((v) => !!v))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/**
 * O valor escolhido continua na lista de opções mesmo que a fonte ainda não o
 * conheça — sem isso o select apareceria "em branco" com um filtro ativo.
 */
function comSelecionado(lista: string[], selecionado: string): string[] {
  return selecionado && !lista.includes(selecionado) ? [...lista, selecionado] : lista
}

/**
 * Agregados do escopo filtrado. `porModelo` é o drilldown do gráfico de
 * categorias: a chave é `categoria||marca||modelo` e o servidor agrupa do mesmo
 * jeito, então a soma das linhas fecha com `porCategoria` por construção.
 */
function agregar(items: Equipamento[]) {
  const porStatus: Record<string, number> = {}
  const porCategoria: Record<string, number> = {}
  const porUnidade: Record<string, number> = {}
  const porModelo = new Map<string, ModeloCategoria>()
  for (const e of items) {
    porStatus[e.status || 'Não definido'] = (porStatus[e.status || 'Não definido'] || 0) + 1
    porCategoria[e.categoria || 'Sem categoria'] = (porCategoria[e.categoria || 'Sem categoria'] || 0) + 1
    porUnidade[e.unidade || 'Sem unidade'] = (porUnidade[e.unidade || 'Sem unidade'] || 0) + 1
    const categoria = e.categoria || 'Sem categoria'
    const chave = `${categoria}||${e.marca || ''}||${e.modelo || ''}`
    const jaContado = porModelo.get(chave)
    if (jaContado) jaContado.qtd += 1
    else porModelo.set(chave, { categoria, marca: e.marca || '', modelo: e.modelo || '', qtd: 1 })
  }
  return { porStatus, porCategoria, porUnidade, porModelo: [...porModelo.values()] }
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
    /** categoria/marca/modelo → quantidade (drilldown do gráfico de categorias). */
    porModelo: [] as ModeloCategoria[],
    todosCache: [] as Equipamento[],
    cacheCarregado: false,
  })

  const filtros = reactive<EquipFiltros>({
    busca: '',
    unidade: '',
    categoria: '',
    status: '',
    marca: '',
    modelo: '',
  })
  /** Instante da última baixa da lista completa (ver `TTL_CACHE_MS`). */
  let cacheEm = 0

  /* ---------- Opções dos selects de marca e modelo ---------- */

  /** Catálogo categoria/marca/modelo do SCE (gerenciado ∪ o que existe em campo). */
  const catalogoOpcoes = ref<ItemLista[]>([])
  const carregandoOpcoes = ref(false)

  /**
   * Fonte das opções dos selects: o catálogo do SCE, que **não encolhe** quando
   * um filtro é aplicado, e — enquanto ele não chega, ou se a chamada falhar —
   * os agregados que a tela já tem em memória (`state.porModelo`).
   */
  const itensConhecidos = computed<ItemLista[]>(() =>
    catalogoOpcoes.value.length ? catalogoOpcoes.value : state.porModelo,
  )

  const marcasOpcoes = computed(() => {
    const marcas = itensConhecidos.value
      .filter((i) => !filtros.categoria || i.categoria === filtros.categoria)
      .map((i) => i.marca)
    return comSelecionado(semVazios(marcas), filtros.marca)
  })

  /** Modelos da marca selecionada (e da categoria, quando houver). */
  const modelosOpcoes = computed(() => {
    const modelos = itensConhecidos.value
      .filter(
        (i) =>
          (!filtros.categoria || i.categoria === filtros.categoria) &&
          (!filtros.marca || i.marca === filtros.marca),
      )
      .map((i) => i.modelo)
    return comSelecionado(semVazios(modelos), filtros.modelo)
  })

  /** Este par marca/modelo existe? É o que decide manter ou limpar o modelo. */
  function parMarcaModeloExiste(marca: string, modelo: string): boolean {
    return itensConhecidos.value.some((i) => i.modelo === modelo && i.marca === marca)
  }

  /**
   * Catálogo de marcas/modelos, carregado **uma vez**. Falhar aqui não é falha
   * de tela: as opções passam a sair dos agregados já carregados e o filtro
   * continua funcionando.
   */
  async function carregarOpcoesMarcaModelo() {
    if (catalogoOpcoes.value.length || carregandoOpcoes.value) return
    carregandoOpcoes.value = true
    try {
      catalogoOpcoes.value = await listarCatalogoCompleto()
    } catch {
      /* sem catálogo — as opções vêm dos agregados */
    } finally {
      carregandoOpcoes.value = false
    }
  }

  /**
   * Trocar de marca pode invalidar o modelo escolhido: o select de modelos é
   * filtrado pela marca, e um modelo que não pertence à marca nova devolveria
   * uma lista vazia sem explicação na tela.
   */
  function aoTrocarMarca() {
    if (filtros.modelo && !parMarcaModeloExiste(filtros.marca, filtros.modelo)) {
      filtros.modelo = ''
    }
    aplicarFiltros()
  }

  const stats = computed<EquipStats>(() => resumirStatus(state.porStatus))
  const unidadesOpcoes = computed(() => Object.keys(state.porUnidade).sort())
  const categoriasOpcoes = computed(() => Object.keys(state.porCategoria).sort())
  const statsCarregadas = computed(() => Object.keys(state.porStatus).length > 0)
  /**
   * Escolas que possuem o modelo filtrado, com a quantidade de cada uma. Sai do
   * agregado `porUnidade` que o SCE já devolve **recortado pelos filtros** (no
   * modo global) e do `agregar()` local nos demais perfis — nada é recalculado
   * aqui. Vazio enquanto nenhum modelo está selecionado.
   */
  const escolasComModelo = computed<UnidadeQuantidade[]>(() =>
    filtros.modelo.trim() ? escolasDoAgregado(state.porUnidade) : [],
  )

  /** Lista completa do escopo do usuário, reaproveitando o cache em memória. */
  async function listaCompleta(atualizar = false): Promise<Equipamento[]> {
    const expirada = Date.now() - cacheEm > TTL_CACHE_MS
    if (atualizar || !state.cacheCarregado || expirada) {
      state.todosCache = await listarEquipamentosDaFilial()
      state.cacheCarregado = true
      cacheEm = Date.now()
    }
    return state.todosCache
  }

  async function carregarServidor() {
    const { data, total, stats: s } = await listarEquipamentosGlobal({
      limite: pageSize,
      offset: (state.page - 1) * pageSize,
      busca: filtros.busca,
      status: filtros.status,
      unidade: filtros.unidade,
      categoria: filtros.categoria,
      marca: filtros.marca,
      modelo: filtros.modelo,
      ordem: 'modelo',
    })
    state.items = data
    state.total = total
    state.porStatus = s.porStatus
    state.porCategoria = s.porCategoria
    state.porUnidade = s.porUnidade
    /* O drilldown já vem no payload da página: nenhuma requisição extra e
     * nenhuma contagem no cliente (que não fecharia, paginando). */
    state.porModelo = s.porModelo || []
    /* SCE ainda sem `porModelo`: recompila o estado inteiro da lista completa —
     * o mesmo caminho do modo filial — para os filtros de marca/modelo valerem
     * na tabela e na visão de escolas também com SCE antigo. Some assim que o
     * SCE novo estiver no ar. */
    if (!s.porModelo) {
      try {
        await carregarLocal()
      } catch {
        /* sem lista completa: a página do servidor segue valendo, sem drilldown */
      }
    }
  }

  async function carregarLocal(atualizarCache = false) {
    const todos = await listaCompleta(atualizarCache)
    const filtrados = filtrarLocal(todos, filtros)
    const ag = agregar(filtrados)
    state.porStatus = ag.porStatus
    state.porCategoria = ag.porCategoria
    state.porUnidade = ag.porUnidade
    state.porModelo = ag.porModelo
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
    marcasOpcoes,
    modelosOpcoes,
    escolasComModelo,
    statsCarregadas,
    carregar,
    aplicarFiltros,
    aoTrocarMarca,
    carregarOpcoesMarcaModelo,
    irParaPagina,
  }
}
