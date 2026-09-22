import { chamadosApi } from './http'
import type { Paginado } from './chamados'

/**
 * Cliente da API de tutoriais (base de conhecimento) — mesmo backend de
 * chamados. Somente ADMIN cria/edita/exclui; a leitura é liberada a todos
 * os usuários autenticados.
 */

export interface TutorialCategoria {
  id: string
  nome: string
  descricao: string | null
  cor: string | null
  totalTutoriais: number
}

export interface TutorialAnexo {
  id: string
  nome: string
  tipo: string
  url: string
}

export interface Tutorial {
  id: string
  titulo: string
  subtitulo: string | null
  conteudo: string
  categoriaId: string
  categoria: { id: string; nome: string; cor: string | null }
  criadoPor: string
  visualizacoes: number
  createdAt: string
  updatedAt: string
  anexos: TutorialAnexo[]
}

export interface TutorialAnexoNovo {
  nome: string
  tipo?: string
  base64: string
}

export interface FiltrosTutorial {
  q?: string
  categoriaId?: string
  page?: number
  limit?: number
}

export async function listarTutoriais(f: FiltrosTutorial = {}): Promise<Paginado<Tutorial>> {
  const params: Record<string, string | number> = { page: f.page ?? 1, limit: f.limit ?? 12 }
  if (f.q?.trim()) params.q = f.q.trim()
  if (f.categoriaId) params.categoriaId = f.categoriaId
  const { data } = await chamadosApi.get<Paginado<Tutorial>>('/tutoriais', { params })
  return data
}

/** A leitura incrementa o contador de visualizações no backend. */
export async function obterTutorial(id: string): Promise<Tutorial> {
  const { data } = await chamadosApi.get<Tutorial>(`/tutoriais/${id}`)
  return data
}

export interface CriarTutorialPayload {
  titulo: string
  subtitulo?: string
  conteudo: string
  categoriaId: string
  anexos?: TutorialAnexoNovo[]
}

export async function criarTutorial(payload: CriarTutorialPayload): Promise<Tutorial> {
  const { data } = await chamadosApi.post<Tutorial>('/tutoriais', payload)
  return data
}

export interface AtualizarTutorialPayload {
  titulo?: string
  subtitulo?: string
  conteudo?: string
  categoriaId?: string
  anexosNovos?: TutorialAnexoNovo[]
  removerAnexoIds?: string[]
}

export async function atualizarTutorial(id: string, payload: AtualizarTutorialPayload): Promise<Tutorial> {
  const { data } = await chamadosApi.patch<Tutorial>(`/tutoriais/${id}`, payload)
  return data
}

export async function excluirTutorial(id: string): Promise<void> {
  await chamadosApi.delete(`/tutoriais/${id}`)
}

/* ---------- Categorias ---------- */

export async function listarCategoriasTutorial(): Promise<TutorialCategoria[]> {
  const { data } = await chamadosApi.get<{ data: TutorialCategoria[] }>('/tutoriais/categorias')
  return data.data
}

export interface CategoriaTutorialPayload {
  nome: string
  descricao?: string
  cor?: string
}

export async function criarCategoriaTutorial(payload: CategoriaTutorialPayload): Promise<TutorialCategoria> {
  const { data } = await chamadosApi.post<TutorialCategoria>('/tutoriais/categorias', payload)
  return data
}

export async function atualizarCategoriaTutorial(
  id: string,
  payload: Partial<CategoriaTutorialPayload>,
): Promise<TutorialCategoria> {
  const { data } = await chamadosApi.patch<TutorialCategoria>(`/tutoriais/categorias/${id}`, payload)
  return data
}

/** 409 quando a categoria ainda possui tutoriais (mensagem vem do backend). */
export async function excluirCategoriaTutorial(id: string): Promise<void> {
  await chamadosApi.delete(`/tutoriais/categorias/${id}`)
}

/* ---------- Helpers ---------- */

/** Lê um File e devolve apenas o conteúdo base64 (sem o prefixo data:...;base64,). */
export function arquivoParaBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
