import { sceApi } from './http'
import type { AxiosResponse } from 'axios'
import type { Equipamento, SceResponse } from '@/types'

/**
 * Cliente da API do SCE (equipamentos). Usa o JWT do portal (emitido pelo
 * backend de chamados) — o SCE o valida via SSO (SSO_SECRET compartilhado).
 * Respostas seguem o padrão { success, data, error }.
 */

/** Uma linha do drilldown de modelos: categoria + marca + modelo + quantidade. */
export interface ModeloCategoria {
  categoria: string
  marca: string
  modelo: string
  qtd: number
}

export interface EquipamentosGlobalResult {
  data: Equipamento[]
  total: number
  stats: {
    porStatus: Record<string, number>
    porUnidade: Record<string, number>
    porCategoria: Record<string, number>
    /**
     * Contagem por categoria/marca/modelo. Vem no MESMO payload da página — é o
     * que o gráfico de categorias abre no clique, sem o cliente precisar baixar
     * a lista inteira (MB) só para contar. Ausente em SCE ainda não atualizado.
     */
    porModelo?: ModeloCategoria[]
  }
}

export interface EquipamentosQuery {
  limite?: number
  offset?: number
  busca?: string
  status?: string
  unidade?: string
  categoria?: string
  ordem?: 'modelo' | 'patrimonio' | 'numeroSerie' | 'unidade' | 'status'
  direcao?: 'asc' | 'desc'
}

async function unwrap<T>(promise: Promise<AxiosResponse<SceResponse<T>>>): Promise<T> {
  const { data } = await promise
  if (!data.success) throw new Error(data.error || 'Erro na API do SCE')
  return data.data
}

/** Visão global paginada (somente Matriz no SCE). */
export async function listarEquipamentosGlobal(q: EquipamentosQuery = {}): Promise<EquipamentosGlobalResult> {
  return unwrap(sceApi.get<SceResponse<EquipamentosGlobalResult>>('/equipamentos-global', { params: q }))
}

/** Todos os equipamentos ao alcance do usuário (filial ou lista de unidades do técnico). */
export async function listarEquipamentosDaFilial(): Promise<Equipamento[]> {
  return unwrap(sceApi.get<SceResponse<Equipamento[]>>('/equipamentos-da-filial'))
}

export interface UnidadeResumo {
  nome: string
  total: number
  disponiveis: number
  manutencao: number
  quebrados: number
  extraviados: number
}

/** Resumo de equipamentos por unidade escolar (somente Matriz no SCE). */
export async function listarUnidadesResumo(): Promise<UnidadeResumo[]> {
  return unwrap(sceApi.get<SceResponse<UnidadeResumo[]>>('/unidades-resumo'))
}

export interface ItemLista {
  id?: number
  categoria: string
  marca: string
  modelo: string
}

export async function listarCatalogo(): Promise<ItemLista[]> {
  return unwrap(sceApi.get<SceResponse<ItemLista[]>>('/listas-cadastro'))
}

/** Catálogo completo de categoria/marca/modelo (gerenciado ∪ o que existe nos equipamentos). */
export async function listarCatalogoCompleto(): Promise<ItemLista[]> {
  return unwrap(sceApi.get<SceResponse<ItemLista[]>>('/catalogo-equipamentos'))
}

/** Especificações técnicas devolvidas pelo SCE para um modelo. */
export interface EspecificacoesModelo {
  sistemaOperacional: string
  processador: string
  memoriaRAM: string
  armazenamento: string
  tamanhoTela: string
}

/**
 * Especificações do modelo, lidas do equipamento mais recente com aquele
 * modelo. O SCE responde em snake_case (query crua no Supabase) e com
 * `null` quando o modelo ainda não tem nenhum equipamento — por isso a
 * normalização para camelCase e para string happens aqui.
 */
export async function buscarEspecificacoesModelo(modelo: string): Promise<EspecificacoesModelo | null> {
  const bruto = await unwrap(
    sceApi.get<SceResponse<Record<string, unknown> | null>>('/especificacoes-modelo', {
      params: { modelo },
    }),
  )
  if (!bruto) return null
  const txt = (...chaves: string[]) => {
    for (const c of chaves) {
      const v = bruto[c]
      if (v !== null && v !== undefined && String(v).trim() !== '') return String(v).trim()
    }
    return ''
  }
  const spec: EspecificacoesModelo = {
    sistemaOperacional: txt('sistemaOperacional', 'sistema_operacional'),
    processador: txt('processador'),
    memoriaRAM: txt('memoriaRAM', 'memoria_ram'),
    armazenamento: txt('armazenamento'),
    tamanhoTela: txt('tamanhoTela', 'tamanho_tela'),
  }
  return Object.values(spec).some((v) => v !== '') ? spec : null
}

export interface HistoricoItem {
  campo: string
  valor_antigo: string
  valor_novo: string
  autor: string
  data: string
}

export async function historicoEquipamento(equipamentoId: string): Promise<HistoricoItem[]> {
  return unwrap(sceApi.get<SceResponse<HistoricoItem[]>>('/historico-equipamento', { params: { equipamentoId } }))
}

function baixarArquivo(nome: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

/** Exporta CSV do escopo do usuário e inicia o download. */
export async function exportarCsv(): Promise<void> {
  const { csv, fileName } = await unwrap(
    sceApi.get<SceResponse<{ csv: string; fileName: string }>>('/exportar-csv'),
  )
  baixarArquivo(fileName, new Blob([csv], { type: 'text/csv;charset=utf-8' }))
}

/** Exporta PDF do escopo do usuário e inicia o download. */
export async function exportarPdf(): Promise<void> {
  const { data } = await sceApi.post('/exportar-pdf', {}, { responseType: 'blob' })
  baixarArquivo(`sce-equipamentos-${Date.now()}.pdf`, new Blob([data], { type: 'application/pdf' }))
}

/* ---------- Escrita (criação/edição/remoção) ---------- */

export interface AnexoBoletim {
  base64: string
  mimeType: string
  fileName: string
}

export interface EquipamentoPayload {
  unidade: string
  categoria: string
  marca: string
  modelo: string
  patrimonio?: string
  justificativaPatrimonio?: string
  numeroSerie?: string
  justificativaNumeroSerie?: string
  status?: string
  statusManutencao?: string
  vinculadoBlueMonitor?: string
  numeroChamadoManutencao?: string
  descricaoQuebrado?: string
  justificativaVerificacao?: string
  boletimOcorrencia?: string
  sistemaOperacional?: string
  processador?: string
  memoriaRAM?: string
  armazenamento?: string
  tamanhoTela?: string
  responsavelAtual?: string
  observacoes?: string
  _anexoBoletim?: AnexoBoletim
}

export async function criarEquipamento(payload: EquipamentoPayload): Promise<{ id: string }> {
  return unwrap(sceApi.post<SceResponse<{ id: string }>>('/create-equipamento', payload))
}

export async function atualizarEquipamento(id: string, campos: Partial<EquipamentoPayload>): Promise<void> {
  await unwrap(sceApi.post<SceResponse<null>>('/update-equipamento', { id, ...campos }))
}


export async function removerEquipamento(id: string): Promise<void> {
  await unwrap(sceApi.post<SceResponse<unknown>>('/remover-equipamento', { id }))
}

/** Filiais/unidades ativas cadastradas (para selects de unidade). */
export async function listarFiliais(): Promise<string[]> {
  return unwrap(sceApi.get<SceResponse<string[]>>('/filiais-para-emprestimo'))
}

/* ---------- Configurações (somente Matriz) ---------- */

export async function adicionarItemCatalogo(categoria: string, marca: string, modelo: string): Promise<ItemLista> {
  return unwrap(sceApi.post<SceResponse<ItemLista>>('/listas-adicionar', { categoria, marca, modelo }))
}

export async function removerItemCatalogo(id: number): Promise<void> {
  await unwrap(sceApi.post<SceResponse<unknown>>('/listas-remover', { id }))
}

export interface AuditoriaItem {
  id: number
  data: string
  usuario: string
  acao: string
  detalhes?: Record<string, unknown> | null
}

export async function listarAuditoria(limite = 60): Promise<AuditoriaItem[]> {
  return unwrap(sceApi.get<SceResponse<AuditoriaItem[]>>('/auditoria', { params: { limite } }))
}

/* ---------- Helpers de domínio ---------- */

/** Totalizadores de status a partir de um mapa {status: qtd} vindo do SCE. */
export interface EquipStats {
  total: number
  disponiveis: number
  emManutencao: number
  quebrados: number
  extraviados: number
}

export function resumirStatus(porStatus: Record<string, number>): EquipStats {
  const stats: EquipStats = { total: 0, disponiveis: 0, emManutencao: 0, quebrados: 0, extraviados: 0 }
  for (const [status, qtd] of Object.entries(porStatus)) {
    stats.total += qtd
    const s = status.toLowerCase()
    if (s === 'disponível' || s === 'disponivel') stats.disponiveis += qtd
    else if (s.includes('manuten')) stats.emManutencao += qtd
    else if (s.includes('quebrad')) stats.quebrados += qtd
    else if (s.includes('extrav')) stats.extraviados += qtd
  }
  return stats
}

export function pct(parte: number, total: number): string {
  if (!total) return '0,0%'
  return ((parte / total) * 100).toFixed(1).replace('.', ',') + '%'
}
