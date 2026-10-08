import { chamadosApi } from './http'

/**
 * Cliente da API do formulário configurável de abertura de chamados —
 * mesmo backend de chamados. O gerenciamento (criar/editar/excluir) é
 * exclusivo de ADMIN; a tela pública consome apenas as categorias ativas.
 */

export interface FormularioOpcaoAlerta {
  texto: string
  tipo: 'info' | 'aviso'
  encerra?: boolean
  exigeAnexo?: boolean
  linkRotulo?: string
  linkUrl?: string
}

export interface FormularioOpcao {
  rotulo: string
  alerta?: FormularioOpcaoAlerta
}

export type FormularioPerguntaTipo = 'OPCOES' | 'TEXTO' | 'TEXTO_LONGO' | 'ESCOLA' | 'ARQUIVO'

/**
 * Uma condição de exibição: a pergunta aparece quando a resposta da pergunta
 * `perguntaId` for igual a `opcao`. Várias condições formam uma OU.
 */
export interface FormularioCondicao {
  perguntaId: string
  opcao: string
}

export interface FormularioPergunta {
  id: string
  categoriaId: string
  rotulo: string
  ajuda: string | null
  tipo: FormularioPerguntaTipo
  obrigatoria: boolean
  ordem: number
  ativa: boolean
  /** Condições de exibição (OU). Vazio = sempre exibir. */
  condicoes: FormularioCondicao[]
  /** Legado: par único de condição, anterior às condicionais múltiplas. Só é lido como fallback. */
  dependeDePerguntaId: string | null
  dependeDeOpcao: string | null
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
  perguntas: FormularioPergunta[]
}

/* ---------- Categorias ---------- */

/** Lista TODAS as categorias do formulário (com as perguntas embutidas). */
export async function listarCategoriasFormulario(): Promise<FormularioCategoria[]> {
  const { data } = await chamadosApi.get<{ data: FormularioCategoria[] }>('/formulario/categorias')
  return data.data
}

export interface CriarCategoriaFormularioPayload {
  chave?: string
  nome: string
  descricao?: string
  cor?: string
  ordem?: number
  ativa?: boolean
}

export async function criarCategoriaFormulario(
  payload: CriarCategoriaFormularioPayload,
): Promise<FormularioCategoria> {
  const { data } = await chamadosApi.post<{ data: FormularioCategoria }>('/formulario/categorias', payload)
  return data.data
}

export type AtualizarCategoriaFormularioPayload = Partial<CriarCategoriaFormularioPayload>

export async function atualizarCategoriaFormulario(
  id: string,
  payload: AtualizarCategoriaFormularioPayload,
): Promise<FormularioCategoria> {
  const { data } = await chamadosApi.patch<{ data: FormularioCategoria }>(
    `/formulario/categorias/${id}`,
    payload,
  )
  return data.data
}

/** ATENÇÃO: a exclusão é em cascata — apaga também as perguntas da categoria. */
export async function excluirCategoriaFormulario(id: string): Promise<void> {
  await chamadosApi.delete(`/formulario/categorias/${id}`)
}

/* ---------- Perguntas ---------- */

export interface CriarPerguntaFormularioPayload {
  categoriaId: string
  rotulo: string
  ajuda?: string
  tipo: FormularioPerguntaTipo
  obrigatoria?: boolean
  ordem?: number
  ativa?: boolean
  condicoes?: FormularioCondicao[]
  dependeDePerguntaId?: string | null
  dependeDeOpcao?: string | null
  opcoes?: FormularioOpcao[]
}

export async function criarPerguntaFormulario(
  payload: CriarPerguntaFormularioPayload,
): Promise<FormularioPergunta> {
  const { data } = await chamadosApi.post<{ data: FormularioPergunta }>('/formulario/perguntas', payload)
  return data.data
}

export type AtualizarPerguntaFormularioPayload = Partial<Omit<CriarPerguntaFormularioPayload, 'categoriaId'>>

export async function atualizarPerguntaFormulario(
  id: string,
  payload: AtualizarPerguntaFormularioPayload,
): Promise<FormularioPergunta> {
  const { data } = await chamadosApi.patch<{ data: FormularioPergunta }>(`/formulario/perguntas/${id}`, payload)
  return data.data
}

export async function excluirPerguntaFormulario(id: string): Promise<void> {
  await chamadosApi.delete(`/formulario/perguntas/${id}`)
}
