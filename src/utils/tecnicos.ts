import type { TecnicoDestino } from '@/api/chamados'

/**
 * Escala da equipe de atendimento.
 *
 * Estas listas definem QUEM aparece nos selects de "responsável pelo
 * atendimento" e EM QUE ORDEM — a lista é a ordem do select, não um filtro
 * sobre o cadastro de usuários (o `id` continua vindo do backend).
 */

/** Equipe que atende os chamados em geral, na ordem em que aparece no select. */
export const EQUIPE_ATENDIMENTO = [
  'PABLO',
  'FERNANDA',
  'MATHEUS',
  'JESSICA',
  'FABIO',
  'JOAO',
  'GUILHERME',
  'JOSEMIR',
  'VALDEIR',
  'CHARLES',
  'CAROL',
  'HEBERT',
] as const

/**
 * Chamados de Sistemas e E-mail têm equipe própria: só estas cinco pessoas
 * atendem esse tipo de chamado, e JESSICA e MATHEUS vêm antes das demais.
 */
export const EQUIPE_SISTEMAS_EMAIL = ['JESSICA', 'MATHEUS', 'PABLO', 'FERNANDA', 'FABIO'] as const

/** Chaves de categoria do formulário público com equipe restrita ('e-mail' cobre a grafia com hífen). */
export const CATEGORIAS_EQUIPE_REDUZIDA = ['sistemas', 'email', 'e-mail'] as const

/** Rótulo do grupo com quem atende a unidade do chamado (vem primeiro no select). */
export const GRUPO_UNIDADE = 'Atende esta unidade'

/** Maiúscula, sem acento e sem espaços extras — para comparar nomes cadastrados. */
function normalizar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

/** Compara pelo primeiro nome: "Pablo Ferreira" casa com "PABLO". */
function primeiroNome(nome: string): string {
  return normalizar(nome).split(' ')[0]
}

/**
 * Posição do técnico na escala, ou null quando não está nela.
 *
 * Casa pelo primeiro nome, aceitando o nome completo ou abreviado em
 * relação à escala ("Carolina" cai em CAROL, "Heberto" em HEBERT). O piso de 4
 * letras evita que um nome curto capture alguém que não é da equipe.
 */
function posicaoNaEscala(nome: string, posicao: Map<string, number>): number | null {
  const primeiro = primeiroNome(nome)
  for (const [daEscala, i] of posicao) {
    if (primeiro === daEscala || (daEscala.length >= 4 && primeiro.startsWith(daEscala))) return i
  }
  return null
}

/** As chaves acima já normalizadas ('SISTEMAS', 'EMAIL'). */
const CATEGORIAS_REDUZIDAS = new Set<string>(CATEGORIAS_EQUIPE_REDUZIDA.map(normalizar))

/** O que a tela precisa do chamado para descobrir a categoria dele. */
export interface ChamadoComCategoria {
  categoriaChave?: string | null
  tipo?: string | null
}

/**
 * Categoria do chamado, comFallback no texto de `tipo`.
 *
 * Só os chamados abertos depois da criação das chaves gravam `categoriaChave`
 * — nos anteriores vem null, e é o `tipo` ("Sistema - PortalNet",
 * "E-mail Institucional") que diz a que equipe o chamado pertence. O casamento
 * é no INÍCIO do texto de propósito: "Equip. - Sistema" é um chamado de
 * equipamento cujo tipo de equipamento é "sistema", não um chamado de sistemas.
 */
export function chaveDaCategoria(chamado?: ChamadoComCategoria | null): string {
  const chave = normalizar(chamado?.categoriaChave || '')
  if (chave) return chave
  const tipo = normalizar(chamado?.tipo || '')
  if (tipo.startsWith('SISTEMA')) return 'SISTEMAS'
  if (/^E-?MAIL/.test(tipo)) return 'EMAIL'
  return ''
}

/** true quando a categoria do chamado usa a equipe restrita (Sistemas/E-mail). */
export function ehCategoriaEquipeReduzida(categoriaChave?: string | null): boolean {
  return CATEGORIAS_REDUZIDAS.has(normalizar(categoriaChave || ''))
}

/** A equipe que pode receber um chamado da categoria informada. */
export function equipeDaCategoria(categoriaChave?: string | null): readonly string[] {
  return ehCategoriaEquipeReduzida(categoriaChave) ? EQUIPE_SISTEMAS_EMAIL : EQUIPE_ATENDIMENTO
}

export interface OrdenarTecnicosOpcoes {
  /** Chave da categoria do chamado (ex.: 'sistemas'). Vazio = equipe completa. */
  categoriaChave?: string | null
  /** IDs que nunca podem sumir do select (ex.: o técnico já salvo na regra). */
  extrasIds?: string[]
}

/**
 * Ordena (e filtra) a lista de destinos de um select de responsável.
 *
 * - A equipe da categoria vem na ordem de `EQUIPE_ATENDIMENTO` /
 *   `EQUIPE_SISTEMAS_EMAIL`. Quem atende a unidade entra antes, no grupo
 *   `GRUPO_UNIDADE`, que já preserva esta ordem.
 * - Técnico ativo fora da escala não some: nas categorias comuns ele vai para
 *   o fim da lista; nas restritas (Sistemas/E-mail) sai da lista, salvo se
 *   estiver em `extrasIds` (o que já estava salvo na regra).
 */
export function ordenarTecnicos(
  tecnicos: TecnicoDestino[],
  opcoes: OrdenarTecnicosOpcoes = {},
): TecnicoDestino[] {
  const equipe = equipeDaCategoria(opcoes.categoriaChave)
  const posicao = new Map(equipe.map((nome, i) => [normalizar(nome), i]))
  const extras = new Set(opcoes.extrasIds || [])

  const daEscala: TecnicoDestino[] = []
  const ordem = new Map<string, number>()
  const foraDaEscala: TecnicoDestino[] = []
  for (const t of tecnicos) {
    const i = posicaoNaEscala(t.nome, posicao)
    if (i === null) foraDaEscala.push(t)
    else {
      daEscala.push(t)
      ordem.set(t.id, i)
    }
  }
  // sort é estável: dois usuários com o mesmo nome na escala mantêm a ordem
  // em que o backend os devolveu.
  daEscala.sort((a, b) => (ordem.get(a.id) ?? 0) - (ordem.get(b.id) ?? 0))

  const extrasPresentes = foraDaEscala.filter((t) => extras.has(t.id))
  const resto = ehCategoriaEquipeReduzida(opcoes.categoriaChave)
    ? []
    : foraDaEscala.filter((t) => !extras.has(t.id))

  return [...daEscala, ...extrasPresentes, ...resto]
}
