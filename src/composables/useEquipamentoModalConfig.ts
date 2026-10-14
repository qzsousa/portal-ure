/**
 * Configuração das perguntas (campos) do modal de cadastro/edição de equipamento.
 *
 * Persiste no navegador do administrador (localStorage). Quando o back-end
 * passar a expor um endpoint dedicado, basta trocar `carregar()`/`salvar()`
 * por chamadas HTTP — a forma do dado não muda.
 */
import { computed, ref } from 'vue'

export interface EquipamentoCampoConfig {
  chave: string
  rotulo: string
  ajuda: string
  tipo: 'texto' | 'opcoes' | 'textarea' | 'select'
  obrigatorio: boolean
  ativo: boolean
  ordem: number
  /** Perfis (nível do usuário) que veem/preenchem esta pergunta. Vazio = todos. */
  perfis: string[]
  /** Perguntas criadas pelo ADMIN: texto livre em vez de campo fixo do SCE. */
  personalizada?: boolean
  /** Lista de opções (separadas por vírgula) quando `tipo` = 'opcoes'. */
  opcoes?: string
}

export const PERFIS_USUARIO = ['ADMIN', 'TECNICO', 'GESTOR', 'VISUALIZADOR'] as const

const STORAGE_KEY = 'equipamento-modal-campos'

export const CAMPOS_EQUIPAMENTO_DEFAULT: EquipamentoCampoConfig[] = [
  { chave: 'unidade', rotulo: 'Unidade escolar', ajuda: '', tipo: 'select', obrigatorio: true, ativo: true, ordem: 1, perfis: [...PERFIS_USUARIO] },
  { chave: 'status', rotulo: 'Status', ajuda: '', tipo: 'opcoes', obrigatorio: true, ativo: true, ordem: 2, perfis: [...PERFIS_USUARIO] },
  { chave: 'categoria', rotulo: 'Categoria', ajuda: '', tipo: 'select', obrigatorio: true, ativo: true, ordem: 3, perfis: [...PERFIS_USUARIO] },
  { chave: 'marca', rotulo: 'Marca', ajuda: '(opcional)', tipo: 'select', obrigatorio: false, ativo: true, ordem: 4, perfis: [...PERFIS_USUARIO] },
  { chave: 'modelo', rotulo: 'Modelo', ajuda: '(opcional)', tipo: 'select', obrigatorio: false, ativo: true, ordem: 5, perfis: [...PERFIS_USUARIO] },
  { chave: 'patrimonio', rotulo: 'Patrimônio', ajuda: '(opcional)', tipo: 'texto', obrigatorio: false, ativo: true, ordem: 6, perfis: [...PERFIS_USUARIO] },
  { chave: 'numeroEtiqueta', rotulo: 'Nº da etiqueta', ajuda: '(opcional)', tipo: 'texto', obrigatorio: false, ativo: true, ordem: 7, perfis: [...PERFIS_USUARIO] },
  { chave: 'numeroSerie', rotulo: 'Nº de série', ajuda: '', tipo: 'texto', obrigatorio: true, ativo: true, ordem: 8, perfis: [...PERFIS_USUARIO] },
  { chave: 'vinculadoBlueMonitor', rotulo: 'Vinculado no BlueMonitor?', ajuda: '(opcional)', tipo: 'opcoes', obrigatorio: false, ativo: true, ordem: 9, perfis: [...PERFIS_USUARIO] },
  { chave: 'numeroChamadoManutencao', rotulo: 'Nº do chamado de manutenção', ajuda: '(status Manutenção)', tipo: 'texto', obrigatorio: false, ativo: true, ordem: 10, perfis: [...PERFIS_USUARIO] },
  { chave: 'descricaoQuebrado', rotulo: 'Descrição do problema', ajuda: '(status Quebrado)', tipo: 'textarea', obrigatorio: false, ativo: true, ordem: 11, perfis: [...PERFIS_USUARIO] },
  { chave: 'boletimOcorrencia', rotulo: 'Boletim de Ocorrência', ajuda: '(status Extraviado)', tipo: 'texto', obrigatorio: false, ativo: true, ordem: 12, perfis: [...PERFIS_USUARIO] },
  { chave: 'justificativaVerificacao', rotulo: 'Justificativa da verificação', ajuda: '(status Em verificação)', tipo: 'textarea', obrigatorio: false, ativo: true, ordem: 13, perfis: [...PERFIS_USUARIO] },
  { chave: 'responsavelAtual', rotulo: 'Responsável atual', ajuda: '(opcional)', tipo: 'texto', obrigatorio: false, ativo: true, ordem: 14, perfis: [...PERFIS_USUARIO] },
  { chave: 'detalhesTecnicos', rotulo: 'Detalhes técnicos', ajuda: '(SO, processador, RAM, armazenamento, tela)', tipo: 'texto', obrigatorio: false, ativo: true, ordem: 15, perfis: [...PERFIS_USUARIO] },
  { chave: 'observacoes', rotulo: 'Observações', ajuda: '(opcional)', tipo: 'textarea', obrigatorio: false, ativo: true, ordem: 16, perfis: [...PERFIS_USUARIO] },
]

function perfisNormalizados(valor: unknown): string[] {
  if (!Array.isArray(valor) || !valor.length) return [...PERFIS_USUARIO]
  return valor.filter((p): p is string => PERFIS_USUARIO.includes(p as never))
}

/** Campos fixos do SCE não podem virar pergunta livre (o servidor não tem coluna). */
function chaveEhFixo(chave: string): boolean {
  return CAMPOS_EQUIPAMENTO_DEFAULT.some((c) => c.chave === chave)
}

function normalizar(lista: EquipamentoCampoConfig[]): EquipamentoCampoConfig[] {
  const base = new Map(CAMPOS_EQUIPAMENTO_DEFAULT.map((c) => [c.chave, c]))
  const result: EquipamentoCampoConfig[] = []
  for (const item of lista || []) {
    if (!item || typeof item.chave !== 'string' || !item.chave.trim()) continue
    const padrao = base.get(item.chave)
    // Chave fora do catálogo e sem o prefixo de pergunta extra: config inválida.
    if (!padrao && !item.chave.startsWith('extra:')) continue
    const tipo = item.tipo && ['texto', 'opcoes', 'textarea', 'select'].includes(item.tipo) ? item.tipo : (padrao?.tipo ?? 'texto')
    result.push({
      chave: item.chave,
      rotulo: String(item.rotulo ?? padrao?.rotulo ?? '').trim() || 'Pergunta',
      ajuda: String(item.ajuda ?? padrao?.ajuda ?? ''),
      tipo,
      obrigatorio: Boolean(item.obrigatorio ?? padrao?.obrigatorio),
      ativo: item.ativo !== false,
      ordem: Number.isFinite(item.ordem) ? (item.ordem as number) : (padrao?.ordem ?? result.length + 1),
      perfis: perfisNormalizados(item.perfis),
      personalizada: !padrao ? true : Boolean(item.personalizada),
      opcoes: String(item.opcoes ?? ''),
    })
  }
  // Adiciona campos novos do default que ainda não existem na config.
  for (const padrao of CAMPOS_EQUIPAMENTO_DEFAULT) {
    if (!result.some((r) => r.chave === padrao.chave)) result.push({ ...padrao })
  }
  return result.sort((a, b) => a.ordem - b.ordem || a.chave.localeCompare(b.chave))
}

export function carregarConfigEquipamento(): EquipamentoCampoConfig[] {
  try {
    const bruto = localStorage.getItem(STORAGE_KEY)
    if (!bruto) return CAMPOS_EQUIPAMENTO_DEFAULT.map((c) => ({ ...c }))
    const parsed = JSON.parse(bruto)
    if (!Array.isArray(parsed)) return CAMPOS_EQUIPAMENTO_DEFAULT.map((c) => ({ ...c }))
    return normalizar(parsed as EquipamentoCampoConfig[])
  } catch {
    return CAMPOS_EQUIPAMENTO_DEFAULT.map((c) => ({ ...c }))
  }
}

export function salvarConfigEquipamento(lista: EquipamentoCampoConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
  } catch {
    // ignore
  }
}

export function restaurarConfigEquipamento(): EquipamentoCampoConfig[] {
  const padrao = CAMPOS_EQUIPAMENTO_DEFAULT.map((c) => ({ ...c }))
  salvarConfigEquipamento(padrao)
  return padrao
}

export function useEquipamentoModalConfig() {
  const campos = ref<EquipamentoCampoConfig[]>(carregarConfigEquipamento())
  const ordenados = computed(() => [...campos.value].sort((a, b) => a.ordem - b.ordem))

  function salvar() {
    // Renumerar ordem antes de persistir.
    const renumerado = [...campos.value]
      .sort((a, b) => a.ordem - b.ordem)
      .map((c, i) => ({ ...c, ordem: (i + 1) }))
    campos.value = renumerado
    salvarConfigEquipamento(campos.value)
  }

  function restaurar() {
    campos.value = restaurarConfigEquipamento()
  }

  /**
   * Cria uma pergunta livre. A resposta não tem coluna no SCE: o modal grava
   * no `observacoes` do equipamento, o que preserva a resposta no banco.
   */
  function novaPergunta(): EquipamentoCampoConfig {
    const maior = campos.value.reduce((max, c) => Math.max(max, c.ordem), 0)
    const pergunta: EquipamentoCampoConfig = {
      chave: `extra:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      rotulo: 'Nova pergunta',
      ajuda: '',
      tipo: 'texto',
      obrigatorio: false,
      ativo: true,
      ordem: maior + 1,
      perfis: [...PERFIS_USUARIO],
      personalizada: true,
      opcoes: '',
    }
    campos.value = [...campos.value, pergunta]
    return pergunta
  }

  function removerPergunta(chave: string): void {
    if (chaveEhFixo(chave)) return
    campos.value = campos.value.filter((c) => c.chave !== chave)
  }

  function obter(chave: string): EquipamentoCampoConfig | undefined {
    return campos.value.find((c) => c.chave === chave)
  }

  function visivel(chave: string): boolean {
    return obter(chave)?.ativo !== false
  }

  function rotulo(chave: string): string {
    return obter(chave)?.rotulo || CAMPOS_EQUIPAMENTO_DEFAULT.find((c) => c.chave === chave)?.rotulo || chave
  }

  function ajuda(chave: string): string {
    return obter(chave)?.ajuda || ''
  }

  function obrigatorio(chave: string): boolean {
    return obter(chave)?.obrigatorio === true
  }

  /** A pergunta aparece para o perfil informado (ou para todos, se não houver restrição). */
  function permitidoPara(chave: string, nivel: string | null | undefined): boolean {
    const c = obter(chave)
    const perfis = c && Array.isArray(c.perfis) && c.perfis.length ? c.perfis : [...PERFIS_USUARIO]
    if (!nivel) return true
    return perfis.includes(nivel)
  }

  /** Perguntas livres configuradas pelo ADMIN (não são campos fixos do SCE). */
  const perguntasExtras = computed(() => ordenados.value.filter((c) => c.personalizada))

  /** Lista de opções já limpa (sem vazios). */
  function opcoesDe(c: EquipamentoCampoConfig): string[] {
    return String(c.opcoes ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean)
  }

  return {
    campos,
    ordenados,
    perguntasExtras,
    salvar,
    restaurar,
    novaPergunta,
    removerPergunta,
    obter,
    visivel,
    rotulo,
    ajuda,
    obrigatorio,
    permitidoPara,
    opcoesDe,
    chaveEhFixo,
  }
}
