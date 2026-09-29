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
}

export interface LoginRequest {
  email: string
  senha: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: User
  primeiroLogin: boolean
}

export interface ChangePasswordRequest {
  senhaAtual: string
  novaSenha: string
}

/* ---------- Chamados ---------- */

export type StatusChamado = 'ABERTO' | 'ANDAMENTO' | 'COMUNICADO' | 'RESOLVIDO'

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
  numeroChamadoManutencao?: string | null
  descricaoQuebrado?: string | null
  responsavelAtual?: string | null
  observacoes?: string | null
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
