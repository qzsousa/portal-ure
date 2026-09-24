import axios from 'axios'
import { CHAMADOS_BASE, createBackendErrorInterceptor } from './http'
import type { Chamado } from '@/types'

/**
 * Endpoints PÚBLICOS do backend de chamados (sem autenticação).
 *
 * Usa axios puro — NÃO passa por `chamadosApi` (que anexa token e
 * intercepta 401). As rotas abaixo são montadas como públicas no
 * backend (ver backend/src/index.ts).
 */

const publicoHttp = axios.create({
  baseURL: CHAMADOS_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

// Mesma captura de erros de backend dos clientes autenticados (toast + log).
publicoHttp.interceptors.response.use((r) => r, createBackendErrorInterceptor('Chamados'))

/* ---------- Abertura de chamado ---------- */

export interface NovoChamadoPayload {
  unidade: string
  solicitante: string
  funcao?: string
  tipo: string
  descricao: string
  urgencia: string
  email?: string
  anexoBase64?: string
  anexoNome?: string
  anexoTipo?: string
}

export async function listarEscolasPublico(): Promise<string[]> {
  const { data } = await publicoHttp.get<string[]>('/escolas/nomes')
  return data
}

export async function listarCategoriasEquipamento(): Promise<string[]> {
  const { data } = await publicoHttp.get<string[]>('/equipamentos/categorias')
  return data
}

export async function listarMarcasEquipamento(categoria: string): Promise<string[]> {
  const { data } = await publicoHttp.get<string[]>('/equipamentos/marcas', { params: { categoria } })
  return data
}

export async function listarModelosEquipamento(categoria: string, marca: string): Promise<string[]> {
  const { data } = await publicoHttp.get<string[]>('/equipamentos/modelos', { params: { categoria, marca } })
  return data
}

/** Cria um chamado (público). Retorna o chamado completo (201), com `protocolo`. */
export async function criarChamadoPublico(payload: NovoChamadoPayload): Promise<Chamado> {
  const { data } = await publicoHttp.post<Chamado>('/chamados', payload)
  return data
}

/* ---------- Consulta por protocolo ---------- */

export interface AvaliacaoChamado {
  nota: number
  comentario: string | null
}

/** Mensagem da conversa matriz ↔ unidade (pergunta "Aguardando resposta"). */
export interface MensagemConversaAnexo {
  nome: string
  tipo: string
  url: string
  expiresAt?: string
}

export interface MensagemConversa {
  id: string
  tipo: 'PERGUNTA' | 'RESPOSTA'
  autorNome: string
  texto: string
  createdAt: string
  anexos: MensagemConversaAnexo[]
}

export interface ChamadoPublico {
  protocolo: string
  unidade: string
  solicitante: string
  tipo: string
  status: string
  descricao: string
  descricaoResolucao: string | null
  anexoUrl: string | null
  timestamp: string
  ultimaAtualizacao: string
  avaliacao?: AvaliacaoChamado | null
  /** Conversa matriz ↔ unidade (perguntas e respostas do chamado). */
  mensagens?: MensagemConversa[]
}

/** Consulta pública por protocolo. Lança AxiosError com status 404 se não existir. */
export async function consultarChamadoPorProtocolo(protocolo: string): Promise<ChamadoPublico> {
  const { data } = await publicoHttp.get<ChamadoPublico>(`/chamados/protocolo/${encodeURIComponent(protocolo)}`)
  return data
}

/* ---------- Dashboard público (matriz) ---------- */

export interface MatrizKpis {
  total: number
  abertos: number
  andamento: number
  comunicado: number
  resolvidos: number
  altaPrioridade: number
}

export interface DashboardMatriz {
  kpis: MatrizKpis
  chamados: Chamado[]
  graficos: {
    porStatus: Record<string, number>
    porUrgencia: Record<string, number>
    resolvidosPorTecnico: Record<string, number>
  }
}

export async function getDashboardMatriz(): Promise<DashboardMatriz> {
  const { data } = await publicoHttp.get<DashboardMatriz>('/dashboard/matriz')
  return data
}

/* ---------- Avaliação do atendimento (público) ---------- */

export interface AvaliacaoPayload {
  nota: number
  comentario?: string
}

/**
 * Avalia um chamado RESOLVIDO (público).
 * Lança AxiosError: 400 se o chamado não está resolvido, 409 se já foi avaliado.
 */
export async function avaliarChamadoPorProtocolo(protocolo: string, payload: AvaliacaoPayload): Promise<void> {
  await publicoHttp.post(`/chamados/protocolo/${encodeURIComponent(protocolo)}/avaliar`, payload)
}

/* ---------- Tutoriais (público, link compartilhável) ---------- */

export interface TutorialAnexoPublico {
  id: string
  nome: string
  tipo: string
  url: string
}

export interface TutorialPublico {
  id: string
  titulo: string
  subtitulo: string | null
  conteudo: string
  categoria: { id: string; nome: string; cor: string | null }
  criadoPor: string
  visualizacoes: number
  createdAt: string
  anexos: TutorialAnexoPublico[]
}

/** Lê um tutorial SEM autenticação (link público /tutorial/:id). 404 se não existir. */
export async function obterTutorialPublico(id: string): Promise<TutorialPublico> {
  const { data } = await publicoHttp.get<TutorialPublico>(`/tutoriais/publico/${encodeURIComponent(id)}`)
  return data
}

/** URL pública compartilhável de um tutorial neste portal. */
export function linkPublicoTutorial(id: string): string {
  return `${window.location.origin}/tutorial/${id}`
}

/* ---------- Elogios e sugestões (público) ---------- */

export type TipoFeedback = 'ELOGIO' | 'SUGESTAO'

export interface NovoFeedbackPayload {
  tipo: TipoFeedback
  nome?: string
  unidade?: string
  mensagem: string
}

/** Envia um elogio ou sugestão (público). */
export async function enviarFeedbackPublico(payload: NovoFeedbackPayload): Promise<void> {
  await publicoHttp.post('/feedback', payload)
}

/* ---------- Formulário dinâmico de abertura de chamado (público) ---------- */

export interface FormularioOpcaoAlerta {
  texto: string
  tipo: 'info' | 'aviso'
  /** true: exibe o alerta e BLOQUEIA a continuação do wizard. */
  encerra?: boolean
  /** true: anexo vira obrigatório na etapa final. */
  exigeAnexo?: boolean
  /** Botão de ação dentro do alerta (abre em nova aba). */
  linkRotulo?: string
  linkUrl?: string
}

export interface FormularioOpcao {
  rotulo: string
  alerta?: FormularioOpcaoAlerta
}

export type FormularioPerguntaTipo = 'OPCOES' | 'TEXTO' | 'TEXTO_LONGO'

export interface FormularioPergunta {
  id: string
  categoriaId: string
  rotulo: string
  ajuda: string | null
  tipo: FormularioPerguntaTipo
  obrigatoria: boolean
  ordem: number
  ativa: boolean
  /** Condicional: só exibe quando a pergunta referenciada... */
  dependeDePerguntaId: string | null
  /** ...tiver EXATAMENTE este rótulo de opção selecionado. */
  dependeDeOpcao: string | null
  /** [] salvo em OPCOES. */
  opcoes: FormularioOpcao[]
}

export interface FormularioCategoria {
  id: string
  chave: string
  nome: string
  descricao: string | null
  cor: string | null
  ordem: number
  ativa: boolean
  perguntas?: FormularioPergunta[]
}

/** Formulário público de abertura de chamado (categorias + perguntas). */
export async function getFormularioPublico(): Promise<FormularioCategoria[]> {
  const { data } = await publicoHttp.get<{ data: FormularioCategoria[] }>('/formulario/publico')
  return data.data
}
