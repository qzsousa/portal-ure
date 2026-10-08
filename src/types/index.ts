/**
 * Tipos compartilhados do Portal (contratos dos dois backends).
 *
 * - Backend CHAMADOS: fonte de verdade de autenticação e usuários.
 * - Backend SCE: fonte de verdade de equipamentos.
 */

/* ---------- Autenticação / usuários (backend chamados) ---------- */

export type Nivel = 'ADMIN' | 'TECNICO' | 'GESTOR' | 'VISUALIZADOR'

/**
 * Papel no grupo de escolas irmãs (mesmo prédio). As duas compartilham o painel
 * de equipamentos no SCE, mas a FILHA tem acesso somente de visualização.
 */
export type PapelUnidade = 'MAE' | 'FILHA'

/**
 * Separador do escopo de tipos: `<chaveDaCategoria>::<rótulo da 1ª opção>`.
 * Rótulo vazio = a categoria inteira (é o caso das categorias cuja 1ª
 * pergunta não é de opções, como o "E-mail institucional").
 */
export const SEPARADOR_ESCOPO = '::'

/** Monta o valor gravado no `escopoTipos` de um usuário. */
export function montarEscopo(categoriaChave: string, rotulo?: string | null): string {
  return `${categoriaChave}${SEPARADOR_ESCOPO}${rotulo ? rotulo.trim() : ''}`
}

/**
 * Escopo de TIPOS de chamado que este usuário atende.
 *
 * `[]` (ou ausente) = SEM RESTRIÇÃO: o usuário respeita só a unidade, como
 * sempre. Preenchido, a unidade deixa de valer para CHAMADOS e o que limita é
 * o tipo — a pessoa atende todas as escolas, mas só destes chamados.
 *
 * A autorização em si é toda do servidor; o portal usa este campo só para
 * ESCONDER o que não pode ser aberto (menu de equipamentos, opções do filtro
 * de categoria), evitando oferecer atalho para algo que responderia 403.
 */
export interface User {
  id: string
  email: string
  nome: string
  nivel: Nivel
  filial: string
  /** Nome composto do grupo ("E.E. A / E.E. B"); igual a `filial` quando a unidade está sozinha. */
  grupo?: string
  papelUnidade?: PapelUnidade | null
  status?: string
  primeiroLogin?: boolean
  escopoTipos?: string[]
}

export interface LoginRequest {
  email: string
  senha: string
}

/**
 * Resposta de login/refresh.
 *
 * Não traz `refreshToken`: ele viaja num cookie `httpOnly`, que o
 * JavaScript não lê. Guardá-lo em `localStorage` (como antes) expunha uma
 * credencial de 7 dias para qualquer script da página.
 */
export interface LoginResponse {
  accessToken: string
  user: User
  primeiroLogin: boolean
}

export interface ChangePasswordRequest {
  senhaAtual: string
  novaSenha: string
}

/* ---------- Primeiro acesso (código gerado pelo ADMIN) ---------- */

/**
 * Resposta da verificação de e-mail da tela de acesso.
 *
 * `primeiroAcesso` é o único campo que muda de verdade entre os casos, e é o
 * único que a interface usa. O backend responde o mesmo objeto para e-mail
 * inexistente e para quem já tem senha, justamente para não permitir listar
 * quem usa o portal — por isso aqui não existe um "não cadastrado" separado
 * de "cadastrado".
 */
export interface VerificarEmailResponse {
  existe: boolean
  primeiroAcesso: boolean
  ativo: boolean
}

export interface ConfirmarCodigoResponse {
  /** Token de uso único (10 min) que libera a criação da senha. */
  token: string
  expiraEm: string
}

export interface DefinirSenhaPrimeiroAcessoRequest {
  token: string
  novaSenha: string
  confirmarSenha: string
}

/**
 * Código de primeiro acesso emitido pelo ADMIN.
 *
 * Não é senha: é o que autoriza a pessoa a **criar** a senha dela. O ADMIN
 * lê na tela de Usuários e repassa.
 */
export interface CodigoPrimeiroAcesso {
  codigo: string
  nome?: string
  expiraEm: string
}

/* ---------- Chamados ---------- */

/**
 * Fluxo do chamado (matriz → técnico → escola):
 *
 *   ABERTO ──encaminhar──▶ ENCAMINHADO ──aceitar──▶ ANDAMENTO
 *                                                          │
 *                                              concluir   ▼
 *                                       AGUARDANDO_CONFERENCIA
 *                                            │            │
 *                             escola confirma│            │escola contesta
 *                                            ▼            ▼
 *                                        RESOLVIDO      ABERTO (+1 reabertura)
 *
 * `COMUNICADO` é a via paralela de pergunta/resposta entre matriz e escola.
 * Espelha `StatusChamadoSchema` do backend (`shared/types/api.ts`).
 */
export type StatusChamado =
  | 'ABERTO'
  | 'ENCAMINHADO'
  | 'ANDAMENTO'
  | 'COMUNICADO'
  | 'AGUARDANDO_CONFERENCIA'
  | 'RESOLVIDO'

/** Status que ainda não são finais — base dos KPIs e do filtro "em aberto". */
export const STATUS_EM_ABERTO: StatusChamado[] = [
  'ABERTO',
  'ENCAMINHADO',
  'ANDAMENTO',
  'COMUNICADO',
  'AGUARDANDO_CONFERENCIA',
]

export function chamadoEmAberto(status: StatusChamado): boolean {
  return status !== 'RESOLVIDO'
}

/** Tipo do registro datado que fica na linha do tempo do atendimento. */
export type TipoAtividade = 'REGISTRO' | 'CONCLUSAO' | 'CONTESTACAO' | 'APROVACAO'

export const ROTULO_TIPO_ATIVIDADE: Record<TipoAtividade, string> = {
  REGISTRO: 'Registro de atendimento',
  CONCLUSAO: 'Conclusão',
  CONTESTACAO: 'Contestação da escola',
  APROVACAO: 'Conferência aprovada',
}

/** Anexo temporário de uma mensagem (expira 7 dias após o envio — o backend remove do banco/storage). */
export interface ChamadoMensagemAnexo {
  id: string
  nome: string
  tipo: string
  url: string
  expiresAt: string
  createdAt: string
}

/** Mensagem da conversa matriz ↔ escola: PERGUNTA (matriz) ou RESPOSTA (escola). */
export interface ChamadoMensagem {
  id: string
  chamadoId: string
  tipo: 'PERGUNTA' | 'RESPOSTA'
  autorNome: string
  texto: string
  createdAt: string
  anexos: ChamadoMensagemAnexo[]
}

/**
 * Anexo do registro de atendimento. Não expira como o da conversa: é a prova
 * do que foi feito no equipamento, então fica disponível para sempre.
 */
export interface ChamadoAtividadeAnexo {
  id: string
  nome: string
  tipo?: string | null
  url: string
}

/**
 * Registro datado do atendimento — o que o técnico fez, a conclusão, a
 * contestação da escola e a aprovação final. Vem em ordem cronológica e é o que
 * dá o horário real de cada passo (o `historico` em texto é só o rastro legível).
 */
export interface ChamadoAtividade {
  id: string
  tipo: TipoAtividade
  autorNome: string
  autorNivel?: string | null
  texto: string
  criadoEm: string
  anexos: ChamadoAtividadeAnexo[]
}

export interface Chamado {
  id: string
  protocolo: string
  timestamp: string
  unidade: string
  solicitante: string
  funcao?: string | null
  tipo: string
  descricao: string
  urgencia: string
  anexoUrl?: string | null
  status: StatusChamado
  responsavel?: string | null
  /** Id do usuário responsável — é o que permite avisar o técnico na reabertura. */
  responsavelId?: string | null
  ultimaAtualizacao: string
  historico?: string | null
  tecnicoResolucao?: string | null
  descricaoResolucao?: string | null
  tecnicoSetor?: string | null
  email?: string | null
  /**
   * Chave da categoria do formulário público (ex.: 'equipamento'). É o que
   * permite encaminhar o chamado para o técnico sem depender do texto de `tipo`
   * — chamado antigo vem sem a chave.
   */
  categoriaChave?: string | null
  mensagens?: ChamadoMensagem[]
  /** Quantas vezes a escola contestou e o chamado voltou para ABERTO. */
  reaberturas?: number
  /** Técnico assumiu o chamado neste ciclo. */
  aceitoEm?: string | null
  aceitoPor?: string | null
  /** Técnico registrou a conclusão (bola com a escola). */
  concluidoEm?: string | null
  /** Escola confirmou que ficou tudo certo — é o que de fato encerra o chamado. */
  conferidoEm?: string | null
  conferidoPor?: string | null
  /** Registros datados do atendimento — só no detalhe (`GET /chamados/:id`). */
  atividades?: ChamadoAtividade[]
  /**
   * Avaliação do atendimento, quando existe (só no detalhe do chamado).
   * Ausente na listagem — o backend inclui apenas em `GET /chamados/:id`.
   */
  avaliacao?: { nota: number; comentario: string | null } | null
}

/* ---------- Notificações (backend chamados) ---------- */

export interface Notificacao {
  id: string
  tipo: string
  titulo: string
  mensagem: string
  link?: string | null
  lida: boolean
  criadoEm: string
}

/* ---------- Equipamentos (backend SCE) ---------- */

export interface Equipamento {
  id: string
  unidade: string
  categoria: string
  marca: string
  modelo: string
  patrimonio?: string | null
  numeroSerie?: string | null
  status: string
  statusManutencao?: string | null
  vinculadoBlueMonitor?: string | null
  numeroChamadoManutencao?: string | null
  descricaoQuebrado?: string | null
  justificativaVerificacao?: string | null
  boletimOcorrencia?: string | null
  /** Caminho do anexo do B.O. no storage do SCE (ex.: `boletins/<uuid>-anexo.pdf`). */
  boletimOcorrenciaAnexoUrl?: string | null
  /** Especificações técnicas do equipamento. */
  sistemaOperacional?: string | null
  processador?: string | null
  memoriaRAM?: string | null
  armazenamento?: string | null
  tamanhoTela?: string | null
  responsavelAtual?: string | null
  observacoes?: string | null
  justificativaPatrimonio?: string | null
  justificativaNumeroSerie?: string | null
  dataCadastro?: string
  dataUltimaAtualizacao?: string
}

/** Resposta padrão da API do SCE: { success, data, error } */
export interface SceResponse<T> {
  success: boolean
  data: T
  error: string | null
}

/* ---------- Helpers de apresentação ---------- */

/** Rótulo exibido no portal para cada nível interno. */
export function rotuloPerfil(nivel: Nivel | undefined | null): string {
  switch (nivel) {
    case 'ADMIN':
      return 'Administrador'
    case 'TECNICO':
      return 'Técnico'
    case 'GESTOR':
      return 'Gestor'
    case 'VISUALIZADOR':
      return 'Visualizador'
    default:
      return '—'
  }
}
