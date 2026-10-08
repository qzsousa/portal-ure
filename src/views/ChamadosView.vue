<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { AxiosError } from 'axios'
import { apiError } from '@/utils/apiError'
import {
  AlertTriangle,
  Check,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  ClipboardPen,
  Clock,
  Copy,
  FileText,
  Heart,
  History,
  Layers,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquare,
  Paperclip,
  RefreshCcw,
  RotateCcw,
  School,
  Search,
  Send,
  Settings,
  Star,
  ThumbsDown,
  ThumbsUp,
  UserPlus,
  Wrench,
  X,
} from '@lucide/vue'
import BaseAccordion from '@/components/ui/BaseAccordion.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import RowActions from '@/components/ui/RowActions.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import {
  aceitarChamado,
  atualizarChamadosEmLote,
  atualizarStatusChamado,
  conferirChamado,
  concluirChamado,
  deletarChamado,
  encaminharChamado,
  getChamado,
  listarChamados,
  listarTecnicos,
  listarTecnicosDaUnidade,
  listarTecnicosDoFiltro,
  registrarAtividade,
  responderChamado,
  rotuloStatusChamado,
  STATUS_FLUXO,
  CATEGORIA_SEM_CHAVE,
  type AnexoMensagemPayload,
  type FiltrosChamado,
  type TecnicoDestino,
} from '@/api/chamados'
import { chamadosApi } from '@/api/http'
import {
  avaliarChamadoPorProtocolo,
  getFormularioPublico,
  type FormularioCategoria,
} from '@/api/publico'
import { AUTO_REFRESH_MS, useAutoRefresh } from '@/composables/useAutoRefresh'
import { formatDate, formatDateTime } from '@/utils/format'
import { GRUPO_UNIDADE, chaveDaCategoria, ehCategoriaEquipeReduzida, ordenarTecnicos } from '@/utils/tecnicos'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import {
  ROTULO_TIPO_ATIVIDADE,
  montarEscopo,
  type Chamado,
  type ChamadoAtividade,
  type ChamadoMensagem,
  type StatusChamado,
  type TipoAtividade,
} from '@/types'

const auth = useAuthStore()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()

/**
 * E-mails de contato por escola (individual).
 * Escolas que dividem prédio aparecem separadas no mapa —
 * a resolução faz split por "/" e retorna os dois e-mails.
 */
const EMAILS_POR_ESCOLA: Record<string, string> = {
  'E.E. ADHEMAR ANTONIO PRADO': 'e003244a@educacao.sp.gov.br',
  'E.E. ALCIDES BOSCOLO': 'e003177a@educacao.sp.gov.br',
  'E.E. ANDRÉ NUNES JUNIOR': 'e003311a@educacao.sp.gov.br',
  'E.E. ANÍSIO TEIXEIRA': 'e037047a@educacao.sp.gov.br',
  'E.E. ANTONIETA DE SOUZA ALCÂNTARA': 'e902615a@educacao.sp.gov.br',
  'E.E. ANTONIO CARLOS BRASILEIRO DE ALMEIDA JOBIM - TOM JOBIM': 'e352573a@educacao.sp.gov.br',
  'E.E. AQUILINO RIBEIRO': 'e904302a@educacao.sp.gov.br',
  'E.E. BARRO BRANCO II': 'e926048a@educacao.sp.gov.br',
  'E.E. BELIZE': 'e284324a@educacao.sp.gov.br',
  'E.E. BENJAMIN SAMUEL BLOOM': 'e011788a@educacao.sp.gov.br',
  'E.E. BERNARDIM RIBEIRO': 'e906189a@educacao.sp.gov.br',
  'E.E. BRENO ROSSI, MAESTRO': 'e916730a@educacao.sp.gov.br',
  'E.E. CÂNDIDO PROCÓPIO F. CAMARGO': 'e904922a@educacao.sp.gov.br',
  'E.E. CARLOS HENRIQUE LIBERALLI': 'e039251a@educacao.sp.gov.br',
  'E.E. CARMELINDA M. PEREIRA': 'e909166a@educacao.sp.gov.br',
  'E.E. CESAR DONATO CALABREZ': 'e902627a@educacao.sp.gov.br',
  'E.E. CHARLOTTE MARIA SHAW MASON': 'e011791a@educacao.sp.gov.br',
  'E.E. CHIQUINHA GONZAGA': 'e011795a@educacao.sp.gov.br',
  'E.E. CLAUDIA DUTRA VIANA': 'e438112a@educacao.sp.gov.br',
  'E.E. COHAB CARRÃOZINHO': 'e921464a@educacao.sp.gov.br',
  'E.E. COHAB ITAQUERA IV': 'e916766a@educacao.sp.gov.br',
  'E.E. DÉCIO FERRAZ ALVIM': 'e003128a@educacao.sp.gov.br',
  'E.E. DJANIRA': 'e011787a@educacao.sp.gov.br',
  'E.E. ERNESTINA DEL B. TRAMA': 'e037084a@educacao.sp.gov.br',
  'E.E. ESTHER FIGUEIREDO FERRAZ': 'e925226a@educacao.sp.gov.br',
  'E.E. FABIO AGAZZI': 'e907029a@educacao.sp.gov.br',
  'E.E. FADLO HAIDAR': 'e044337a@educacao.sp.gov.br',
  'E.E. FERNANDO MAURO P. ROCHA, DEPUTADO': 'e902724a@educacao.sp.gov.br',
  'E.E. FERNANDO PESSOA': 'e904284a@educacao.sp.gov.br',
  'E.E. FLORIANO PEIXOTO': 'e011786a@educacao.sp.gov.br',
  'E.E. FRANCISCO DE ASSIS P. CORRÊA': 'e043746a@educacao.sp.gov.br',
  'E.E. FREDERICO MARIANO': 'e048707a@educacao.sp.gov.br',
  'E.E. GERALDINO DOS SANTOS, DEPUTADO': 'e910831a@educacao.sp.gov.br',
  'E.E. GUERRA JUNQUEIRO': 'e904314a@educacao.sp.gov.br',
  'E.E. HAYDEÉ HIDALGO': 'e922146a@educacao.sp.gov.br',
  'E.E. HERBERT JOSÉ DE SOUZA - BETINHO': 'e011798a@educacao.sp.gov.br',
  'E.E. HUMBERTO BAPTISTELLI': 'e447663a@educacao.sp.gov.br',
  'E.E. HUMBERTO DANTAS': 'e037059a@educacao.sp.gov.br',
  'E.E. INDIANA ZUYCHER S. DE JESUS': 'e048677a@educacao.sp.gov.br',
  'E.E. ISAAC SCHRAIBER': 'e909117a@educacao.sp.gov.br',
  'E.E. JARDIM DOM ANGÉLICO': 'e267971a@educacao.sp.gov.br',
  'E.E. JARDIM IGUATEMI': 'e923266a@educacao.sp.gov.br',
  'E.E. JARDIM LIMOEIRO III': 'e925412a@educacao.sp.gov.br',
  'E.E. JARDIM PEDRA BRANCA': 'e433482a@educacao.sp.gov.br',
  'E.E. JARDIM WILMA FLOR': 'e922900a@educacao.sp.gov.br',
  'E.E. JOÃO CASTELLANO': 'e902718a@educacao.sp.gov.br',
  'E.E. JOAQUIM SILVÉRIO G. DOS REIS': 'e048665a@educacao.sp.gov.br',
  'E.E. JORGE LUIS BORGES': 'e907017a@educacao.sp.gov.br',
  'E.E. JOSUÉ DE CASTRO': 'e011797a@educacao.sp.gov.br',
  'E.E. JUAN CARLOS ONETTI': 'e412173a@educacao.sp.gov.br',
  'E.E. LEILA DINIZ': 'e011792a@educacao.sp.gov.br',
  'E.E. LEÔNIDAS DA SILVA': 'e011799a@educacao.sp.gov.br',
  'E.E. LIMA BARRETO': 'e011796a@educacao.sp.gov.br',
  'E.E. LUIZ VAZ DE CAMÕES': 'e902883a@educacao.sp.gov.br',
  'E.E. LUIZ ROSANOVA': 'e003141a@educacao.sp.gov.br',
  'E.E. MARCOS ANTONIO COSTA': 'e923916a@educacao.sp.gov.br',
  'E.E. MARIA ANTONIETA FERRAZ BIBLIOTECARIA': 'e904582a@educacao.sp.gov.br',
  'E.E. MARIA DE LOURDES A. A. PACHECO': 'e906980a@educacao.sp.gov.br',
  'E.E. MARIA TEREZA SIMÕES DE ALMEIDA PROFESSORA': 'e011793a@educacao.sp.gov.br',
  'E.E. MARIUMA BUAZAR MAUAD': 'e904296a@educacao.sp.gov.br',
  'E.E. MOACYR AMARAL DOS SANTOS': 'e048653a@educacao.sp.gov.br',
  'E.E. MOZART TAVARES DE LIMA': 'e036961a@educacao.sp.gov.br',
  'E.E. OSWALDO GAGLIARDI': 'e908368a@educacao.sp.gov.br',
  'E.E. PATRÍCIA GALVÃO - PAGU': 'e011789a@educacao.sp.gov.br',
  'E.E. PAULO ROLIM ROSA': 'e922912a@educacao.sp.gov.br',
  'E.E. PAULO SARASATE GOVERNADOR': 'e036812a@educacao.sp.gov.br',
  'E.E. PEDRO TAQUES': 'e003256a@educacao.sp.gov.br',
  'E.E. RECANTO VERDE SOL': 'e267983a@educacao.sp.gov.br',
  'E.E. RITA PINTO DE ARAUJO': 'e003323a@educacao.sp.gov.br',
  'E.E. ROCCA DORDALL': 'e037060a@educacao.sp.gov.br',
  'E.E. ROQUE THEOPHILO': 'e268276a@educacao.sp.gov.br',
  'E.E. ROSA PARKS': 'e011790a@educacao.sp.gov.br',
  'E.E. RUY DE MELLO JUNQUEIRA': 'e920277a@educacao.sp.gov.br',
  'E.E. SALIM FARAH MALUF': 'e044325a@educacao.sp.gov.br',
  'E.E. SALVADOR ALLENDE GOSSENS': 'e906967a@educacao.sp.gov.br',
  'E.E. SATURNINO PEREIRA': 'e909185a@educacao.sp.gov.br',
  'E.E. SEBASTIÃO FARIAS ZIMBRES': 'e003268a@educacao.sp.gov.br',
  'E.E. SERGIO ESTANISTLAU DE CAMARGO': 'e914712a@educacao.sp.gov.br',
  'E.E. SERGIO ROCHA KIEHL': 'e916785a@educacao.sp.gov.br',
  'E.E. SILVANA EVANGELISTA': 'e923278a@educacao.sp.gov.br',
  'E.E. SIMÃO MATHIAS': 'e916742a@educacao.sp.gov.br',
  'E.E. SUMIE IWATA': 'e909129a@educacao.sp.gov.br',
  'E.E. VILA BELA': 'e923047a@educacao.sp.gov.br',
  'E.E. YERVANT KISSAJIKIAN': 'e906207a@educacao.sp.gov.br',
  'E.E. ZÍPORA RUBISTEIN': 'e914721a@educacao.sp.gov.br',
}

/**
 * Retorna os e-mails das escolas contidas no campo `unidade`.
 * O campo pode vir como "E.E. ESCOLA A / E.E. ESCOLA B" — fazemos split por "/"
 * e normalizamos o nome para buscar no mapa.
 * Retorna array de objetos { escola, email }.
 */
function emailsDaUnidade(unidade: string): Array<{ escola: string; email: string }> {
  if (!unidade) return []
  const partes = unidade.split('/').map(p => p.trim())
  const emails: Array<{ escola: string; email: string }> = []
  for (const parte of partes) {
    const email = EMAILS_POR_ESCOLA[parte]
    if (email) emails.push({ escola: parte, email })
  }
  return emails
}

/**
 * E-mails formatados para exibição no modal do chamado.
 * Retorna array de objetos { escola, email }.
 */
const emailsUnidadeFormatados = computed(() => {
  if (!detalhe.value?.unidade) return []
  return emailsDaUnidade(detalhe.value.unidade)
})

/**
 * Copia texto para a área de transferência.
 */
async function copiarTexto(texto: string) {
  try {
    await navigator.clipboard.writeText(texto)
    ui.success('Copiado!')
  } catch {
    ui.error('Falha ao copiar')
  }
}

/**
 * true quando o chamado é da categoria PortalNet.
 *
 * Usa `chaveDaCategoria` em vez de comparar `categoriaChave` direto porque
 * o helper normaliza para MAIÚSCULAS (a comparação literal com 'PortalNet'
 * nunca casava) e ainda cai no texto de `tipo` quando a chave não veio gravada,
 * que é o caso dos chamados abertos antes da criação das chaves.
 */
const ehPortalNet = computed(() => {
  const ch = detalhe.value
  if (!ch) return false
  if (chaveDaCategoria(ch) === 'PORTALNET') return true
  /* Chamado antigo: sem `categoriaChave`, `chaveDaCategoria` devolve a categoria
   * genérica ("SISTEMAS") a partir do `tipo` ("Sistema - PortalNet"). Nesse caso
   * só o texto do `tipo` diz que o sistema é o PortalNet. */
  return /portal\s*net/i.test(ch.tipo || '')
})

/**
 * Parseia a descrição do PortalNet, que pode chegar em dois formatos:
 * - por linha: "Sistema: PortalNet\nRG: 352177937\nNome: EXEMPLO DA SILVA"
 * - inline, separados por pipe: "Sistema: PortalNet | RG: 25233601x | Nome: ... "
 *
 * No formato inline o valor também pode conter ":" (ex.: horário ou URL),
 * então só a primeira occurrence é usada como separador chave/valor.
 */
const portalNetCampos = computed(() => {
  if (!ehPortalNet.value || !detalhe.value?.descricao) return null
  const partes = detalhe.value.descricao
    .split(/\r?\n|\s*\|\s*/)
    .map(p => p.trim())
    .filter(Boolean)
  const campos: Record<string, string> = {}
  for (const parte of partes) {
    const idx = parte.indexOf(':')
    if (idx > 0) {
      const chave = parte.slice(0, idx).trim()
      const valor = parte.slice(idx + 1).trim()
      if (chave && valor) campos[chave] = valor
    }
  }
  return Object.keys(campos).length ? campos : null
})

/**
 * Trechos da descrição que NÃO são "chave: valor": é aí que cai a descrição
 * adicional digitada livremente no formulário. Antes era descartada aqui — o
 * modal mostrava só os campos do PortalNet e o texto sumia.
 */
const portalNetExtras = computed(() => {
  if (!ehPortalNet.value || !detalhe.value?.descricao) return []
  return detalhe.value.descricao
    .split(/\r?\n|\s*\|\s*/)
    .map(p => p.trim())
    .filter(Boolean)
    .filter((parte) => {
      const idx = parte.indexOf(':')
      return !(idx > 0 && parte.slice(0, idx).trim() && parte.slice(idx + 1).trim())
    })
})

/** Campos do PortalNet que gain botão de copiar (comparação sem diferenciar maiúsculas). */
const CAMPOS_COPIAVEIS = ['rg', 'cie', 'nome']

function podeCopiarPortalNet(chave: string) {
  return CAMPOS_COPIAVEIS.includes(chave.trim().toLowerCase())
}

/**
 * Descrição dos chamados sem estrutura PortalNet: quebra linhas e pipes para
 * que cada trecho vire um bloco, em vez de tudo grudado com " | " no meio.
 */
const descricaoLinhas = computed(() => {
  const texto = detalhe.value?.descricao
  if (!texto) return []
  return texto
    .split(/\r?\n|\s*\|\s*/)
    .map(l => l.trim())
    .filter(Boolean)
})

const stats = ref<{
  total: number
  abertos: number
  andamento: number
  comunicado: number
  aguardandoConferencia: number
  resolvidos: number
} | null>(null)

const estado = reactive({
  loading: true,
  erro: '',
  items: [] as Chamado[],
  total: 0,
  page: 1,
})
const PAGE_SIZE = 10

const filtros = reactive<FiltrosChamado>({
  status: '',
  unidade: '',
  urgencia: '',
  categoriaChave: '',
  responsavel: '',
})

/* Matriz (ADMIN/TECNICO) tem controle total; escola (GESTOR/VISUALIZADOR) só responde e conclui. */
const ehMatriz = computed(() => ['ADMIN', 'TECNICO'].includes(auth.user?.nivel || ''))
const ehEscola = computed(() => ['GESTOR', 'VISUALIZADOR'].includes(auth.user?.nivel || ''))
const ehTecnico = computed(() => auth.user?.nivel === 'TECNICO')
const podeLote = computed(() => ehMatriz.value)

/* ------- Aceitar / concluir rápido (técnico, pensado para o celular) ------- */

/**
 * O chamado está ENCAMINHADO PARA O TÉCNICO LOGADO? O vínculo é o nome gravado
 * em `responsavel` pelo encaminhamento (manual ou automático) — o backend
 * valida de novo na hora de aceitar/concluir.
 */
function ehDoTecnico(c: Chamado): boolean {
  return ehTecnico.value && !!auth.user?.nome && c.responsavel === auth.user.nome
}

/**
 * Ações RÁPIDAS na LINHA da tabela (fora do modal).
 *
 * Nome com sufixo de propósito: o modal tem os seus próprios, calculados a
 * partir de `detalhe`. São duas coisas diferentes — aqui o chamado é um item da
 * lista e o técnico precisa estar de celular, um toque e pronto; lá o técnico
 * pode registrar o serviço, anexar foto e descrever a conclusão.
 *
 * O que a BARRA DE AÇÃO do modal mostra está em `acaoDoMomento`, que usa
 * `podeAceitar`/`podeRegistrar`. Aqui na linha é a mesma regra, com o mesmo
 * cuidado: o que decide é o STATUS, não `aceitoEm`.
 *
 * `aceitoEm` é acumulado entre ciclos — contestada, a escola joga o chamado
 * para ABERTO e o carimbo antigo continua gravado. Julgando por ele, um
 * chamado contestado aparecia com "Concluir" (que o backend recusa com 409) e
 * sem "Aceitar", que é justamente o que o técnico precisa fazer de novo.
 */
function podeAceitarNaLinha(c: Chamado): boolean {
  return ehDoTecnico(c) && AGUARDANDO_ACEITE.includes(c.status)
}

/**
 * Já aceito neste ciclo e ainda não entregue à escola: mostra "Concluir".
 *
 * Espelha `STATUS_COM_TECNICO_ACEITO` do backend — um chamado em ABERTO (reaberto
 * pela escola) ou RESOLVIDO não pode ser concluído, e o botão que não vai
 * funcionar é pior do que o botão ausente.
 */
function podeConcluirNaLinha(c: Chamado): boolean {
  return ehDoTecnico(c) && COM_TECNICO_ACEITO.includes(c.status) && c.status !== 'AGUARDANDO_CONFERENCIA'
}

/** Id do chamado com ação rápida em voo — trava o botão contra toque duplo. */
const acaoRapidaEmAndamento = ref<string | null>(null)

/** Reflete o chamado atualizado na linha da tabela e no modal, se for o aberto. */
function refletirAtualizacao(atualizado: Chamado) {
  const i = estado.items.findIndex((x) => x.id === atualizado.id)
  if (i >= 0) estado.items[i] = { ...estado.items[i], ...atualizado }
  if (detalhe.value?.id === atualizado.id) {
    detalhe.value = atualizado
    novoStatus.value = atualizado.status
  }
}

async function aceitarChamadoRapido(c: Chamado) {
  if (acaoRapidaEmAndamento.value) return
  acaoRapidaEmAndamento.value = c.id
  try {
    const atualizado = await aceitarChamado(c.id)
    refletirAtualizacao(atualizado)
    ui.success(`Chamado ${atualizado.protocolo} aceito — você é o responsável pelo atendimento.`)
    await Promise.all([carregar(true), carregarStats()])
  } catch (e) {
    ui.error(apiError(e, 'Falha ao aceitar o chamado.'))
  } finally {
    acaoRapidaEmAndamento.value = null
  }
}

/**
 * Concluir direto da LINHA da tabela.
 *
 * Antes chamava `window.prompt`: no celular isso abre um campo de uma linha só,
 * não aceita foto e some com o contexto do chamado enquanto se digita. Abrir o
 * modal já no formulário de conclusão custa o mesmo número de toques e devolve
 * um formulário de verdade — texto com espaço, anexos e o histórico do serviço
 * à vista para conferir antes de enviar.
 *
 * Não chama `PATCH /status` com `RESOLVIDO`: no fluxo atual o técnico **não
 * encerra** o chamado — ele entrega o serviço e a escola confere. O envio vai
 * pelo endpoint `/concluir`, que exige o texto do que foi feito.
 */
function concluirChamadoTecnico(c: Chamado) {
  void abrirDetalhe(c, { abrirConclusao: true })
}

/* ---------- Seleção múltipla (batch) ---------- */
const selecionados = ref<Set<string>>(new Set())
const loteStatus = ref<StatusChamado | ''>('')

const todosMarcados = computed(
  () => estado.items.length > 0 && estado.items.every((c) => selecionados.value.has(c.id)),
)

function alternarTodos() {
  const novo = new Set(selecionados.value)
  if (todosMarcados.value) estado.items.forEach((c) => novo.delete(c.id))
  else estado.items.forEach((c) => novo.add(c.id))
  selecionados.value = novo
}

function alternar(id: string) {
  const novo = new Set(selecionados.value)
  if (novo.has(id)) novo.delete(id)
  else novo.add(id)
  selecionados.value = novo
}

async function aplicarEmLote() {
  if (!loteStatus.value || selecionados.value.size === 0) return
  try {
    const r = await atualizarChamadosEmLote([...selecionados.value], { status: loteStatus.value })
    ui.success(`${r.atualizados} chamado(s) atualizados para "${rotuloStatusChamado(loteStatus.value)}".`)
    selecionados.value = new Set()
    loteStatus.value = ''
    await Promise.all([carregar(), carregarStats()])
  } catch (e) {
    ui.error(apiError(e, 'Falha na atualização em lote.'))
  }
}

/** `silencioso`: atualização automática — não mostra spinner nem erro na tela. */
async function carregar(silencioso = false) {
  if (!silencioso) estado.loading = true
  try {
    const res = await listarChamados({ ...filtros, page: estado.page, limit: PAGE_SIZE })
    estado.items = res.data
    estado.total = res.meta.total
    estado.erro = ''
  } catch {
    if (!silencioso) estado.erro = 'Não foi possível carregar os chamados.'
  } finally {
    estado.loading = false
  }
}

async function carregarStats() {
  try {
    const { data } = await chamadosApi.get('/dashboard/stats')
    stats.value = data
  } catch {
    stats.value = null
  }
}

function aplicarFiltros() {
  estado.page = 1
  void carregar()
}

/* ------- Opções dos filtros de categoria e técnico ------- */

/** Categorias do formulário público — o mesmo catálogo da tela de abertura. */
const categorias = ref<FormularioCategoria[]>([])
const tecnicosFiltro = ref<string[]>([])

/**
 * Só as ativas, na ordem em que aparecem para quem abre chamado — e só as que
 * o usuário logado PODE VER.
 *
 * Usuário com escopo de tipos não tem nenhum chamado das outras categorias,
 * então oferecer a categoria no filtro só produziria lista vazia. A
 * autorização é do servidor (a lista já vem filtrada); aqui é para o select
 * não oferecer atalho para o nada.
 */
const opcoesCategoria = computed(() =>
  categorias.value.filter((c) => c.ativa && categoriaVisivel(c.chave)),
)

/** A categoria está dentro do escopo do usuário? Escopo vazio = tudo visível. */
function categoriaVisivel(chave: string): boolean {
  const escopo = auth.user?.escopoTipos ?? []
  if (!escopo.length) return true
  // O escopo guarda o TIPO (`chave::rótulo`); "a categoria tem algum tipo
  // liberado" é o que interessa para o filtro.
  return escopo.some((v) => v === montarEscopo(chave, '') || v.startsWith(`${chave}::`))
}

/**
 * Falha ao carregar as opções NÃO pode derrubar a tela: os dois selects ficam
 * só com "Todos" e a listagem segue funcionando. Filtro é conveniência, não
 * requisito para ver os chamados.
 */
async function carregarOpcoesFiltro() {
  const [cats, tecnicos] = await Promise.all([
    getFormularioPublico().catch(() => []),
    listarTecnicosDoFiltro().catch(() => []),
  ])
  categorias.value = cats
  tecnicosFiltro.value = tecnicos
}

/* ------- Chips de filtro rápido ------- */
/**
 * Os chips são as ETAPAS do fluxo, na ordem em que o chamado passa por elas.
 * Não existe chip "em aberto" porque isso exigiria um filtro de conjunto no
 * backend; quem quer a fila inteira marca "Abertos" e "Encaminhados".
 */
const STATUS_CHIPS: Array<{ rotulo: string; valor: StatusChamado | '' }> = [
  { rotulo: 'Todos', valor: '' },
  { rotulo: 'Abertos', valor: 'ABERTO' },
  { rotulo: 'Encaminhados', valor: 'ENCAMINHADO' },
  { rotulo: 'Em atendimento', valor: 'ANDAMENTO' },
  { rotulo: 'Aguardando resposta', valor: 'COMUNICADO' },
  { rotulo: 'Aguardando conferência', valor: 'AGUARDANDO_CONFERENCIA' },
  { rotulo: 'Concluídos', valor: 'RESOLVIDO' },
]

function chipStatus(valor: StatusChamado | '') {
  filtros.status = valor
  aplicarFiltros()
}

function alternarUrgentes() {
  filtros.urgencia = filtros.urgencia === 'Alta' ? '' : 'Alta'
  aplicarFiltros()
}

function alternarPortalNet() {
  filtros.categoria = filtros.categoria === 'PortalNet' ? '' : 'PortalNet'
  // O chip filtra por TEXTO do tipo; o select filtra pela chave da categoria.
  // Deixar os dois marcados seria um filtro invisível somando ao outro.
  if (filtros.categoria) filtros.categoriaChave = ''
  aplicarFiltros()
}

/** Selecionar categoria no select desmarca o chip de texto, pelo mesmo motivo. */
function aplicarCategoria(chave: string) {
  filtros.categoriaChave = chave
  if (chave) filtros.categoria = ''
  aplicarFiltros()
}

/* ------- Detalhe ------- */
const detalheAberto = ref(false)
const detalhe = ref<Chamado | null>(null)
const salvando = ref(false)
const novoStatus = ref<StatusChamado>('ANDAMENTO')
const descricaoResolucao = ref('')
const textoResposta = ref('')

/* ------- Encaminhar para técnico (matriz) ------- */
const encaminharAberto = ref(false)
const encaminhando = ref(false)
const carregandoTecnicos = ref(false)
const tecnicos = ref<TecnicoDestino[]>([])
const tecnicosDaUnidade = ref<TecnicoDestino[]>([])
/** 'UNIDADE' = deixa o backend escolher o técnico da unidade; 'TEC:<id>' = o escolhido. */
const encDestino = ref('UNIDADE')
const encObservacao = ref('')

/** Opções do select agrupadas: quem atende a escola e os demais técnicos. */
const gruposTecnicos = computed(() => {
  const atende = new Set(tecnicosDaUnidade.value.map((t) => t.id))
  const rotulo = (t: TecnicoDestino) =>
    t.abertos === undefined ? t.nome : `${t.nome} · ${t.abertos} aberto${t.abertos === 1 ? '' : 's'}`

  // Só a equipe de atendimento aparece no select, na ordem da escala — em
  // Sistemas/E-mail, apenas as cinco pessoas que atendem esse tipo de chamado.
  const ordenados = ordenarTecnicos(tecnicos.value, { categoriaChave: chaveCategoria.value })

  const daUnidade = ordenados.filter((t) => atende.has(t.id))
  const outros = ordenados.filter((t) => !atende.has(t.id))

  const grupos: Array<{ nome: string; opcoes: Array<{ valor: string; rotulo: string }> }> = []
  if (daUnidade.length) {
    grupos.push({ nome: GRUPO_UNIDADE, opcoes: daUnidade.map((t) => ({ valor: `TEC:${t.id}`, rotulo: rotulo(t) })) })
  }
  if (outros.length) {
    grupos.push({ nome: 'Outros técnicos', opcoes: outros.map((t) => ({ valor: `TEC:${t.id}`, rotulo: rotulo(t) })) })
  }
  return grupos
})

/** true quando quem atende a unidade entrou no select (não entrou em Sistemas/E-mail). */
const unidadeNaLista = computed(() => gruposTecnicos.value[0]?.nome === GRUPO_UNIDADE)

/** Categoria do chamado, com fallback no texto de tipo dos chamados antigos. */
const chaveCategoria = computed(() => chaveDaCategoria(detalhe.value))

/** Chamado de Sistemas/E-mail — a lista de destino é a equipe restrita. */
const equipeReduzida = computed(() => ehCategoriaEquipeReduzida(chaveCategoria.value))

/** Rótulo da opção "Técnico da unidade" (o sucessor é a sugestão do backend). */
const rotuloTecnicoDaUnidade = computed(() => {
  if (carregandoTecnicos.value) return 'Carregando técnicos...'
  const sugerido = tecnicosDaUnidade.value[0]
  if (!sugerido) return 'Técnico da unidade — nenhum técnico cadastrado'
  // Em Sistemas/E-mail o técnico da unidade pode não atender esse tipo de
  // chamado: não nomeia ninguém que ficou fora da lista.
  if (!unidadeNaLista.value) return 'Técnico da unidade'
  return `Técnico da unidade — ${sugerido.nome} (sugerido)`
})

const podeEncaminhar = computed(
  () => !encaminhando.value && (encDestino.value === 'UNIDADE' || encDestino.value.startsWith('TEC:')),
)

/** Abre o modal de detalhes (se preciso) e já abre a caixa de encaminhamento. */
async function abrirEncaminhar(c: Chamado) {
  if (detalhe.value?.id !== c.id) await abrirDetalhe(c)
  if (detalhe.value?.id !== c.id) return
  encaminharAberto.value = true
  encDestino.value = 'UNIDADE'
  encObservacao.value = ''
  tecnicos.value = []
  tecnicosDaUnidade.value = []
  carregandoTecnicos.value = true
  try {
    // As sugestões da unidade vêm primeiro: o select já abre com
    // "Técnico da unidade" escolhido, que é o comportamento padrão.
    const [daUnidade, todos] = await Promise.all([
      listarTecnicosDaUnidade(c.id).catch(() => []),
      listarTecnicos().catch(() => []),
    ])
    tecnicosDaUnidade.value = daUnidade
    tecnicos.value = todos
  } catch (e) {
    ui.error(apiError(e, 'Não foi possível carregar os técnicos.'))
  } finally {
    carregandoTecnicos.value = false
  }
}

async function confirmarEncaminhar() {
  if (!detalhe.value || !podeEncaminhar.value) return
  const alvo = detalhe.value
  const anterior = alvo.responsavel
  if (anterior && !window.confirm(
    `O chamado já tem ${anterior} como responsável. Reencaminhar para outro técnico?`,
  )) return

  encaminhando.value = true
  try {
    const ehUnidade = encDestino.value === 'UNIDADE'
    const res = await encaminharChamado(alvo.id, {
      modo: ehUnidade ? 'UNIDADE' : 'TECNICO',
      tecnicoId: ehUnidade ? undefined : encDestino.value.slice(4),
      observacao: encObservacao.value.trim() || undefined,
    })
    detalhe.value = res.chamado
    encaminharAberto.value = false
    ui.success(`Chamado encaminhado para ${res.tecnico.nome}.`)
    await carregar(true)
  } catch (e) {
    ui.error(apiError(e, 'Falha ao encaminhar o chamado.'))
  } finally {
    encaminhando.value = false
  }
}

/* ------- Pergunta & resposta (matriz ↔ escola) ------- */
const TAMANHO_MAX_ANEXO = 5 * 1024 * 1024 // 5 MB por arquivo (limite do backend)
const MAX_ANEXOS = 5
const perguntaEscola = ref('')
const anexosPergunta = ref<AnexoMensagemPayload[]>([])
const respostaEscola = ref('')
const anexosResposta = ref<AnexoMensagemPayload[]>([])
const responderAberto = ref(false)

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function onAnexosChange(e: Event, destino: AnexoMensagemPayload[]) {
  const input = e.target as HTMLInputElement
  const arquivos = [...(input.files || [])]
  for (const arquivo of arquivos) {
    if (destino.length >= MAX_ANEXOS) {
      ui.error(`Máximo de ${MAX_ANEXOS} anexos por mensagem.`)
      break
    }
    if (arquivo.size > TAMANHO_MAX_ANEXO) {
      ui.error(`"${arquivo.name}" é muito grande. O tamanho máximo é 5 MB.`)
      continue
    }
    destino.push({ nome: arquivo.name, tipo: arquivo.type, base64: await fileToBase64(arquivo) })
  }
  input.value = ''
}

/* ------- Avaliação do atendimento (escola, chamado concluído) ------- */

/**
 * A escola avalia daqui quando o chamado é concluído. A credencial enviada é o
 * **e-mail da sessão** (`auth.user.email`), não o e-mail do solicitante: o
 * backend compara os dois e só grava se baterem, então não se libera nada além
 * do que já era permitido na tela pública — apenas sem a pessoa redigitar.
 */
const nota = ref(0)
const notaHover = ref(0)
const comentarioAvaliacao = ref('')
const enviandoAvaliacao = ref(false)
const erroAvaliacao = ref('')
/** Nota enviada agora — controla o cartão de agradecimento. */
const avaliacaoEnviada = ref(0)

const notaExibida = computed(() => notaHover.value || nota.value)

/** Rótulo da nota exibido ao lado das estrelas. Índice 1..5. */
const NOMES_NOTA = ['', 'Muito ruim', 'Ruim', 'Regular', 'Bom', 'Excelente']

/**
 * A sessão é a dona do chamado? Se outra conta abriu, o backend recusaria com
 * 404. Detectamos aqui para explicar, em vez de a pessoa tomar um erro sem
 * origem.
 */
const eDonoDoChamado = computed(() => {
  const emailChamado = detalhe.value?.email?.trim().toLowerCase()
  const emailSessao = auth.user?.email?.trim().toLowerCase()
  // Chamado legado sem e-mail gravado: o backend também recusa, e dizemos o
  // mesmo que a tela pública diria.
  if (!emailChamado) return false
  return emailChamado === emailSessao
})

/** Formulário só depois de concluído e ainda sem nota.
 *
 * `conferidoEm` exige que a ESCOLA tenha conferido — e não a matriz ter
 * encerrado pelo seletor de status. É essa a diferença entre "terminado" e
 * "terminado e verificado por quem pediu". */
const podeAvaliar = computed(
  () =>
    ehEscola.value &&
    detalhe.value?.status === 'RESOLVIDO' &&
    !!detalhe.value?.conferidoEm &&
    !detalhe.value?.avaliacao &&
    !avaliacaoEnviada.value,
)

async function enviarAvaliacao() {
  if (!detalhe.value || enviandoAvaliacao.value) return
  if (nota.value < 1) {
    erroAvaliacao.value = 'Escolha uma nota de 1 a 5 estrelas.'
    return
  }
  erroAvaliacao.value = ''
  enviandoAvaliacao.value = true
  try {
    await avaliarChamadoPorProtocolo(detalhe.value.protocolo, auth.user?.email || '', {
      nota: nota.value,
      comentario: comentarioAvaliacao.value.trim() || undefined,
    })
    // Reflete localmente: o bloco vira "já avaliado" sem reabrir o chamado.
    detalhe.value = {
      ...detalhe.value,
      avaliacao: { nota: nota.value, comentario: comentarioAvaliacao.value.trim() || null },
    }
    avaliacaoEnviada.value = nota.value
  } catch (e) {
    const ax = e as AxiosError
    if (ax.response?.status === 409) {
      erroAvaliacao.value = 'Este chamado já recebeu uma avaliação.'
    } else if (ax.response?.status === 400) {
      erroAvaliacao.value = 'Este chamado ainda não está disponível para avaliação.'
    } else if (ax.response?.status === 404) {
      erroAvaliacao.value = 'Não foi possível confirmar a avaliação deste chamado.'
    } else {
      erroAvaliacao.value = 'Não foi possível enviar sua avaliação agora. Tente novamente.'
    }
  } finally {
    enviandoAvaliacao.value = false
  }
}

/**
 * Abre o modal de detalhes.
 *
 * `opcoes.abrirConclusao` atende o botão "Concluir" da linha da tabela: em vez
 * de um prompt, o modal abre com o formulário de conclusão já aberto e a seção
 * "Atendimento" à vista — que é onde o técnico confere o que registrou antes de
 * dizer que terminou.
 */
async function abrirDetalhe(c: Chamado, opcoes: { abrirConclusao?: boolean } = {}) {
  detalhe.value = c
  novoStatus.value = c.status
  descricaoResolucao.value = c.descricaoResolucao || ''
  textoResposta.value = ''
  perguntaEscola.value = ''
  anexosPergunta.value = []
  respostaEscola.value = ''
  anexosResposta.value = []
  responderAberto.value = false
  encaminharAberto.value = false
  nota.value = 0
  notaHover.value = 0
  comentarioAvaliacao.value = ''
  erroAvaliacao.value = ''
  avaliacaoEnviada.value = 0
  // O fluxo entra limpo: os textareas são de uso único, e uma rascunho deixada
  // num chamado apareceria no próximo aberto na mesma sessão.
  registroAberto.value = false
  textoAtividade.value = ''
  anexosAtividade.value = []
  conclusaoAberta.value = false
  textoConclusao.value = ''
  anexosConclusao.value = []
  conferenciaAberta.value = false
  textoConferencia.value = ''
  anexosConferencia.value = []
  modalidadeConferencia.value = 'aprovado'
  acaoFluxo.value = false
  secaoAberta.value = 'atendimento'
  // Só abre a conclusão quando o chamado realmente permite concluir. A linha da
  // tabela já filtra, mas o modal é a rede de segurança: não deve oferecer um
  // formulário que o backend vai recusar com 409.
  if (opcoes.abrirConclusao && COM_TECNICO_ACEITO.includes(c.status) && c.status !== 'AGUARDANDO_CONFERENCIA') {
    conclusaoAberta.value = true
    textoConclusao.value = c.descricaoResolucao || ''
  }
  detalheAberto.value = true
  // A listagem não traz a conversa — busca o chamado completo (perguntas, respostas e anexos)
  try {
    const completo = await getChamado(c.id)
    if (detalhe.value?.id === completo.id) detalhe.value = completo
  } catch {
    /* mantém os dados da listagem */
  }
}

/* ------- Conversa (perguntas da matriz e respostas da escola) ------- */
const conversa = computed<ChamadoMensagem[]>(() => detalhe.value?.mensagens || [])
const ultimaPergunta = computed(() => [...conversa.value].reverse().find((m) => m.tipo === 'PERGUNTA') || null)

/* ------- Deep-link: abre o chamado direto via ?chamado=<id> (ex.: clique em notificação) ------- */
watch(
  () => route.query.chamado,
  async (id) => {
    if (typeof id !== 'string' || !id) return
    try {
      abrirDetalhe(await getChamado(id))
    } catch (e) {
      ui.error(apiError(e, 'Chamado não encontrado.'))
    }
  },
  { immediate: true },
)

/* Ao fechar o modal, limpa o parâmetro da URL */
watch(detalheAberto, (aberto) => {
  if (!aberto && route.query.chamado) {
    const { chamado: _chamado, ...resto } = route.query
    void router.replace({ query: resto })
  }
})

/* ------- Histórico como linha do tempo ------- */
type TomTimeline = 'green' | 'blue' | 'purple' | 'slate' | 'red'

interface EntradaHistorico {
  horario: string | null
  texto: string
  tom: TomTimeline
}

function tomDaEntrada(texto: string): TomTimeline {
  const t = texto.toLowerCase()
  if (t.includes('resolvido') || t.includes('concluído') || t.includes('concluido')) return 'green'
  if (t.includes('status alterado') || t.includes('aceito por')) return 'blue'
  if (t.includes('respond') || t.includes('comunicado')) return 'purple'
  return 'slate'
}

const historicoEntradas = computed<EntradaHistorico[]>(() => {
  const bruto = detalhe.value?.historico || ''
  return bruto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((linha) => {
      if (linha.startsWith('[')) {
        const fecha = linha.indexOf(']')
        if (fecha > 1) {
          return {
            horario: linha.slice(1, fecha),
            texto: linha.slice(fecha + 1).trim(),
            tom: tomDaEntrada(linha),
          }
        }
      }
      // Parse tolerante: linha fora do padrão vira texto simples
      return { horario: null, texto: linha, tom: tomDaEntrada(linha) }
    })
})

const timelineRef = ref<HTMLElement | null>(null)

/* Auto-scroll para a entrada mais recente ao abrir o modal ou ao histórico mudar */
watch([detalheAberto, () => detalhe.value?.historico], async ([aberto]) => {
  if (!aberto) return
  await nextTick()
  const el = timelineRef.value
  if (el) el.scrollTop = el.scrollHeight
})

/* ==============================================================
 * SEÇÕES DO MODAL (accordion)
 *
 * O modal de detalhes carrega muita coisa: identificação, descrição,
 * atendimento, conversa, histórico e as ações da matriz. Todas abertas ao mesmo
 * tempo viram uma parede — obriga a rolar até o fim para achar a ação do
 * momento, que é justamente o que o técnico faz no celular.
 *
 * Aqui cada bloco é uma seção. Só uma fica aberta por vez (`secaoAberta`), como
 * accordion de verdade: assim a altura do modal não cresce com o chamado.
 *
 * "atendimento" é a que nasce aberta, porque é onde o técnico trabalha e onde a
 * escola confere. As outras nascem fechadas, com contador no título para dar
 * para saber que existe conteúdo lá dentro sem precisar abrir.
 * ============================================================== */
type SecaoChamado = 'identificacao' | 'atendimento' | 'conversa' | 'historico' | 'matriz' | 'escola'

/**
 * A seção aberta. O tipo é `SecaoChamado | ''` porque o accordion fecha quando
 * se toca na seção que já está aberta — como em qualquer accordion, só uma
 * fica de pé por vez.
 */
const secaoAberta = ref<SecaoChamado | ''>('atendimento')

function alternarSecao(s: SecaoChamado) {
  secaoAberta.value = secaoAberta.value === s ? '' : s
}

/**
 * Registrar e concluir são ações do MESMO lugar: o técnico anota o serviço e
 * encerra em sequência, várias vezes no mesmo chamado. Na tela anterior eram
 * dois blocos empilhados com dois "abrir" — e com o rascunho do registro ainda
 * aberto, dava para mandar a conclusão por cima dele.
 *
 * Aqui quem decide o que está aberto é o modal inteiro: `registroAberto` e
 * `conclusaoAberta` são exclusivos, e abrir um fecha o outro.
 */
function alternarRegistro() {
  registroAberto.value = !registroAberto.value
  if (registroAberto.value) {
    conclusaoAberta.value = false
    textoConclusao.value = ''
    anexosConclusao.value = []
  } else {
    textoAtividade.value = ''
    anexosAtividade.value = []
  }
  secaoAberta.value = 'atendimento'
}

function alternarConclusao() {
  conclusaoAberta.value = !conclusaoAberta.value
  if (conclusaoAberta.value) {
    registroAberto.value = false
    textoAtividade.value = ''
    anexosAtividade.value = []
    textoConclusao.value = detalhe.value?.descricaoResolucao || ''
    anexosConclusao.value = []
  } else {
    textoConclusao.value = ''
    anexosConclusao.value = []
  }
  secaoAberta.value = 'atendimento'
}

/* ==============================================================
 * FLUXO DE ATENDIMENTO
 *
 *   ABERTO ──▶ ENCAMINHADO ──▶ ANDAMENTO ──▶ AGUARDANDO_CONFERENCIA ──▶ RESOLVIDO
 *     ▲                                                              (escola)
 *     └──────────────── contestação da escola (+1 reabertura) ──────────┘
 *
 * Cada etapa é um endpoint próprio do backend, com permissão e pré-condição
 * diferentes. Aqui só se espelha isso para mostrar o botão certo e explicar o
 * bloqueio — quem decide é o servidor.
 * ============================================================== */

/** `PABLO FERREIRA SOUSA` / `pablo ferreira sousa` → `PABLO FERREIRA SOUSA` */
function normalizarNome(nome?: string | null) {
  return (nome || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

/**
 * O chamado é meu? Isto é: sou eu quem ficou como responsável por ele.
 *
 * O backend resolve o responsável pelo `responsavelId` (id do usuário), mas
 * chamado encaminhado antes desse campo existir só tem o nome — aí a comparação
 * cai para o nome, que é o que `encaminharChamado` gravava.
 */
const souEuResponsavel = computed(() => {
  const c = detalhe.value
  if (!c) return false
  if (c.responsavelId && auth.user?.id) return c.responsavelId === auth.user.id
  return !!c.responsavel && normalizarNome(c.responsavel) === normalizarNome(auth.user?.nome)
})

/** Status em que o técnico ainda precisa assumir o chamado. */
const AGUARDANDO_ACEITE: StatusChamado[] = ['ABERTO', 'ENCAMINHADO']

/** Status em que o técnico já assumiu neste ciclo — libera registrar e concluir. */
const COM_TECNICO_ACEITO: StatusChamado[] = ['ANDAMENTO', 'COMUNICADO', 'AGUARDANDO_CONFERENCIA']

/**
 * Quem mexe no fluxo: o responsável pelo chamado e a matriz.
 *
 * O ADMIN entra porque é o nível mais alto do sistema e atende chamado de
 * unidade que ninguém aceitou — mas continua sendo "Aceitar", com o nome de
 * quem aceitou gravado no histórico.
 */
const souDaMatriz = computed(() => ehMatriz.value && (auth.user?.nivel === 'ADMIN' || souEuResponsavel.value))

/** Chão de uma requisição do fluxo — desabilita os botões enquanto ela corre. */
const acaoFluxo = ref(false)

/** Botão "Aceitar": só faz sentido para quem tem o chamado e ele não foi aceito. */
const podeAceitar = computed(
  () =>
    !acaoFluxo.value &&
    souDaMatriz.value &&
    !!detalhe.value &&
    AGUARDANDO_ACEITE.includes(detalhe.value.status),
)

/**
 * Registrar o que foi feito: depois do aceite e antes da conferência.
 *
 * Sai de AGUARDANDO_CONFERENCIA de propósito — contestada, a escola joga o
 * chamado para ABERTO e o técnico precisa aceitar de novo antes de refazer.
 */
const podeRegistrar = computed(
  () =>
    !acaoFluxo.value &&
    souDaMatriz.value &&
    !!detalhe.value &&
    COM_TECNICO_ACEITO.includes(detalhe.value.status) &&
    detalhe.value.status !== 'AGUARDANDO_CONFERENCIA',
)

/** Concluir entrega o serviço para a escola conferir — as duas andam juntas. */
const podeConcluir = computed(() => podeRegistrar.value)

/** A escola só age quando o técnico terminou e passou o serviço para conferência. */
const podeConferir = computed(
  () => !acaoFluxo.value && ehEscola.value && detalhe.value?.status === 'AGUARDANDO_CONFERENCIA',
)

/* ---- Registro do que foi feito ---- */
const registroAberto = ref(false)
const textoAtividade = ref('')
const anexosAtividade = ref<AnexoMensagemPayload[]>([])

/* ---- Conclusão do técnico ---- */
const conclusaoAberta = ref(false)
const textoConclusao = ref('')
const anexosConclusao = ref<AnexoMensagemPayload[]>([])

/* ---- Conferência da escola ---- */
const conferenciaAberta = ref(false)
const textoConferencia = ref('')
const anexosConferencia = ref<AnexoMensagemPayload[]>([])
/** Qual dos dois botões da conferência foi clicado. */
const modalidadeConferencia = ref<'aprovado' | 'contestar'>('aprovado')

/** Abre o formulário de registro, ou o fecha se já estiver aberto. */
function abrirRegistro() {
  alternarRegistro()
}

async function salvarRegistro() {
  if (!detalhe.value || acaoFluxo.value) return
  const texto = textoAtividade.value.trim()
  if (!texto) {
    ui.error('Descreva o que foi feito.')
    return
  }
  acaoFluxo.value = true
  try {
    const atividade = await registrarAtividade(detalhe.value.id, { texto, anexos: anexosAtividade.value })
    // A lista do modal é a fonte da linha nova: não precisa recarregar tudo.
    detalhe.value = { ...detalhe.value, atividades: [...(detalhe.value.atividades || []), atividade] }
    registroAberto.value = false
    textoAtividade.value = ''
    anexosAtividade.value = []
    ui.success('Registro adicionado ao atendimento.')
  } catch (e) {
    ui.error(apiError(e, 'Falha ao registrar o atendimento.'))
  } finally {
    acaoFluxo.value = false
  }
}

/** Abre o formulário de conclusão, ou o fecha se já estiver aberto. */
function abrirConclusao() {
  alternarConclusao()
}

async function salvarConclusao() {
  if (!detalhe.value || acaoFluxo.value) return
  const texto = textoConclusao.value.trim()
  if (!texto) {
    ui.error('Registre o que foi feito — é isso que a escola vai conferir.')
    return
  }
  acaoFluxo.value = true
  try {
    const atualizado = await concluirChamado(detalhe.value.id, { texto, anexos: anexosConclusao.value })
    detalhe.value = atualizado
    novoStatus.value = atualizado.status
    conclusaoAberta.value = false
    anexosConclusao.value = []
    ui.success('Atendimento concluído. A escola foi avisada para conferir.')
    await Promise.all([carregar(), carregarStats()])
  } catch (e) {
    ui.error(apiError(e, 'Falha ao concluir o atendimento.'))
  } finally {
    acaoFluxo.value = false
  }
}

function abrirConferencia(modalidade: 'aprovado' | 'contestar') {
  modalidadeConferencia.value = modalidade
  conferenciaAberta.value = true
  textoConferencia.value = ''
  anexosConferencia.value = []
}

async function salvarConferencia() {
  if (!detalhe.value || acaoFluxo.value) return
  const texto = textoConferencia.value.trim()
  const contestando = modalidadeConferencia.value === 'contestar'
  if (contestando && !texto) {
    ui.error('Registre o que ficou faltando para o técnico refazer.')
    return
  }
  acaoFluxo.value = true
  try {
    const atualizado = await conferirChamado(detalhe.value.id, {
      aprovado: !contestando,
      texto: texto || undefined,
      anexos: anexosConferencia.value,
    })
    detalhe.value = atualizado
    novoStatus.value = atualizado.status
    conferenciaAberta.value = false
    anexosConferencia.value = []
    ui.success(
      contestando
        ? `Chamado reaberto (${atualizado.reaberturas ?? 1}x). Administrador e técnico foram avisados.`
        : 'Chamado concluído. O técnico foi avisado.',
    )
    await Promise.all([carregar(), carregarStats()])
  } catch (e) {
    ui.error(apiError(e, contestando ? 'Falha ao reabrir o chamado.' : 'Falha ao concluir o chamado.'))
  } finally {
    acaoFluxo.value = false
  }
}

/**
 * A única ação que cabe a QUEM está olhando este chamado agora.
 *
 * Antes havia um botão de aceitar e outro de concluir no topo do modal, cada um
 * com a sua condição, e uma caixa "Atendimento" mais abaixo repetindo os dois —
 * dava para ver três botões do mesmo passo numa tela. Aqui a barra de ação do
 * topo é a fonte da verdade: mostra o que fazer agora, ou nada quando não é a
 * vez desta pessoa.
 *
 * A ordem importa e é o fluxo: aceitar → registrar → concluir → conferir.
 */
const acaoDoMomento = computed<{
  titulo: string
  dica?: string
  rotulo: string
  classe: string
  tom: 'blue' | 'green' | 'purple' | 'yellow'
  icone: Component
  acao: () => void
} | null>(() => {
  const c = detalhe.value
  if (!c) return null

  /*
   // Escola: a bola está com ela para confirmar o serviço (ou reabrir).
   *
   * O botão NÃO abre o formulário de aprovação: a conferência tem duas
   * respostas possíveis e a escolha entre elas é da escola — contestar é um
   * caminho normal, não uma exceção. Abrir direto em "Confirmar e encerrar"
   * esconderia o botão de contestar, que é justamente o que o chamado precisa
   * oferecer. Aqui a barra só leva a escola até a decisão, que fica logo abaixo
   * dos registros.
   */
  if (podeConferir.value) {
    return {
      titulo: 'Confira o atendimento',
      dica: `A equipe concluiu em ${c.concluidoEm ? formatDateTime(c.concluidoEm) : '—'}. Confira os registros abaixo e diga se ficou tudo certo.`,
      rotulo: 'Ver a decisão',
      classe: 'btn-verde',
      tom: 'purple',
      icone: ClipboardPen,
      acao: () => {
        secaoAberta.value = 'atendimento'
        // Espera a seção abrir para rolar até os dois botões, senão o scroll
        // acontece antes do conteúdo existir.
        void nextTick(() => {
          document.querySelector('.conferencia-botoes')?.scrollIntoView({ block: 'center' })
        })
      },
    }
  }

  // Escola com pergunta da matriz em aberto.
  if (ehEscola.value && c.status === 'COMUNICADO') {
    return {
      titulo: 'A equipe precisa de um retorno',
      dica: 'Responda a pergunta para o atendimento continuar.',
      rotulo: 'Ver a pergunta',
      classe: 'btn-verde',
      tom: 'purple',
      icone: MessageCircle,
      acao: () => {
        secaoAberta.value = 'escola'
        void nextTick(() => {
          document.querySelector('.acao-pergunta')?.scrollIntoView({ block: 'center' })
        })
      },
    }
  }

  // Técnico/matriz: ainda precisa assumir o chamado.
  if (podeAceitar.value) {
    return {
      titulo: 'Este chamado é seu',
      dica: c.responsavel
        ? `Encaminhado para ${c.responsavel}. Aceite para assumir o atendimento.`
        : 'Aceite para assumir o atendimento.',
      rotulo: 'Aceitar chamado',
      classe: 'btn-aceitar',
      tom: 'blue',
      icone: CheckCheck,
      acao: () => void aceitarMeuChamado(),
    }
  }

  // Técnico/matriz com o chamado assumido e ainda não entregue à escola.
  if (podeRegistrar.value) {
    const temRegistro = atividades.value.some((a) => a.tipo === 'REGISTRO')
    return {
      titulo: 'Chamado em suas mãos',
      dica: temRegistro
        ? 'Pode registrar mais uma visita ou concluir quando terminar.'
        : 'Registre o que você fez. Pode registrar quantas vezes quiser.',
      rotulo: 'Registrar o que foi feito',
      classe: 'btn-aceitar',
      tom: 'blue',
      icone: ClipboardPen,
      acao: () => {
        secaoAberta.value = 'atendimento'
        if (!registroAberto.value && !conclusaoAberta.value) alternarRegistro()
      },
    }
  }

  // Sem responsável, ninguém pode aceitar: quem olha precisa encaminhar primeiro.
  if (souDaMatriz.value && !c.responsavel && !c.aceitoEm) {
    return {
      titulo: 'Falta um responsável',
      dica: 'Este chamado não tem técnico. Encaminhe para um poder aceitar.',
      rotulo: 'Encaminhar para técnico',
      classe: 'btn-ambar',
      tom: 'yellow',
      icone: UserPlus,
      acao: () => {
        secaoAberta.value = 'matriz'
        void abrirEncaminhar(c)
      },
    }
  }

  return null
})

async function aceitarMeuChamado() {
  if (!detalhe.value || acaoFluxo.value) return
  acaoFluxo.value = true
  try {
    const atualizado = await aceitarChamado(detalhe.value.id)
    detalhe.value = atualizado
    novoStatus.value = atualizado.status
    ui.success('Chamado aceito! O horário ficou registrado.')
  } catch (e) {
    ui.error(apiError(e, 'Não foi possível aceitar o chamado.'))
  } finally {
    acaoFluxo.value = false
  }
}

/* ---- Lista de registros de atendimento ---- */
const atividades = computed<ChamadoAtividade[]>(() => detalhe.value?.atividades || [])

/**
 * Cor de cada tipo de registro na linha do tempo.
 *
 * Distingue "o technician avançou" (azul), "a bola está com a escola" (roxo) e
 * "fechou" (verde) — que é a informação que se procura na lista. A contestação
 * fica vermelha porque é a única linha que significa retrabalho.
 */
const TOM_ATIVIDADE: Record<TipoAtividade, TomTimeline> = {
  REGISTRO: 'blue',
  CONCLUSAO: 'purple',
  CONTESTACAO: 'red',
  APROVACAO: 'green',
}

async function salvarStatus() {
  if (!detalhe.value) return
  // Matriz: ao colocar em "Aguardando resposta", a pergunta é obrigatória
  if (ehMatriz.value && novoStatus.value === 'COMUNICADO' && detalhe.value.status !== 'COMUNICADO' && !perguntaEscola.value.trim()) {
    ui.error('Escreva a pergunta/solicitação para o solicitante antes de salvar.')
    return
  }
  salvando.value = true
  try {
    const atualizado = await atualizarStatusChamado(detalhe.value.id, {
      status: novoStatus.value,
      descricaoResolucao: descricaoResolucao.value || undefined,
      ...(novoStatus.value === 'COMUNICADO' && perguntaEscola.value.trim()
        ? { pergunta: perguntaEscola.value.trim(), perguntaAnexos: anexosPergunta.value }
        : {}),
    })
    detalhe.value = atualizado
    novoStatus.value = atualizado.status
    perguntaEscola.value = ''
    anexosPergunta.value = []
    ui.success(`Chamado ${atualizado.protocolo} atualizado para "${rotuloStatusChamado(atualizado.status)}".`)
    await Promise.all([carregar(), carregarStats()])
  } catch (e) {
    ui.error(apiError(e, 'Falha ao atualizar o status.'))
  } finally {
    salvando.value = false
  }
}

async function enviarResposta() {
  if (!detalhe.value || !textoResposta.value.trim()) return
  salvando.value = true
  try {
    const atualizado = await responderChamado(detalhe.value.id, { texto: textoResposta.value.trim() })
    detalhe.value = atualizado
    textoResposta.value = ''
    ui.success('Comentário registrado no histórico.')
  } catch (e) {
    ui.error(apiError(e, 'Falha ao registrar resposta.'))
  } finally {
    salvando.value = false
  }
}

/* Escola responde à pergunta da matriz — status volta para "Em atendimento" automaticamente */
async function responderAoChamado() {
  if (!detalhe.value || !respostaEscola.value.trim()) return
  salvando.value = true
  try {
    const atualizado = await responderChamado(detalhe.value.id, {
      texto: respostaEscola.value.trim(),
      anexos: anexosResposta.value,
    })
    detalhe.value = atualizado
    novoStatus.value = atualizado.status
    respostaEscola.value = ''
    anexosResposta.value = []
    responderAberto.value = false
    ui.success('Resposta enviada para a equipe.')
    await Promise.all([carregar(), carregarStats()])
  } catch (e) {
    ui.error(apiError(e, 'Falha ao enviar a resposta.'))
  } finally {
    salvando.value = false
  }
}

/* Toque na célula de descrição expande/recolhe o texto completo (mobile não tem tooltip) */
const descExpandida = ref<string | null>(null)

function alternarDescricao(id: string) {
  descExpandida.value = descExpandida.value === id ? null : id
}

async function excluirChamado(c: Chamado) {
  if (!window.confirm(`Excluir o chamado #${c.protocolo}? Essa ação não pode ser desfeita.`)) return
  try {
    await deletarChamado(c.id)
    ui.success(`Chamado ${c.protocolo} excluído.`)
    await Promise.all([carregar(), carregarStats()])
  } catch (e) {
    ui.error(apiError(e, 'Não foi possível excluir o chamado.'))
  }
}

onMounted(() => {
  void carregar()
  void carregarStats()
  void carregarOpcoesFiltro()
})

/* Atualização automática: chamados novos/mudanças de status chegam sozinhos. */
useAutoRefresh(async () => {
  await Promise.all([carregar(true), carregarStats()])
}, AUTO_REFRESH_MS.rapido)
</script>

<template>
  <div class="chamados-page">
    <!-- KPIs -->
    <div class="stats-grid">
      <StatCard label="Total de chamados" :value="stats?.total ?? '…'" tone="blue"><ClipboardList :size="22" /></StatCard>
      <StatCard label="Abertos" :value="stats?.abertos ?? '…'" tone="red"><AlertTriangle :size="22" /></StatCard>
      <StatCard label="Em atendimento" :value="stats?.andamento ?? '…'" tone="yellow"><Clock :size="22" /></StatCard>
      <StatCard
        label="Aguardando resposta"
        :value="stats?.comunicado ?? '…'"
        detail="respondidos, aguardam retorno da unidade"
        tone="purple"
      ><School :size="22" /></StatCard>
      <StatCard label="Concluídos" :value="stats?.resolvidos ?? '…'" tone="green"><CheckCircle2 :size="22" /></StatCard>
      <StatCard label="Aguardando conferência" :value="stats?.aguardandoConferencia ?? '…'" tone="purple">
        <ClipboardPen :size="22" />
      </StatCard>
    </div>

    <!-- Chips de filtro rápido -->
    <div class="chips">
      <div class="chips-grupo">
        <button
          v-for="chip in STATUS_CHIPS"
          :key="chip.rotulo"
          class="chip"
          :class="{ ativo: filtros.status === chip.valor }"
          type="button"
          @click="chipStatus(chip.valor)"
        >
          {{ chip.rotulo }}
        </button>
      </div>
      <span class="chips-divisor" />
      <div class="chips-grupo">
        <button
          class="chip"
          :class="{ ativo: filtros.urgencia === 'Alta' }"
          type="button"
          @click="alternarUrgentes"
        >
          Só urgentes
        </button>
        <button
          v-if="!auth.temEscopoTipos || categoriaVisivel('sistemas')"
          class="chip"
          :class="{ ativo: filtros.categoria === 'PortalNet' }"
          type="button"
          @click="alternarPortalNet"
        >
          PortalNet
        </button>
      </div>
    </div>

    <!-- Filtros -->
    <div class="toolbar card">
      <div class="search-box">
        <Search :size="16" />
        <input
          v-model="filtros.unidade"
          placeholder="Filtrar por unidade escolar..."
          @keyup.enter="aplicarFiltros"
        />
      </div>
      <select v-model="filtros.status" class="select-input slim" @change="aplicarFiltros">
        <option value="">Status: Todos</option>
        <option v-for="s in STATUS_FLUXO" :key="s" :value="s">{{ rotuloStatusChamado(s) }}</option>
      </select>
      <select v-model="filtros.urgencia" class="select-input slim" @change="aplicarFiltros">
        <option value="">Urgência: Todas</option>
        <option value="Alta">Alta</option>
        <option value="Média">Média</option>
        <option value="Baixa">Baixa</option>
      </select>
      <select
        :value="filtros.categoriaChave"
        class="select-input slim"
        @change="aplicarCategoria(($event.target as HTMLSelectElement).value)"
      >
        <option value="">Categoria: Todas</option>
        <option v-for="c in opcoesCategoria" :key="c.id" :value="c.chave">{{ c.nome }}</option>
        <!-- O que não se encaixa em NENHUMA categoria do formulário: quase
             todo o histórico anterior a ele ter virado dinâmico. -->
        <option :value="CATEGORIA_SEM_CHAVE">Fora das categorias</option>
      </select>
      <select v-model="filtros.responsavel" class="select-input slim" @change="aplicarFiltros">
        <option value="">Técnico: Todos</option>
        <option v-for="t in tecnicosFiltro" :key="t" :value="t">{{ t }}</option>
      </select>
      <button class="btn btn-primary" type="button" @click="aplicarFiltros">Filtrar</button>
      <a class="btn btn-gold" href="/chamado/novo" target="_blank" rel="noopener">
        Abrir chamado
      </a>
    </div>

    <!-- Barra de ação em lote (só ADMIN/TECNICO) -->
    <div v-if="podeLote" class="lote card" :class="{ ativa: selecionados.size > 0 }">
      <span>{{ selecionados.size ? `${selecionados.size} chamado(s) selecionado(s)` : 'Marque os chamados para agir em lote' }}</span>
      <div class="lote-acoes">
        <select v-model="loteStatus" class="select-input slim" :disabled="selecionados.size === 0">
          <option value="" disabled>Alterar status para...</option>
          <option value="ABERTO">Aberto</option>
          <option value="ANDAMENTO">Em atendimento</option>
          <option value="COMUNICADO">Aguardando resposta</option>
          <option value="RESOLVIDO">Concluído</option>
        </select>
        <button
          class="btn btn-primary"
          type="button"
          :disabled="selecionados.size === 0 || !loteStatus"
          @click="aplicarEmLote"
        >
          <Layers :size="15" />
          Aplicar em lote
        </button>
      </div>
    </div>

    <p v-if="estado.erro" class="erro card">{{ estado.erro }}</p>

    <!-- Tabela -->
    <div class="card table-card">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th v-if="podeLote" class="th-check">
                <input type="checkbox" :checked="todosMarcados" @change="alternarTodos" />
              </th>
              <th>Protocolo</th>
              <th>Data</th>
              <th>Unidade Escolar</th>
              <th>Equipamento / Tipo</th>
              <th>Descrição</th>
              <th>Status</th>
              <th class="th-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="estado.loading">
              <td :colspan="podeLote ? 8 : 7" class="td-center">Carregando...</td>
            </tr>
            <tr v-else-if="estado.items.length === 0">
              <td :colspan="podeLote ? 8 : 7" class="td-center">Nenhum chamado encontrado.</td>
            </tr>
            <tr v-for="c in estado.items" :key="c.id" :class="{ selecionado: selecionados.has(c.id) }">
              <td v-if="podeLote" class="td-check">
                <input type="checkbox" :checked="selecionados.has(c.id)" @change="alternar(c.id)" />
              </td>
              <td class="nowrap"><strong>#{{ c.protocolo }}</strong></td>
              <td class="nowrap">{{ formatDate(c.timestamp) }}</td>
              <td>{{ c.unidade }}</td>
              <td>{{ c.tipo }}</td>
              <td
                class="desc-cell"
                :class="{ expandida: descExpandida === c.id }"
                :title="c.descricao"
                @click="alternarDescricao(c.id)"
              >{{ c.descricao }}</td>
              <td><StatusPill :status="rotuloStatusChamado(c.status)" /></td>
              <td class="td-acoes">
                <div class="acoes-linha">
                  <!-- Ação rápida do técnico: botão grande e visível, pensado para o celular -->
                  <button
                    v-if="podeAceitarNaLinha(c)"
                    class="btn-acao btn-aceitar"
                    type="button"
                    :disabled="acaoRapidaEmAndamento === c.id"
                    @click="aceitarChamadoRapido(c)"
                  >
                    <Loader2 v-if="acaoRapidaEmAndamento === c.id" class="spin" :size="15" />
                    <Check v-else :size="15" />
                    Aceitar
                  </button>
                  <button
                    v-else-if="podeConcluirNaLinha(c)"
                    class="btn-acao btn-concluir"
                    type="button"
                    :disabled="acaoRapidaEmAndamento === c.id"
                    @click="concluirChamadoTecnico(c)"
                  >
                    <Loader2 v-if="acaoRapidaEmAndamento === c.id" class="spin" :size="15" />
                    <CheckCheck v-else :size="15" />
                    Concluir
                  </button>
                  <RowActions
                    :itens="[
                      { rotulo: 'Ver detalhes', acao: () => abrirDetalhe(c) },
                      ...(ehMatriz
                        ? [
                            { rotulo: 'Encaminhar para técnico', icone: UserPlus, acao: () => abrirEncaminhar(c) },
                            { rotulo: 'Excluir', perigo: true, acao: () => excluirChamado(c) },
                          ]
                        : []),
                    ]"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <PaginationBar
        :page="estado.page"
        :page-size="PAGE_SIZE"
        :total="estado.total"
        @change="(p) => { estado.page = p; void carregar() }"
      />
    </div>

    <!-- Modal detalhe -->
    <BaseModal
      :aberto="detalheAberto"
      :titulo="detalhe ? `Chamado #${detalhe.protocolo}` : 'Chamado'"
      @fechar="detalheAberto = false"
    >
      <div v-if="detalhe" class="detalhe">
        <!--
             Cabeçalho: o que se responde com uma olhada, antes de qualquer
             clique. Protocolo e status já estão no título do modal — aqui ficam
             unidade, quem pediu e quem é o técnico.
        -->
        <div class="detalhe-cabecalho">
          <div class="detalhe-cabecalho-linha">
            <StatusPill :status="rotuloStatusChamado(detalhe.status)" />
            <span v-if="detalhe.reaberturas" class="reabertura-tag">
              <RotateCcw :size="12" /> reaberto {{ detalhe.reaberturas }}x
            </span>
          </div>
          <p class="detalhe-unidade">{{ detalhe.unidade }}</p>
          <p class="detalhe-solicitante">
            {{ detalhe.solicitante }}<template v-if="detalhe.funcao"> · {{ detalhe.funcao }}</template>
            <template v-if="detalhe.responsavel"> · técnico {{ detalhe.responsavel }}</template>
          </p>
        </div>

        <!--
             Barra de ação: fica ACIMA das seções e sempre visível, respondendo a
             pergunta "o que eu faço agora com este chamado?". Quem não tem nada
             a fazer não vê botão nenhum, em vez de um botão esmaecido que só
             explica que não pode.
        -->
        <div v-if="acaoDoMomento" class="acao-tecnico" :class="`acao-${acaoDoMomento.tom}`">
          <p class="acao-tecnico-titulo">{{ acaoDoMomento.titulo }}</p>
          <p v-if="acaoDoMomento.dica" class="acao-tecnico-info">{{ acaoDoMomento.dica }}</p>
          <button
            class="btn-acao btn-acao-grande"
            :class="acaoDoMomento.classe"
            type="button"
            :disabled="acaoFluxo || acaoRapidaEmAndamento === detalhe.id"
            @click="acaoDoMomento.acao()"
          >
            <Loader2 v-if="acaoFluxo || acaoRapidaEmAndamento === detalhe.id" class="spin" :size="20" />
            <component :is="acaoDoMomento.icone" v-else :size="20" />
            {{ acaoDoMomento.rotulo }}
          </button>
        </div>

        <!--
             DADOS DO CHAMADO: identificação e descrição. Nasce fechada por
             padrão — quem abriu o chamado já sabe do que se trata (está na
             lista), e o que interessa na tela é a ação.
        -->
        <BaseAccordion
          class="secao"
          titulo="Chamado"
          tom="slate"
          :contador="detalhe.urgencia === 'Alta' ? 'urgente' : null"
          :aberto="secaoAberta === 'identificacao'"
          @alternar="alternarSecao('identificacao')"
        >
          <template #icone><FileText :size="16" /></template>

        <dl class="detalhe-grid">
          <div><dt>Unidade</dt><dd>{{ detalhe.unidade }}</dd></div>
          <div class="full">
            <dt>E-mails da escola</dt>
            <dd>
              <div v-if="emailsUnidadeFormatados.length" class="emails-escola">
                <div v-for="(e, i) in emailsUnidadeFormatados" :key="i" class="email-item">
                  <Mail :size="14" class="email-icone" />
                  <span class="email-texto">{{ e.email }}</span>
                  <button class="btn-copy" type="button" title="Copiar e-mail" @click="copiarTexto(e.email)">
                    <Copy :size="14" />
                  </button>
                </div>
              </div>
              <span v-else>—</span>
            </dd>
          </div>
          <div><dt>Solicitante</dt><dd>{{ detalhe.solicitante }}</dd></div>
          <div><dt>Cargo / Função</dt><dd>{{ detalhe.funcao || '—' }}</dd></div>
          <div><dt>E-mail do solicitante</dt><dd class="quebra-email">{{ detalhe.email || '—' }}</dd></div>
          <div><dt>Tipo</dt><dd>{{ detalhe.tipo }}</dd></div>
          <div><dt>Urgência</dt><dd>{{ detalhe.urgencia }}</dd></div>
          <div><dt>Responsável</dt><dd>{{ detalhe.responsavel || '—' }}</dd></div>
          <div><dt>Status atual</dt><dd><StatusPill :status="rotuloStatusChamado(detalhe.status)" /></dd></div>
          <div v-if="detalhe.aceitoEm"><dt>Aceito em</dt><dd>{{ formatDateTime(detalhe.aceitoEm) }}</dd></div>
          <div v-if="detalhe.concluidoEm"><dt>Concluído em</dt><dd>{{ formatDateTime(detalhe.concluidoEm) }}</dd></div>
        </dl>

        <div class="descricao-box">
          <h4><FileText :size="15" /> Descrição</h4>
          <template v-if="portalNetCampos">
            <div class="portal-net-campos">
              <div class="portal-campo" v-for="(valor, chave) in portalNetCampos" :key="chave">
                <div class="portal-campo-label">{{ chave }}</div>
                <div class="portal-campo-valor">
                  <span class="portal-campo-texto">{{ valor }}</span>
                  <button
                    v-if="podeCopiarPortalNet(chave)"
                    class="btn-copy"
                    type="button"
                    :title="`Copiar ${chave}`"
                    @click="copiarTexto(valor)"
                  >
                    <Copy :size="14" />
                  </button>
                </div>
              </div>
            </div>
            <div v-if="portalNetExtras.length" class="descricao-linhas descricao-extra">
              <p v-for="(trecho, i) in portalNetExtras" :key="i">{{ trecho }}</p>
            </div>
          </template>
          <div v-else-if="descricaoLinhas.length" class="descricao-linhas">
            <p v-for="(linha, i) in descricaoLinhas" :key="i">{{ linha }}</p>
          </div>
          <p v-else>{{ detalhe.descricao }}</p>
        </div>

        </BaseAccordion>

        <!--
             ATENDIMENTO: onde o técnico trabalha e onde a escola confere. Nasce
             aberta de propósito — é a seção que se abre todo dia, e o resto do
             modal vira detalhe sob demanda.
        -->
        <!--
             Histórico do chamado: o rastro em TEXTO, com o horário que o
             backend gravou dentro da frase. É complementar à linha do tempo de
             `atividades` (lá o horário é coluna, não texto), então fica numa
             seção própria — é o registro de auditoria, não o atendimento.
        -->
        <BaseAccordion
          class="secao"
          titulo="Histórico"
          tom="slate"
          :contador="historicoEntradas.length || null"
          :aberto="secaoAberta === 'historico'"
          @alternar="alternarSecao('historico')"
        >
          <template #icone><History :size="16" /></template>
          <div class="timeline">
            <div v-for="(entrada, i) in historicoEntradas" :key="i" class="timeline-item">
              <span class="timeline-dot" :class="`dot-${entrada.tom}`" />
              <span v-if="entrada.horario" class="timeline-hora">{{ entrada.horario }}</span>
              <p class="timeline-texto">{{ entrada.texto }}</p>
            </div>
          </div>
        </BaseAccordion>

        <!--
             Perguntas e respostas entre matriz e escola (anexos temporários, 7
             dias). Só aparece quando existe conversa.
        -->
        <BaseAccordion
          v-if="conversa.length"
          class="secao"
          titulo="Perguntas e respostas"
          tom="purple"
          :contador="conversa.length"
          :aberto="secaoAberta === 'conversa'"
          @alternar="alternarSecao('conversa')"
        >
          <template #icone><MessageSquare :size="16" /></template>
          <div class="msgs">
            <div v-for="m in conversa" :key="m.id" class="msg" :class="m.tipo === 'PERGUNTA' ? 'msg-pergunta' : 'msg-resposta'">
              <span class="msg-meta">
                <strong>{{ m.tipo === 'PERGUNTA' ? 'Pergunta da matriz' : 'Resposta do solicitante' }}</strong>
                · {{ m.autorNome }} · {{ formatDateTime(m.createdAt) }}
              </span>
              <p class="msg-texto">{{ m.texto }}</p>
              <div v-if="m.anexos?.length" class="msg-anexos">
                <a v-for="a in m.anexos" :key="a.id" :href="a.url" target="_blank" rel="noopener" class="msg-anexo">
                  <Paperclip :size="13" /> {{ a.nome }}
                </a>
              </div>
            </div>
          </div>
        </BaseAccordion>

        <BaseAccordion
          class="secao"
          titulo="Atendimento"
          tom="blue"
          :contador="atividades.length || null"
          :aberto="secaoAberta === 'atendimento'"
          @alternar="alternarSecao('atendimento')"
        >
          <template #icone><Wrench :size="16" /></template>

          <!-- Trilha do fluxo: onde este chamado parou, num relance. -->
          <div class="fluxo-passos">
            <span class="passo" :class="{ feito: detalhe.aceitoEm, atual: podeAceitar }">
              <CheckCheck :size="13" /> Aceito
            </span>
            <span class="passo-seta">→</span>
            <span class="passo" :class="{ feito: atividades.some((a) => a.tipo === 'REGISTRO'), atual: podeRegistrar }">
              <ClipboardPen :size="13" /> Registro
            </span>
            <span class="passo-seta">→</span>
            <span class="passo" :class="{ feito: detalhe.concluidoEm, atual: podeConcluir }">
              <Send :size="13" /> Concluído
            </span>
            <span class="passo-seta">→</span>
            <span
              class="passo"
              :class="{ feito: detalhe.conferidoEm, atual: detalhe.status === 'AGUARDANDO_CONFERENCIA' }"
            >
              <School :size="13" /> Conferência
            </span>
          </div>

          <!--
               Linha do tempo do ATENDIMENTO: o que o técnico registrou a cada
               visita, a conclusão, a contestação da escola e a aprovação final.
               Vem de `atividades` (tabela com `criadoEm` do servidor), não do
               `historico` em texto — os horários aqui são reais, não inferidos
               por regex.
          -->
          <div v-if="atividades.length" class="timeline">
            <div v-for="a in atividades" :key="a.id" class="timeline-item">
              <span class="timeline-dot" :class="`dot-${TOM_ATIVIDADE[a.tipo]}`" />
              <span class="timeline-hora">{{ formatDateTime(a.criadoEm) }}</span>
              <p class="timeline-texto">
                <strong>{{ ROTULO_TIPO_ATIVIDADE[a.tipo] }}</strong> — {{ a.autorNome }}
              </p>
              <p class="timeline-corpo">{{ a.texto }}</p>
              <div v-if="a.anexos?.length" class="msg-anexos">
                <a v-for="an in a.anexos" :key="an.id" :href="an.url" target="_blank" rel="noopener" class="msg-anexo">
                  <Paperclip :size="13" /> {{ an.nome }}
                </a>
              </div>
            </div>
          </div>
          <p v-else class="secao-vazia">
            Nenhum registro ainda. O técnico anota aqui o que fez em cada visita.
          </p>

        <!--
               Marcos com horário: respondem de cara às perguntas que se faz de
               um chamado ("aceito quando?", "quem confirmou que terminou?").

               O nome vai guardado em campo separado e é null em chamado aceito
               antes do campo existir — daí o teste, senão a tela mostra a
               palavra "null" ao lado da data.
          -->
          <div class="marcos">
            <div class="marco">
              <dt>Aceito</dt>
              <dd>
                <template v-if="detalhe.aceitoEm">
                  {{ formatDateTime(detalhe.aceitoEm) }}<template v-if="detalhe.aceitoPor"> · {{ detalhe.aceitoPor }}</template>
                </template>
                <template v-else>—</template>
              </dd>
            </div>
            <div class="marco">
              <dt>Concluído pelo técnico</dt>
              <dd>{{ detalhe.concluidoEm ? formatDateTime(detalhe.concluidoEm) : '—' }}</dd>
            </div>
            <div class="marco">
              <dt>Conferido pela escola</dt>
              <dd>
                <template v-if="detalhe.conferidoEm">
                  {{ formatDateTime(detalhe.conferidoEm) }}<template v-if="detalhe.conferidoPor"> · {{ detalhe.conferidoPor }}</template>
                </template>
                <template v-else>—</template>
              </dd>
            </div>
          </div>


          <!--
               Registrar o que foi feito. Fica dentro da seção "Atendimento" (e não
               em "Ações da matriz") porque é o trabalho do dia a dia do técnico,
               não uma correção.
          -->
          <div v-if="podeRegistrar" class="acao-box acao-fluxo">
            <h4><ClipboardPen :size="15" /> Registrar o serviço</h4>
            <p class="acao-dica">
              Registre cada etapa do serviço. Pode repetir quantas vezes quiser — cada registro guarda
              data e hora.
            </p>
            <button v-if="!registroAberto" class="btn btn-outline btn-largo" type="button" @click="abrirRegistro">
              <Paperclip :size="15" />
              Registrar o que foi feito
            </button>
            <template v-else>
              <textarea
                v-model="textoAtividade"
                class="input textarea"
                placeholder="Ex.: troquei o cabo de rede da sala 3 e o sinal normalizou."
              />
              <label class="anexo-label">
                <Paperclip :size="14" /> Fotos (opcional — ficam guardadas como prova do serviço)
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  class="anexo-input"
                  @change="(e) => onAnexosChange(e, anexosAtividade)"
                />
              </label>
              <ul v-if="anexosAtividade.length" class="anexo-lista">
                <li v-for="(a, i) in anexosAtividade" :key="i">
                  <Paperclip :size="13" /> {{ a.nome }}
                  <button type="button" class="anexo-remover" title="Remover anexo" @click="anexosAtividade.splice(i, 1)">
                    <X :size="13" />
                  </button>
                </li>
              </ul>
              <div class="acao-linha">
                <button class="btn btn-primary" type="button" :disabled="acaoFluxo || !textoAtividade.trim()" @click="salvarRegistro">
                  Salvar registro
                </button>
                <button class="btn btn-outline" type="button" :disabled="acaoFluxo" @click="registroAberto = false">
                  Cancelar
                </button>
              </div>
            </template>
          </div>

          <!--
               Concluir entrega o serviço para a escola conferir: quem encerra o
               chamado é a unidade, não o técnico.
          -->
          <div v-if="podeConcluir" class="acao-box acao-fluxo">
            <h4><CheckCircle2 :size="15" /> Concluir atendimento</h4>
            <p class="acao-dica">
              Terminou? Escreva o que foi feito — é este texto que a escola lê para conferir.
            </p>
            <button v-if="!conclusaoAberta" class="btn btn-primary btn-largo" type="button" @click="abrirConclusao">
              <CheckCircle2 :size="15" />
              Concluir atendimento
            </button>
            <template v-else>
              <textarea
                v-model="textoConclusao"
                class="input textarea"
                placeholder="O que foi feito de verdade? A escola lê este texto para conferir."
              />
              <label class="anexo-label">
                <Paperclip :size="14" /> Fotos (opcional)
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  class="anexo-input"
                  @change="(e) => onAnexosChange(e, anexosConclusao)"
                />
              </label>
              <ul v-if="anexosConclusao.length" class="anexo-lista">
                <li v-for="(a, i) in anexosConclusao" :key="i">
                  <Paperclip :size="13" /> {{ a.nome }}
                  <button type="button" class="anexo-remover" title="Remover anexo" @click="anexosConclusao.splice(i, 1)">
                    <X :size="13" />
                  </button>
                </li>
              </ul>
              <div class="acao-linha">
                <button class="btn btn-primary" type="button" :disabled="acaoFluxo || !textoConclusao.trim()" @click="salvarConclusao">
                  Enviar para conferência
                </button>
                <button class="btn btn-outline" type="button" :disabled="acaoFluxo" @click="conclusaoAberta = false">
                  Cancelar
                </button>
              </div>
            </template>
          </div>

          <p v-if="detalhe.status === 'AGUARDANDO_CONFERENCIA'" class="acao-dica">
            Aguardando a <strong>escola</strong> conferir o serviço. Ela pode confirmar ou reabrir o
            chamado.
          </p>

          <!--
               Conferência da escola: os dois botões ficam aqui, dentro da seção
               "Atendimento", porque a escola não pode decidir antes de ler o que
               o técnico registrou — e o registro fica logo acima.
          -->
          <div v-if="ehEscola && podeConferir" class="acao-box acao-conferencia">
            <h4><ClipboardPen :size="15" /> Conferência do atendimento</h4>
            <p class="acao-dica">
              A equipe concluiu o serviço em
              <strong>{{ detalhe.concluidoEm ? formatDateTime(detalhe.concluidoEm) : '—' }}</strong>.
              Confira os registros acima e diga se ficou tudo certo.
            </p>

            <div v-if="!conferenciaAberta" class="conferencia-botoes">
              <button class="btn btn-primary btn-largo" type="button" :disabled="acaoFluxo" @click="abrirConferencia('aprovado')">
                <ThumbsUp :size="15" />
                Ficou tudo certo
              </button>
              <button class="btn btn-perigo btn-largo" type="button" :disabled="acaoFluxo" @click="abrirConferencia('contestar')">
                <ThumbsDown :size="15" />
                Ficou faltando
              </button>
            </div>

            <template v-else>
              <label class="ava-label" for="texto-conferencia">
                <template v-if="modalidadeConferencia === 'aprovado'">
                  Comentário <span class="ava-opcional">opcional</span>
                </template>
                <template v-else>O que ficou faltando <span class="ava-obrigatorio">obrigatório</span></template>
              </label>
              <textarea
                id="texto-conferencia"
                v-model="textoConferencia"
                class="input textarea"
                :placeholder="
                  modalidadeConferencia === 'aprovado'
                    ? 'Tudo certo por aqui, obrigado.'
                    : 'Ex.: a impressora continua sem imprimir, só ligou e piscou.'
                "
              />
              <label class="anexo-label">
                <Paperclip :size="14" /> Fotos (opcional — comprovam o que ficou faltando)
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  class="anexo-input"
                  @change="(e) => onAnexosChange(e, anexosConferencia)"
                />
              </label>
              <ul v-if="anexosConferencia.length" class="anexo-lista">
                <li v-for="(a, i) in anexosConferencia" :key="i">
                  <Paperclip :size="13" /> {{ a.nome }}
                  <button type="button" class="anexo-remover" title="Remover anexo" @click="anexosConferencia.splice(i, 1)">
                    <X :size="13" />
                  </button>
                </li>
              </ul>
              <div class="acao-linha">
                <button
                  class="btn btn-primary btn-largo"
                  type="button"
                  :disabled="acaoFluxo || (modalidadeConferencia === 'contestar' && !textoConferencia.trim())"
                  @click="salvarConferencia"
                >
                  <Loader2 v-if="acaoFluxo" class="spin" :size="15" />
                  <template v-else-if="modalidadeConferencia === 'aprovado'">Confirmar e encerrar</template>
                  <template v-else>Reabrir chamado</template>
                </button>
                <button class="btn btn-outline" type="button" :disabled="acaoFluxo" @click="conferenciaAberta = false">
                  Cancelar
                </button>
              </div>
              <p v-if="modalidadeConferencia === 'contestar'" class="acao-dica enc-aviso">
                Ao reabrir, o chamado volta para a fila e o <strong>administrador</strong> e o
                <strong>técnico responsável</strong> recebem um aviso.
              </p>
            </template>
          </div>
          </BaseAccordion>

        <!--
             Ações em exceção da matriz (ADMIN/TECNICO): encaminhar, corrigir
             status, comentar. Fora da seção "Atendimento" de propósito — quem
             trabalha no chamado não deveria ter que rolar até aqui para registrar
             o serviço.
        -->
        <BaseAccordion
          class="secao"
          titulo="Ações da matriz"
          tom="yellow"
          :aberto="secaoAberta === 'matriz'"
          @alternar="alternarSecao('matriz')"
        >
          <template #icone><Settings :size="16" /></template>

          <template v-if="ehMatriz">
            <!-- Encaminhar para técnico: categoria errada na abertura, equipamento,
                 ou qualquer chamado que precise chegar a um técnico específico. -->
            <div class="acao-box acao-encaminhar">
            <h4><Wrench :size="15" /> Encaminhar para técnico</h4>
            <div v-if="!encaminharAberto" class="acao-linha">
              <p class="acao-dica">
                <template v-if="detalhe.responsavel">
                  Este chamado está com <strong>{{ detalhe.responsavel }}</strong> como responsável.
                </template>
                <template v-else>Ainda sem responsável técnico.</template>
              </p>
              <button class="btn btn-outline" type="button" @click="abrirEncaminhar(detalhe)">
                <UserPlus :size="15" />
                {{ detalhe.responsavel ? 'Reencaminhar' : 'Encaminhar' }}
              </button>
            </div>

            <template v-else>
              <div class="acao-linha">
                <select v-model="encDestino" class="select-input" :disabled="carregandoTecnicos">
                  <option value="UNIDADE">{{ rotuloTecnicoDaUnidade }}</option>
                  <optgroup v-for="grupo in gruposTecnicos" :key="grupo.nome" :label="grupo.nome">
                    <option v-for="o in grupo.opcoes" :key="o.valor" :value="o.valor">{{ o.rotulo }}</option>
                  </optgroup>
                </select>
                <button
                  class="btn btn-primary"
                  type="button"
                  :disabled="!podeEncaminhar"
                  @click="confirmarEncaminhar"
                >
                  <UserPlus :size="15" />
                  Encaminhar
                </button>
                <button
                  class="btn btn-outline"
                  type="button"
                  :disabled="encaminhando"
                  @click="encaminharAberto = false"
                >
                  Cancelar
                </button>
              </div>
              <input
                v-model="encObservacao"
                class="input"
                maxlength="500"
                placeholder="Observação (opcional) — fica registrada no histórico"
              />
              <p v-if="carregandoTecnicos" class="acao-dica">Carregando técnicos...</p>
              <p v-else-if="!tecnicosDaUnidade.length" class="acao-dica enc-aviso">
                Nenhum técnico ativo atendendo {{ detalhe.unidade }} está cadastrado — escolha um técnico na lista.
              </p>
              <p v-else-if="!unidadeNaLista && equipeReduzida" class="acao-dica enc-aviso">
                Este chamado não é atendido pelo técnico de {{ detalhe.unidade }}: o responsável
                sai de <strong>JESSICA, MATHEUS, PABLO, FERNANDA e FABIO</strong>.
              </p>
              <p v-else-if="detalhe.responsavel" class="acao-dica enc-aviso">
                Ao encaminhar, <strong>{{ detalhe.responsavel }}</strong> deixa de ser o responsável.
              </p>
            </template>
          </div>


          <div class="acao-box">
            <h4><RefreshCcw :size="15" /> Alterar status</h4>
            <div class="acao-linha">
              <select v-model="novoStatus" class="select-input">
                <option v-for="s in STATUS_FLUXO" :key="s" :value="s">{{ rotuloStatusChamado(s) }}</option>
              </select>
              <button class="btn btn-primary" type="button" :disabled="salvando" @click="salvarStatus">
                Salvar
              </button>
            </div>
            <p class="acao-dica">
              Correção para casos fora do fluxo (erro de encaminhamento, chamado encerrado por
              decisão da matriz). O caminho normal é o botão da barra de ação acima.
            </p>

            <!-- Ao pedir retorno da escola, a pergunta (e os anexos) vão junto -->
            <template v-if="novoStatus === 'COMUNICADO'">
              <textarea
                v-model="perguntaEscola"
                class="input textarea"
                placeholder="O que você precisa que a escola informe ou faça?"
              />
              <label class="anexo-label">
                <Paperclip :size="14" /> Anexar arquivos (opcional — ficam disponíveis por 7 dias)
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  class="anexo-input"
                  @change="(e) => onAnexosChange(e, anexosPergunta)"
                />
              </label>
              <ul v-if="anexosPergunta.length" class="anexo-lista">
                <li v-for="(a, i) in anexosPergunta" :key="i">
                  <Paperclip :size="13" /> {{ a.nome }}
                  <button type="button" class="anexo-remover" title="Remover anexo" @click="anexosPergunta.splice(i, 1)">
                    <X :size="13" />
                  </button>
                </li>
              </ul>
            </template>

            <textarea
              v-if="novoStatus === 'AGUARDANDO_CONFERENCIA'"
              v-model="descricaoResolucao"
              class="input textarea"
              placeholder="Descreva a conclusão (obrigatório informar o que foi feito)"
            />
          </div>

          <div class="acao-box">
            <h4><Send :size="15" /> Adicionar comentário ao histórico</h4>
            <div class="acao-linha">
              <input v-model="textoResposta" class="input" placeholder="Escreva uma atualização..." />
              <button class="btn btn-outline" type="button" :disabled="salvando || !textoResposta.trim()" @click="enviarResposta">
                Registrar
              </button>
            </div>
          </div>
          </template>
        </BaseAccordion>

        <!--
             Ações da ESCOLA (GESTOR/VISUALIZADOR) que não são a conferência: o
             aviso de que a equipe está com o chamado e o formulário de resposta
             à pergunta da matriz. A conferência em si mora na seção
             "Atendimento", porque a escola precisa ler os registros antes de
             decidir.

             `v-if` e não `v-else-if`: o `v-if` da matriz está dentro do accordion
             dela, e um `v-else-if` aqui procuraria um irmão com `v-if` — que não
             existe, porque o irmão é o próprio accordion. Os dois perfis são
             mutuamente exclusivos de qualquer forma.
        -->
        <BaseAccordion
          v-if="ehEscola && detalhe.status !== 'RESOLVIDO'"
          class="secao"
          titulo="Ações da escola"
          tom="purple"
          :aberto="secaoAberta === 'escola'"
          @alternar="alternarSecao('escola')"
        >
          <template #icone><School :size="16" /></template>

        <template>
          <!-- Enquanto a equipe trabalha não há nada a fazer aqui: dizer isso
               explicitamente evita a impressão de que a tela quebrou. -->
          <div v-if="!podeConferir && detalhe.status !== 'COMUNICADO'" class="acao-box acao-aguardando">
            <h4><Clock :size="15" /> Aguardando a equipe</h4>
            <p class="acao-dica">
              <template v-if="detalhe.responsavel">
                O técnico <strong>{{ detalhe.responsavel }}</strong> está com o chamado
                ({{ rotuloStatusChamado(detalhe.status) }}).
              </template>
              <template v-else>O chamado está na fila da equipe.</template>
            </p>
          </div>

          <div v-if="detalhe.status === 'COMUNICADO'" class="acao-box acao-pergunta">
            <h4><MessageCircle :size="15" /> Pergunta da matriz</h4>
            <p class="pergunta-texto">{{ ultimaPergunta?.texto || 'A equipe aguarda um retorno da sua unidade.' }}</p>
            <div v-if="ultimaPergunta?.anexos?.length" class="msg-anexos">
              <a v-for="a in ultimaPergunta.anexos" :key="a.id" :href="a.url" target="_blank" rel="noopener" class="msg-anexo">
                <Paperclip :size="13" /> {{ a.nome }}
              </a>
            </div>

            <button v-if="!responderAberto" class="btn btn-primary" type="button" @click="responderAberto = true">
              Responder chamado
            </button>
            <template v-else>
              <textarea
                v-model="respostaEscola"
                class="input textarea"
                placeholder="Escreva a Resposta do solicitante..."
              />
              <label class="anexo-label">
                <Paperclip :size="14" /> Anexar arquivos (opcional — ficam disponíveis por 7 dias)
                <input type="file" multiple accept="image/*,.pdf" class="anexo-input" @change="(e) => onAnexosChange(e, anexosResposta)" />
              </label>
              <ul v-if="anexosResposta.length" class="anexo-lista">
                <li v-for="(a, i) in anexosResposta" :key="i">
                  <Paperclip :size="13" /> {{ a.nome }}
                  <button type="button" class="anexo-remover" title="Remover anexo" @click="anexosResposta.splice(i, 1)"><X :size="13" /></button>
                </li>
              </ul>
              <div class="acao-linha">
                <button class="btn btn-primary" type="button" :disabled="salvando || !respostaEscola.trim()" @click="responderAoChamado">
                  Enviar resposta
                </button>
                <button class="btn btn-outline" type="button" :disabled="salvando" @click="responderAberto = false">
                  Cancelar
                </button>
              </div>
            </template>
          </div>

        </template>
        </BaseAccordion>

        <!-- ===== Avaliação do atendimento (escola, chamado concluído) ===== -->
        <template v-if="ehEscola && detalhe.status === 'RESOLVIDO'">
          <!-- Enviada agora, nesta sessão. Vem ANTES de `detalhe.avaliacao`
               porque o envio também escreve o campo local: com a ordem
               invertida, o cartão de agradecimento nunca apareceria. -->
          <div v-if="avaliacaoEnviada" class="acao-box ava-box ava-agradecimento">
            <div class="ava-topo">
              <span class="ava-icone"><Heart :size="20" /></span>
              <div>
                <h4>Obrigado pela sua avaliação!</h4>
                <p>Seu retorno ajuda a equipe a melhorar o atendimento às escolas.</p>
              </div>
            </div>
            <div class="ava-estrelas readonly" :aria-label="`Nota ${avaliacaoEnviada} de 5`">
              <Star
                v-for="i in 5"
                :key="i"
                :size="26"
                :fill="i <= avaliacaoEnviada ? '#f5b921' : 'none'"
                :color="i <= avaliacaoEnviada ? '#f5b921' : '#cbd5e1'"
              />
            </div>
          </div>

          <!-- Já avaliado antes (sessão anterior ou pela tela de consulta) -->
          <div v-else-if="detalhe.avaliacao" class="acao-box ava-box ava-ja">
            <div class="ava-topo">
              <span class="ava-icone"><Star :size="20" /></span>
              <div>
                <h4>Sua avaliação</h4>
                <p>
                  Você já avaliou este atendimento. Obrigado — a equipe usa o
                  comentário para melhorar o serviço.
                </p>
              </div>
            </div>
            <div class="ava-estrelas readonly" :aria-label="`Nota ${detalhe.avaliacao.nota} de 5`">
              <Star
                v-for="i in 5"
                :key="i"
                :size="26"
                :fill="i <= detalhe.avaliacao.nota ? '#f5b921' : 'none'"
                :color="i <= detalhe.avaliacao.nota ? '#f5b921' : '#cbd5e1'"
              />
            </div>
            <p v-if="detalhe.avaliacao.comentario" class="ava-comentario">
              "{{ detalhe.avaliacao.comentario }}"
            </p>
          </div>

          <!-- Formulário: o bloco mais chamativo do modal, é a ação principal
               que sobra para a escola depois de concluir o chamado. -->
          <div v-else-if="podeAvaliar && eDonoDoChamado" class="acao-box ava-box ava-form">
            <div class="ava-topo">
              <span class="ava-icone"><Star :size="20" /></span>
              <div>
                <h4>Avalie o atendimento</h4>
                <p>
                  Este chamado foi concluído. Conte como foi o atendimento da
                  nossa equipe — leva menos de um minuto e ajuda a melhorar.
                </p>
              </div>
            </div>
            <div class="ava-estrelas" role="radiogroup" aria-label="Nota de 1 a 5 estrelas">
              <button
                v-for="i in 5"
                :key="i"
                type="button"
                class="ava-estrela"
                :aria-label="`${i} ${i === 1 ? 'estrela' : 'estrelas'}`"
                @click="nota = i"
                @mouseenter="notaHover = i"
                @mouseleave="notaHover = 0"
              >
                <Star
                  :size="34"
                  :fill="i <= notaExibida ? '#f5b921' : 'none'"
                  :color="i <= notaExibida ? '#f5b921' : '#cbd5e1'"
                />
              </button>
              <span v-if="nota > 0" class="ava-nome">{{ NOMES_NOTA[nota] }}</span>
            </div>
            <label class="ava-label" for="comentario-avaliacao-painel">
              Comentário <span class="ava-opcional">opcional</span>
            </label>
            <textarea
              id="comentario-avaliacao-painel"
              v-model="comentarioAvaliacao"
              class="input textarea"
              rows="3"
              placeholder="Conte como foi o atendimento (opcional)..."
            ></textarea>
            <p v-if="erroAvaliacao" class="ava-erro">{{ erroAvaliacao }}</p>
            <div class="acao-linha">
              <button
                class="btn btn-primary ava-btn"
                type="button"
                :disabled="enviandoAvaliacao || nota < 1"
                @click="enviarAvaliacao"
              >
                <Loader2 v-if="enviandoAvaliacao" class="spin" :size="16" />
                <Send v-else :size="16" />
                {{ enviandoAvaliacao ? 'Enviando...' : 'Enviar avaliação' }}
              </button>
              <span v-if="nota < 1" class="acao-dica">Escolha uma nota para enviar.</span>
            </div>
          </div>

          <!-- Concluído por outra conta: só o solicitante avalia -->
          <div v-else-if="podeAvaliar" class="acao-box ava-box ava-avisada">
            <div class="ava-topo">
              <span class="ava-icone ava-icone-info"><Star :size="20" /></span>
              <div>
                <h4>Avaliação</h4>
                <p>
                  Este chamado foi aberto com outro e-mail, então só quem abriu
                  pode avaliá-lo. Se preferir, use a tela de consulta com o
                  e-mail da abertura.
                </p>
              </div>
            </div>
          </div>
        </template>
      </div>
    </BaseModal>
  </div>
</template>

<style scoped>
.chamados-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ---------- Avaliação do atendimento (escola) ---------- */

/*
 * Cartão próprio, mais encorpado que os outros `.acao-box` do modal. Depois de
 * concluir o chamado, avaliar é a ÚNICA ação que sobra para a escola — se o
 * bloco se misturar às caixas de pergunta e encaminhamento, passa batido.
 */
.ava-box {
  padding: 18px 18px 20px;
  border-radius: var(--radius-md, 10px);
  border: 1.5px solid var(--brand-gold);
  background: linear-gradient(180deg, var(--brand-gold-soft) 0%, #fff 55%);
}

.ava-topo {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.ava-icone {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--brand-gold);
  color: #fff;
  flex-shrink: 0;
}

.ava-icone-info {
  background: var(--text-muted);
}

.ava-box h4 {
  font-size: 15.5px;
  font-weight: 700;
  margin: 2px 0 3px;
  color: var(--text-primary);
}

.ava-box .ava-topo p {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--text-secondary);
}

.ava-estrelas {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 16px 0 6px;
}

.ava-estrelas.readonly {
  margin: 12px 0 4px;
  padding-left: 2px;
}

.ava-estrela {
  background: none;
  border: none;
  padding: 3px;
  cursor: pointer;
  line-height: 0;
  border-radius: var(--radius-sm);
  transition: transform 0.12s ease;
}

.ava-estrela:hover {
  transform: scale(1.15);
}

.ava-estrela:focus-visible {
  outline: 2px solid var(--brand-gold);
  outline-offset: 2px;
}

/* Nome da nota ao lado das estrelas — confirma o que a pessoa marcou. */
.ava-nome {
  margin-left: 8px;
  font-size: 14px;
  font-weight: 700;
  color: var(--brand-gold);
}

.ava-label {
  display: block;
  margin-top: 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.ava-opcional {
  font-weight: 400;
  font-size: 12px;
  color: var(--text-muted);
}

.ava-comentario {
  margin: 12px 0 0;
  padding: 11px 13px;
  border-left: 3px solid var(--brand-gold);
  background: rgb(255 255 255 / 0.75);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--text-secondary);
  font-style: italic;
}

.ava-erro {
  margin: 9px 0 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--red);
}

.ava-btn {
  font-weight: 600;
}

/* Já avaliado: acalma o cartão, não precisa competir com nada. */
.ava-agradecimento,
.ava-ja {
  border-color: var(--green);
  background: var(--green-soft);
}

.ava-agradecimento .ava-icone {
  background: var(--green);
}

/* Não é a dona: aviso, não convite. */
.ava-avisada {
  border: 1.5px dashed var(--border);
  background: var(--bg-subtle, #f8fafc);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 170px), 1fr));
  gap: 14px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  flex-wrap: wrap;
}

.search-box {
  flex: 1;
  min-width: 220px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  padding: 0 12px;
  color: var(--text-muted);
}

.search-box input {
  flex: 1;
  border: none;
  outline: none;
  padding: 10px 0;
  background: transparent;
  color: var(--text-primary);
}

.select-input.slim {
  width: auto;
  min-width: 160px;
}

.erro {
  padding: 14px 18px;
  color: var(--red);
  font-weight: 500;
}

.nowrap {
  white-space: nowrap;
}

.th-check,
.td-check {
  width: 36px;
  text-align: center;
}

.td-check input,
.th-check input {
  width: 15px;
  height: 15px;
  accent-color: var(--sidebar-bg);
  cursor: pointer;
}

tr.selecionado td {
  background: var(--blue-soft);
}

.lote {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  color: var(--text-muted);
  font-size: 13px;
  flex-wrap: wrap;
}

.lote.ativa {
  border-color: var(--blue);
  color: var(--text-primary);
}

.lote-acoes {
  display: flex;
  align-items: center;
  gap: 10px;
}

.lote-acoes .select-input {
  width: auto;
}

.desc-cell {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Toque na célula mostra o texto completo (útil no mobile, onde não há tooltip) */
.desc-cell.expandida {
  white-space: normal;
}

.td-center {
  text-align: center;
  color: var(--text-muted);
  padding: 28px !important;
}

.th-acoes,
.td-acoes {
  width: 60px;
  text-align: center;
}

.detalhe {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/*
 * Cabeçalho do modal: o resumo que dispensa abrir qualquer seção. Fica colado
 * no topo de propósito — com a barra de ação logo abaixo, quem abre o chamado
 * no celular vê "o que é" e "o que eu faço" sem rolar uma linha.
 */
.detalhe-cabecalho {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detalhe-cabecalho-linha {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.detalhe-unidade {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.detalhe-solicitante {
  margin: 0;
  font-size: 12.5px;
  color: var(--text-secondary);
}

/* Espaçamento entre a seção e a barra de ação, sem abrir um cartão novo. */
.secao + .secao,
.secao + .acao-tecnico {
  margin-top: 2px;
}

.detalhe-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 20px;
  margin: 0;
}

.detalhe-grid dt {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 2px;
}

.detalhe-grid dd {
  margin: 0;
  font-size: 13.5px;
  color: var(--text-primary);
}

.quebra-email {
  word-break: break-all;
}

.emails-escola {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.email-item {
  font-size: 13.5px;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
}

.email-icone {
  color: var(--text-muted);
  flex-shrink: 0;
}

.email-texto {
  min-width: 0;
  word-break: break-all;
}

.btn-copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
  padding: 0;
}

.btn-copy:hover {
  background: var(--blue);
  color: white;
  border-color: var(--blue);
}

.btn-copy:active {
  transform: scale(0.95);
}

/* PortalNet campos */
.portal-net-campos {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px 0;
}

.portal-campo {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.portal-campo-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.portal-campo-valor {
  display: flex;
  align-items: center;
  gap: 8px;
}

.portal-campo-texto {
  font-size: 13.5px;
  color: var(--text-primary);
  word-break: break-all;
  flex: 1;
}

.portal-campo .btn-copy {
  margin-left: 4px;
}

/* Seções do modal em cartões separados: descrição, histórico, ações e conversa
   ficam visualmente distintas (antes era tudo na mesma coluna, sem borda nem
   fundo, e o modal parecia um bloco só). */
.descricao-box,
.acao-box {
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
}

.descricao-box h4,
.acao-box h4 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-primary);
  padding-bottom: 8px;
  margin: 0 0 10px;
  border-bottom: 1px solid var(--border);
}

.descricao-box p {
  margin: 0;
  font-size: 13.5px;
  color: var(--text-secondary);
  white-space: pre-wrap;
}

/* Descrição comum: cada trecho (separado por \n ou |) vira uma linha. */
.descricao-linhas {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Trecho livre que sobrou do parse PortalNet (descrição adicional). */
.descricao-extra {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--border-strong);
}

/* ---------- Chips de filtro rápido ---------- */
.chips {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.chips-grupo {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.chips-divisor {
  width: 1px;
  height: 22px;
  background: var(--border-strong);
}

.chip {
  padding: 7px 14px;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 600;
  background: var(--slate-soft);
  color: var(--text-secondary);
  transition:
    background 0.12s ease,
    color 0.12s ease;
}

.chip:hover {
  background: var(--border-strong);
}

.chip.ativo {
  background: var(--sidebar-bg);
  color: #fff;
}

/* ---------- Histórico como linha do tempo ---------- */
.timeline {
  max-height: 260px;
  overflow-y: auto;
  padding: 4px 2px;
}

.timeline-item {
  position: relative;
  margin-left: 6px;
  padding: 0 0 16px 24px;
  border-left: 2px solid var(--border);
}

.timeline-item:last-child {
  padding-bottom: 4px;
  border-left-color: transparent;
}

.timeline-dot {
  position: absolute;
  left: -6px;
  top: 3px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot-green {
  background: var(--green);
  box-shadow: 0 0 0 3px var(--green-soft);
}

.dot-blue {
  background: var(--blue);
  box-shadow: 0 0 0 3px var(--blue-soft);
}

.dot-purple {
  background: var(--purple);
  box-shadow: 0 0 0 3px var(--purple-soft);
}

.dot-slate {
  background: var(--slate);
  box-shadow: 0 0 0 3px var(--slate-soft);
}

/* Contestação da escola: a única linha da timeline que significa retrabalho. */
.dot-red {
  background: var(--red);
  box-shadow: 0 0 0 3px var(--red-soft);
}

.timeline-hora {
  display: block;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--text-primary);
}

.timeline-texto {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
  white-space: pre-wrap;
}

/** O texto do registro em si, abaixo do cabeçalho "tipo — autor". */
.timeline-corpo {
  margin: 4px 0 0;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--text-primary);
  white-space: pre-wrap;
}

/* Etiqueta de reabertura no título "Atendimento". */
.reabertura-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 20px;
  background: var(--red-soft);
  color: var(--red);
  font-size: 11px;
  font-weight: 700;
}

/* ---------- Marcos do fluxo (aceito / concluído / conferido) ---------- */
.marcos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 8px;
  margin-bottom: 4px;
}

.marco {
  padding: 8px 12px;
  background: var(--surface-muted);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm, 8px);
}

.marco dt {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: var(--text-secondary);
}

.marco dd {
  margin: 3px 0 0;
  font-size: 13px;
  color: var(--text-primary);
}

/* ---------- Barra do fluxo (aceitar → registrar → concluir) ---------- */
.acao-fluxo {
  border-color: var(--blue);
}

.acao-fluxo h4,
.acao-conferencia h4,
.acao-aguardando h4 {
  display: flex;
  align-items: center;
  gap: 6px;
}

.fluxo-passos {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.passo {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--surface-muted);
  font-size: 12px;
  color: var(--text-secondary);
}

/* Passo já cumprido: verde e apagado — é histórico, não ação. */
.passo.feito {
  background: var(--green-soft);
  border-color: transparent;
  color: var(--green);
}

/* Passo que é a próxima coisa a fazer: destaque forte, é o botão da vez. */
.passo.atual {
  background: var(--blue);
  border-color: transparent;
  color: #fff;
  font-weight: 700;
}

.passo-seta {
  font-size: 12px;
  color: var(--text-secondary);
}

/* ---------- Conferência da escola ---------- */
.acao-conferencia {
  border-color: var(--purple);
}

.conferencia-botoes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ava-obrigatorio {
  color: var(--red);
  font-weight: 700;
}

/* ---------- Conversa (perguntas e respostas) ---------- */
.msgs {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 300px;
  overflow-y: auto;
}

.msg {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
}

.msg-pergunta {
  background: var(--purple-soft);
  border-color: var(--purple);
}

.msg-resposta {
  background: var(--blue-soft);
  border-color: var(--blue);
}

.msg-meta {
  font-size: 11.5px;
  color: var(--text-muted);
}

.msg-meta strong {
  color: var(--text-primary);
}

.msg-texto {
  margin: 4px 0 0;
  font-size: 13.5px;
  color: var(--text-primary);
  white-space: pre-wrap;
}

.msg-anexos {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.msg-anexo {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  color: var(--blue);
  background: var(--card-bg, #fff);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  text-decoration: none;
}

.msg-anexo:hover {
  text-decoration: underline;
}

/* ---------- Upload de anexos (pergunta/resposta) ---------- */
.anexo-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
}

.anexo-input {
  display: none;
}

.anexo-lista {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.anexo-lista li {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--text-secondary);
}

.anexo-remover {
  display: inline-flex;
  border: none;
  background: transparent;
  color: var(--red, #dc2626);
  cursor: pointer;
  padding: 2px;
}

.acao-pergunta {
  border: 1px solid var(--purple);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  background: var(--purple-soft);
}

.pergunta-texto {
  margin: 0 0 10px;
  font-size: 13.5px;
  color: var(--text-primary);
  white-space: pre-wrap;
}

.acao-dica {
  font-size: 12px;
  color: var(--text-muted);
  align-self: center;
}

/* Aviso do encaminhamento (sem técnico na unidade / troca de responsável) */
.enc-aviso {
  color: var(--brand-gold);
}

.acao-linha {
  display: flex;
  gap: 10px;
}

.acao-linha .select-input {
  max-width: 220px;
}

/* Encaminhamento: select largo (nome do técnico + unidades) e empilhado */
.acao-encaminhar h4 {
  display: flex;
  align-items: center;
  gap: 6px;
}

.acao-encaminhar .acao-linha {
  flex-wrap: wrap;
}

.acao-encaminhar .select-input {
  flex: 1;
  min-width: 220px;
  max-width: none;
}

.acao-encaminhar .input {
  margin-top: 10px;
}

.textarea {
  margin-top: 10px;
  min-height: 80px;
  resize: vertical;
}

@media (max-width: 640px) {
  /* Busca ocupa a linha inteira; selects/botões quebram para a linha de baixo */
  .search-box {
    min-width: 0;
    width: 100%;
  }

  .detalhe-grid {
    grid-template-columns: 1fr;
  }

  /*
   * No celular o modal de chamado é a tela inteira, então tudo que era uma
   * linha vira uma coluna e nenhum botão fica com alvo de toque pequeno.
   */
  .detalhe {
    gap: 10px;
  }

  .detalhe-unidade {
    font-size: 14.5px;
  }

  .marcos {
    grid-template-columns: 1fr;
  }

  .conferencia-botoes {
    flex-direction: column;
  }

  .conferencia-botoes .btn {
    width: 100%;
    justify-content: center;
    min-height: 48px;
  }

  .acao-linha {
    flex-wrap: wrap;
  }

  /* Botões lado a lado num modal estreito saem da tela; empilhados, não */
  .acao-linha .btn {
    flex: 1 1 140px;
    justify-content: center;
    min-height: 46px;
  }

  /* A linha do tempo inteira: no celular, rolar dentro de dois eixos atrapalha */
  .timeline,
  .msgs {
    max-height: none;
  }

  .anexo-remover {
    padding: 6px;
  }

  .btn-copy {
    width: 34px;
    height: 34px;
  }
}

/* ---------- Ação rápida do técnico (aceitar/concluir) ---------- */

.acoes-linha {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.btn-acao {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 14px;
  border-radius: var(--radius-sm);
  font-size: 13.5px;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  transition:
    background 0.15s ease,
    transform 0.05s ease;
}

.btn-acao:active {
  transform: translateY(1px);
}

.btn-acao:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-aceitar {
  background: var(--blue);
}

.btn-aceitar:hover {
  background: #1d4ed8;
}

.btn-concluir {
  background: var(--green);
}

.btn-concluir:hover {
  background: #15803d;
}

/*
 * Barra de ação no topo do modal — a ação do momento, e só ela. Precisa ser
 * impossível de não ver no celular: botão de largura total e alvo de toque alto
 * (52px+). A borda acompanha a cor da ação para que o tom se leia antes do
 * texto (é a conferência da escola ou o aceite do técnico?).
 */
.acao-tecnico {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border-radius: var(--radius-md);
  background: var(--surface-muted);
  border: 1.5px solid var(--border);
}

.acao-tecnico.acao-blue {
  border-color: var(--blue);
  background: var(--blue-soft);
}

.acao-tecnico.acao-purple {
  border-color: var(--purple);
  background: var(--purple-soft);
}

.acao-tecnico.acao-yellow {
  border-color: var(--yellow);
  background: var(--yellow-soft);
}

.acao-tecnico.acao-green {
  border-color: var(--green);
  background: var(--green-soft);
}

/* O que está para ser feito, em destaque: é o rótulo da caixa toda. */
.acao-tecnico-titulo {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  color: var(--text-primary);
  text-align: center;
}

.acao-tecnico-info {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--text-secondary);
  text-align: center;
}

.btn-verde {
  background: var(--green);
}

.btn-verde:hover {
  background: #15803d;
}

.btn-ambar {
  background: var(--yellow);
}

.btn-ambar:hover {
  background: #b45309;
}

.btn-acao-grande {
  width: 100%;
  min-height: 52px;
  font-size: 16px;
}

/*
 * Botão que ocupa a largura do cartão dentro das seções. Mesmo alvo de toque do
 * botão grande, para as ações de dentro (registrar, concluir, conferir) não
 * ficarem menores que o cabeçalho que as contém.
 */
.btn-largo {
  width: 100%;
  justify-content: center;
  min-height: 48px;
}

/* Seção sem registro: a linha do tempo é o destaque, o vazio é o que pesa. */
.secao-vazia {
  margin: 4px 0 0;
  padding: 18px 12px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
}

.spin {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>