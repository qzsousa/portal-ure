import type { TecnicoDestino } from '@/api/chamados'

/**
 * Escala da equipe de atendimento.
 *
 * Estas listas definem a ORDEM em que os selects de "responsável pelo
 * atendimento" apresentam as pessoas. Quem PODE receber é outra pergunta, e a
 * resposta não é a escala: é o perfil (Escopo de tipos de chamado, marcado pelo
 * ADMIN em Cadastro de usuários) mais o filtro do backend.
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
 * Ordem da equipe de Sistemas e E-mail: quem atende esse assunto vem antes
 * dos demais, com JESSICA e MATHEUS na frente.
 *
 * É SÓ ORDEM. Quem pode receber esses chamados é quem tem a categoria marcada
 * em "Escopo de tipos" no perfil — o backend já devolve só eles, em
 * `CATEGORIAS_COM_LIBERACAO` (espelha o backend).
 */
export const EQUIPE_SISTEMAS_EMAIL = ['JESSICA', 'MATHEUS', 'PABLO', 'FERNANDA', 'FABIO'] as const

/**
 * Categorias que exigem liberação no perfil do técnico, por chave do
 * formulário. Espelha `CATEGORIAS_COM_LIBERACAO` do backend: as duas listas
 * precisam contar as mesmas, senão a tela oferece alguém que o servidor recusa.
 * 'e-mail' cobre a grafia com hífen.
 */
export const CATEGORIAS_COM_LIBERACAO = ['sistemas', 'email', 'e-mail'] as const

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
 * Posição na escala, ou null quando o cadastro não é de ninguém dela.
 *
 * Casa pelo primeiro nome e aceita o abreviado em relação à escala: "Carolina
 * Prado" cai em CAROL, "Heberto" em HEBERT. O piso de 4 letras evita que um
 * nome curto capture alguém que não é da equipe.
 *
 * Como o casamento é por primeiro nome, DUAS contas da mesma pessoa entram
 * como duas opções ("Pablo" e "Pablo - Estagiário"). Isso é cadastro, não
 * código: quem escreve o nome na conta escreve também o primeiro nome de
 * quem vai atender. Desative a conta antiga.
 */
function posicaoNaEscala(nome: string, posicao: Map<string, number>): number | null {
  const primeiro = primeiroNome(nome)
  for (const [daEscala, i] of posicao) {
    if (primeiro === daEscala || (daEscala.length >= 4 && primeiro.startsWith(daEscala))) return i
  }
  return null
}

/** As chaves acima já normalizadas ('SISTEMAS', 'EMAIL', 'E-MAIL'). */
const CATEGORIAS_LIBERADAS = new Set<string>(CATEGORIAS_COM_LIBERACAO.map(normalizar))

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

/**
 * Esta categoria só chega a quem a marcou no perfil?
 *
 * Espelha `categoriaExigeLiberacao` do backend. Vale para a lista que a tela
 * monta; quem decide mesmo é o servidor, no encaminhamento.
 */
export function ehCategoriaComLiberacao(categoriaChave?: string | null): boolean {
  return CATEGORIAS_LIBERADAS.has(normalizar(categoriaChave || ''))
}

/** A ordem da escala desta categoria: a de Sistemas/E-mail ou a geral. */
export function equipeDaCategoria(categoriaChave?: string | null): readonly string[] {
  return ehCategoriaComLiberacao(categoriaChave) ? EQUIPE_SISTEMAS_EMAIL : EQUIPE_ATENDIMENTO
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
 * Nas categorias comuns a escala é a lista FECHADA de quem pode atender: o que
 * não está nela não entra no select, mesmo sendo ADMIN ou TECNICO ativo. É o
 * que impede a conta de teste ("Teste Local") e o homônimo ("Pablo - Estagiário"
 * ao lado do "Pablo") de aparecerem como destino.
 *
 * A ordem é a de `EQUIPE_ATENDIMENTO` / `EQUIPE_SISTEMAS_EMAIL`. Quem atende
 * a unidade entra antes, no grupo `GRUPO_UNIDADE`, que preserva essa ordem.
 *
 * EXCEÇÃO — Sistemas e E-mail (categorias com liberação): lá quem pode receber
 * é quem tem a categoria marcada no perfil, e o backend já devolve só essas
 * pessoas. A escala entra como ORDEM, não como filtro: repetir o filtro aqui
 * esconderia do select o técnico que o ADMIN acabou de liberar, e o
 * encaminhamento automático cairia em outra pessoa. Quem o backend mandou e não
 * está na escala entra depois dela, em vez de sumir.
 *
 * Única exceção em qualquer das duas: o técnico já salvo na regra
 * (`extrasIds`) nunca some, para uma regra antiga não abrir vazia — sem isso o
 * select ficaria sem seleção e o "Salvar" viraria "Técnico da unidade" sem
 * ninguém querer.
 */
export function ordenarTecnicos(
  tecnicos: TecnicoDestino[],
  opcoes: OrdenarTecnicosOpcoes = {},
): TecnicoDestino[] {
  const liberada = ehCategoriaComLiberacao(opcoes.categoriaChave)
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
  if (!liberada) return [...daEscala, ...extrasPresentes]

  const outros = foraDaEscala.filter((t) => !extras.has(t.id))
  return [...daEscala, ...extrasPresentes, ...outros]
}
