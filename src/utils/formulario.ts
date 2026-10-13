import type { FormularioCondicao, FormularioPergunta } from '@/api/formulario'

/**
 * Regras de exibição do formulário de chamados que precisam ser iguais na tela
 * de configuração e na abertura pública. Ficam aqui (e não em cada componente)
 * porque uma divergência entre os dois lados transforma uma condição em "bug
 * só para o usuário" — a pergunta some ou aparece sozinha.
 */

/**
 * Condições de exibição de uma pergunta, normalizando o formato antigo.
 *
 * Perguntas gravadas antes das condicionais múltiplas só têm o par
 * `dependeDePerguntaId`/`dependeDeOpcao`. O backend também devolve `condicoes`
 * já preenchido para essas perguntas, mas o fallback mantém a tela pública
 * funcionando mesmo contra um backend ainda não migrado.
 *
 * `opcao` VAZIA é condição válida e significa "qualquer resposta do pai" — é o
 * backend que resolve assim. Descartá-la aqui faria a pergunta sumir da tela
 * enquanto o servidor a considers aberta; as duas pontas precisam ler a mesma
 * regra ou o usuário vê "o formulário some sozinho".
 *
 * Só condição SEM `perguntaId` é inválida de verdade: não há de quem ela depende.
 */
export function condicoesDe(p: Pick<FormularioPergunta, 'condicoes' | 'dependeDePerguntaId' | 'dependeDeOpcao'>): FormularioCondicao[] {
  const lista = Array.isArray(p.condicoes) ? p.condicoes : []
  const validas = lista.filter((c) => !!c?.perguntaId).map((c) => ({ perguntaId: c.perguntaId, opcao: c.opcao ?? '' }))
  if (validas.length) return validas
  if (p.dependeDePerguntaId) {
    return [{ perguntaId: p.dependeDePerguntaId, opcao: p.dependeDeOpcao ?? '' }]
  }
  return []
}

/**
 * Uma condição está satisfeita?
 *
 * `opcao` vazia = qualquer resposta do pai. E a comparação é a MESMA que o
 * backend faz (normaliza espaços e acentos): se os dois lados divergirem, a
 * tela mostra a pergunta e o servidor descarta a resposta como se ela tivesse
 * sido digitada por engano.
 */
export function condicaoSatisfeita(
  respostasPorPergunta: Record<string, string>,
  condicao: FormularioCondicao,
): boolean {
  const resposta = respostasPorPergunta[condicao.perguntaId]
  if (!resposta || !resposta.trim()) return false
  if (!condicao.opcao || !condicao.opcao.trim()) return true
  return normalizarRotulo(resposta) === normalizarRotulo(condicao.opcao)
}

/** Minúsculas, sem acento e sem espaço sobrando — a comparação que o backend usa. */
export function normalizarRotulo(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Perguntas que podem gerar uma condição: precisam de `OPCOES` e não podem ser a própria pergunta. */
export function podeSerOrigem(
  perguntas: FormularioPergunta[],
  categoriaId: string,
  idDaPropria: string | null,
): FormularioPergunta[] {
  return perguntas
    .filter((p) => p.id !== idDaPropria && p.categoriaId === categoriaId && p.tipo === 'OPCOES')
    .sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id))
}

/** Rótulo da pergunta de origem de uma condição, para exibir na lista do admin. */
export function rotuloDaOrigem(
  perguntas: FormularioPergunta[],
  perguntaId: string,
): string {
  return perguntas.find((p) => p.id === perguntaId)?.rotulo ?? 'pergunta removida'
}