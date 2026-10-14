import { computed, reactive, ref } from 'vue'
import {
  listarEmprestimosAtivos,
  listarEquipamentosDaFilial,
  listarEquipamentosGlobal,
  resumirStatus,
  type EquipStats,
  type ModeloCategoria,
} from '@/api/sce'
import { useAuthStore } from '@/stores/auth'
import type { EmprestimoAtivo, Equipamento } from '@/types'

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
  /** Recortes de marca e modelo (selects em cascata da tela). */
  marca: string
  modelo: string
}

/** Comparação tolerante a espaço nas bordas, sem diferenciar caixa. */
function mesmoTexto(a: string | null | undefined, b: string): boolean {
  return (a || '').trim().toLowerCase() === b.trim().toLowerCase()
}

/**
 * Colunas ordenáveis da tela.
 *
 * Mesmo conjunto que o SCE aceita em `/equipamentos-global?ordem=` — o
 * servidor cai em `data_cadastro` para qualquer outra chave, então ordenar por
 * Categoria ordenaria a Matriz por data e a filial por categoria.
 */
export type OrdemEquipamento = 'modelo' | 'patrimonio' | 'numeroSerie' | 'unidade' | 'status'

/** Campo do equipamento correspondente a cada coluna ordenável. */
const CAMPO_POR_ORDEM: Record<OrdemEquipamento, keyof Equipamento> = {
  modelo: 'modelo',
  patrimonio: 'patrimonio',
  numeroSerie: 'numeroSerie',
  unidade: 'unidade',
  status: 'status',
}

/**
 * Ordena a página no cliente (caminho dos perfis sem paginação no servidor).
 * Ausência de valor vai para o fim em qualquer direção — "—" embaixo de quem
 * tem dado é mais útil do que no meio da lista.
 */
function ordenarLocal(items: Equipamento[], ordem: OrdemEquipamento, direcao: 'asc' | 'desc'): Equipamento[] {
  const sinal = direcao === 'asc' ? 1 : -1
  const campo = CAMPO_POR_ORDEM[ordem]
  return [...items].sort((a, b) => {
    const va = (a[campo] as string | null | undefined) || ''
    const vb = (b[campo] as string | null | undefined) || ''
    if (!va && vb) return 1
    if (va && !vb) return -1
    const cmp = va.localeCompare(vb, 'pt-BR', { numeric: true, sensitivity: 'base' })
    return cmp === 0 ? sinal : cmp * sinal
  })
}

/** Rótulos não vazios, sem repetição, em ordem alfabética pt-BR. */
function unicos(valores: string[]): string[] {
  const vistos = new Set<string>()
  for (const v of valores) {
    const t = (v || '').trim()
    if (t) vistos.add(t)
  }
  return [...vistos].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

function filtrarLocal(todos: Equipamento[], f: EquipFiltros): Equipamento[] {
  const busca = f.busca.trim().toLowerCase()
  return todos.filter((e) => {
    if (f.status && e.status !== f.status) return false
    if (f.unidade && e.unidade !== f.unidade) return false
    if (f.categoria && e.categoria !== f.categoria) return false
    if (f.marca && !mesmoTexto(e.marca, f.marca)) return false
    if (f.modelo && !mesmoTexto(e.modelo, f.modelo)) return false
    if (busca) {
      const alvo = `${e.modelo || ''} ${e.marca || ''} ${e.patrimonio || ''} ${e.numeroSerie || ''} ${e.unidade || ''}`.toLowerCase()
      if (!alvo.includes(busca)) return false
    }
    return true
  })
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
export function useEquipamentos(pageSizeInicial = 10) {
  const auth = useAuthStore()
  const isGlobal = computed(() => auth.user?.nivel === 'ADMIN')

  /** Itens por página —seletor da barra de ferramentas, igual ao do SCE. */
  const pageSize = ref(pageSizeInicial)
  /** Coluna e sentido da ordenação; o clique no cabeçalho alterna o sentido. */
  const ordem = ref<OrdemEquipamento>('modelo')
  const direcao = ref<'asc' | 'desc'>('asc')

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
    /** Pares marca/modelo das cargas sem recorte — alimentam os selects em cascata. */
    catalogoModelos: [] as Array<{ marca: string; modelo: string }>,
    /**
     * Empréstimos em aberto por `equipamentoId`. Indexados à parte para não
     * percorrer a lista toda a cada linha da tabela.
     */
    emprestimosPorEquipamento: {} as Record<string, EmprestimoAtivo>,
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

  const stats = computed<EquipStats>(() => resumirStatus(state.porStatus))
  const unidadesOpcoes = computed(() => Object.keys(state.porUnidade).sort())
  const categoriasOpcoes = computed(() => Object.keys(state.porCategoria).sort())
  const statsCarregadas = computed(() => Object.keys(state.porStatus).length > 0)

  const marcasOpcoes = computed(() => unicos(state.catalogoModelos.map((m) => m.marca)))

  /** Modelos em cascata: só os da marca escolhida, quando houver uma. */
  const modelosOpcoes = computed(() => {
    const fonte = filtros.marca
      ? state.catalogoModelos.filter((m) => mesmoTexto(m.marca, filtros.marca))
      : state.catalogoModelos
    return unicos(fonte.map((m) => m.modelo))
  })

  /**
   * Escolas que possuem o modelo escolhido, com a quantidade em cada uma.
   *
   * Sai de `state.porUnidade`, que o SCE já devolve **já restrito ao modelo**:
   * é o mesmo agregado que popula o select de unidade, só que visto pelo outro
   * lado. Nenhuma contagem é refeita aqui — nem sobre `state.items`, que traria
   * só as 10 linhas da página atual.
   */
  const escolasDoModelo = computed(() =>
    Object.entries(state.porUnidade)
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd || a.nome.localeCompare(b.nome, 'pt-BR')),
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

  /**
   * Carrega os empréstimos em aberto e indexa por equipamento.
   *
   * Falha aqui não pode derrubar a tela: o equipamento continua aparecendo,
   * só sem a informação de prazo/responsável. Silencioso justamente por isso —
   * a rota é um complemento, não a fonte da lista.
   */
  async function carregarEmprestimos() {
    try {
      const ativos = await listarEmprestimosAtivos()
      const indice: Record<string, EmprestimoAtivo> = {}
      for (const e of ativos) indice[e.equipamentoId] = e
      state.emprestimosPorEquipamento = indice
    } catch {
      /* mantém o índice anterior */
    }
  }

  /**
   * Anexa o empréstimo correspondente a cada item.
   *
   * Roda depois das duas requisições terminarem: o índice e a lista chegam em
   * paralelo, e anexar dentro de cada uma delas deixaria a última a responder
   * sobrescrever o campo da anterior.
   */
  function anexarEmprestimos(itens: Equipamento[]) {
    const indice = state.emprestimosPorEquipamento
    for (const item of itens) item.emprestimo = indice[item.id] || null
    return itens
  }

  async function carregarServidor() {
    const { data, total, stats: s } = await listarEquipamentosGlobal({
      limite: pageSize.value,
      offset: (state.page - 1) * pageSize.value,
      busca: filtros.busca,
      status: filtros.status,
      unidade: filtros.unidade,
      categoria: filtros.categoria,
      marca: filtros.marca,
      modelo: filtros.modelo,
      ordem: ordem.value,
      direcao: direcao.value,
    })
    state.items = data
    state.total = total
    state.porStatus = s.porStatus
    state.porCategoria = s.porCategoria
    state.porUnidade = s.porUnidade
    /* O drilldown já vem no payload da página: nenhuma requisição extra e
     * nenhuma contagem no cliente (que não fecharia, paginando). */
    state.porModelo = s.porModelo || []
    /* SCE ainda sem `porModelo`: deriva da lista completa, que é o mesmo caminho
     * do modo filial. Some assim que o SCE novo estiver no ar. */
    if (!s.porModelo) await porModeloDaListaCompleta()
    guardarCatalogo()
  }

  /**
   * Guarda marca/modelo para os selects em cascata.
   *
   * Os agregados que chegam são sempre do escopo JÁ filtrado: com um modelo
   * escolhido, `porModelo` volta só com ele, e o select passaria a oferecer
   * uma única opção — impossível trocar de modelo. Por isso o catálogo só é
   * substituído nas cargas sem recorte de marca/modelo; o que o usuário está
   * vendo na tela continua vindo do agregado filtrado.
   */
  function guardarCatalogo() {
    if (filtros.marca || filtros.modelo) return
    state.catalogoModelos = state.porModelo.map((m) => ({ marca: m.marca, modelo: m.modelo }))
  }

  /** Compatibilidade com SCE antigo: conta os modelos sobre a lista inteira. */
  async function porModeloDaListaCompleta() {
    try {
      state.porModelo = agregar(filtrarLocal(await listaCompleta(), filtros)).porModelo
    } catch {
      /* sem drilldown — a tela segue funcionando */
    }
  }

  async function carregarLocal(atualizarCache = false) {
    const todos = await listaCompleta(atualizarCache)
    /* O catálogo sai da lista inteira, não da filtrada: é o dicionário de opções
     * dos selects e precisa continuar completo com um modelo escolhido. */
    if (!filtros.marca && !filtros.modelo) {
      state.catalogoModelos = agregar(todos).porModelo.map((m) => ({ marca: m.marca, modelo: m.modelo }))
    }
    const filtrados = filtrarLocal(todos, filtros)
    const ag = agregar(filtrados)
    state.porStatus = ag.porStatus
    state.porCategoria = ag.porCategoria
    state.porUnidade = ag.porUnidade
    state.porModelo = ag.porModelo
    state.total = filtrados.length
    /* Ordena ANTES de fatiar: aplicá-lo na página isolada faria a página 2
     * trazer os menores valores em vez do continuamento da ordem — a lista
     * pareceria embaralhada ao passar de uma página para a outra. */
    const ordenados = ordenarLocal(filtrados, ordem.value, direcao.value)
    const ini = (state.page - 1) * pageSize.value
    state.items = ordenados.slice(ini, ini + pageSize.value)
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
      /* Os dois pedidos saem juntos: a lista não espera o pragmático falhar,
       * nem o contrário. `carregarEmprestimos` engole o próprio erro. */
      await Promise.all([isGlobal.value ? carregarServidor() : carregarLocal(silencioso), carregarEmprestimos()])
      /* Agora que o índice de empréstimos está pronto, ele é aplicado à página
       * que a outra requisição acabou de montar. */
      state.items = anexarEmprestimos(state.items)
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

  /** Trocar a quantidade por página volta para a primeira — senão a tela em branco. */
  function definirPageSize(n: number) {
    pageSize.value = n
    state.page = 1
    void carregar()
  }

  /** Clique no cabeçalho: mesma coluna inverte o sentido, outra coluna assume ascendente. */
  function alternarOrdem(coluna: OrdemEquipamento) {
    if (ordem.value === coluna) {
      direcao.value = direcao.value === 'asc' ? 'desc' : 'asc'
    } else {
      ordem.value = coluna
      direcao.value = 'asc'
    }
    state.page = 1
    void carregar()
  }

  return {
    state,
    filtros,
    stats,
    isGlobal,
    pageSize,
    ordem,
    direcao,
    unidadesOpcoes,
    categoriasOpcoes,
    marcasOpcoes,
    modelosOpcoes,
    escolasDoModelo,
    statsCarregadas,
    carregar,
    aplicarFiltros,
    irParaPagina,
    definirPageSize,
    alternarOrdem,
  }
}
