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

function normalizar(lista: EquipamentoCampoConfig[]): EquipamentoCampoConfig[] {
  const base = new Map(CAMPOS_EQUIPAMENTO_DEFAULT.map((c) => [c.chave, c]))
  const result: EquipamentoCampoConfig[] = []
  for (const item of lista || []) {
    if (!item || typeof item.chave !== 'string' || !base.has(item.chave)) continue
    const padrao = base.get(item.chave)!
    result.push({
      chave: item.chave,
      rotulo: String(item.rotulo ?? padrao.rotulo),
      ajuda: String(item.ajuda ?? padrao.ajuda ?? ''),
      tipo: item.tipo ?? padrao.tipo,
      obrigatorio: Boolean(item.obrigatorio ?? padrao.obrigatorio),
      ativo: item.ativo !== false,
      ordem: Number.isFinite(item.ordem) ? (item.ordem as number) : padrao.ordem,
      perfis: Array.isArray(item.perfis) && item.perfis.length
        ? item.perfis.filter((p) => PERFIS_USUARIO.includes(p as typeof PERFIS_USUARIO[number]))
        : [...PERFIS_USUARIO],
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

  return { campos, ordenados, salvar, restaurar, obter, visivel, rotulo, ajuda, obrigatorio, permitidoPara }
}
