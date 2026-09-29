import { chamadosApi } from './http'
import type { ModoEncaminhamento, TecnicoDestino } from './chamados'

/**
 * Regras de encaminhamento automático (somente ADMIN).
 *
 * Cada regra liga uma categoria do formulário público a um destino: o técnico
 * da própria unidade (`UNIDADE`) ou um técnico fixo (`TECNICO`). A regra vale
 * para os chamados abertos NA HORA da criação — para os que já existem sem
 * responsável, use "Aplicar agora" (ou o botão de encaminhar no modal).
 */

export interface RegraEncaminhamento {
  id: string
  categoriaChave: string
  modo: ModoEncaminhamento
  tecnicoId: string | null
  tecnicoNome: string | null
  ativa: boolean
}

/** Categoria do formulário público que pode ter regra. */
export interface CategoriaRegra {
  chave: string
  nome: string
  cor: string | null
  ordem: number
}

export interface ListaRegras {
  data: RegraEncaminhamento[]
  categorias: CategoriaRegra[]
  tecnicos: TecnicoDestino[]
}

export async function listarRegrasEncaminhamento(): Promise<ListaRegras> {
  const { data } = await chamadosApi.get<ListaRegras>('/encaminhamentos')
  return data
}

export interface SalvarRegraPayload {
  categoriaChave: string
  modo: ModoEncaminhamento
  tecnicoId?: string
  ativa: boolean
}

/** Cria a regra da categoria ou sobrescreve a existente (upsert por categoria). */
export async function salvarRegraEncaminhamento(payload: SalvarRegraPayload): Promise<RegraEncaminhamento> {
  const { data } = await chamadosApi.put<RegraEncaminhamento>('/encaminhamentos', payload)
  return data
}

/** Liga/desliga uma regra sem mexer no destino. */
export async function alternarRegraEncaminhamento(id: string, ativa: boolean): Promise<RegraEncaminhamento> {
  const { data } = await chamadosApi.patch<RegraEncaminhamento>(`/encaminhamentos/${id}`, { ativa })
  return data
}

export async function removerRegraEncaminhamento(id: string): Promise<void> {
  await chamadosApi.delete(`/encaminhamentos/${id}`)
}

export interface ResultadoAplicarPendentes {
  total: number
  encaminhados: number
  semTecnico: number
}

/** Aplica as regras ativas nos chamados abertos que ainda não têm responsável. */
export async function aplicarEncaminhamentoPendente(): Promise<ResultadoAplicarPendentes> {
  const { data } = await chamadosApi.post<ResultadoAplicarPendentes>('/encaminhamentos/aplicar')
  return data
}
