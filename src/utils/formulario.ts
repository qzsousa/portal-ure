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
 * Condições incompletas (sem pergunta de origem ou sem opção) são descartadas:
 * comparação por `undefined` faria a pergunta aparecer sozinha.
 */
export function condicoesDe(p: Pick<FormularioPergunta, 'condicoes' | 'dependeDePerguntaId' | 'dependeDeOpcao'>): FormularioCondicao[] {
  const lista = Array.isArray(p.condicoes) ? p.condicoes : []
  const validas = lista.filter((c) => !!c?.perguntaId && !!c?.opcao)
  if (validas.length) return validas
  if (p.dependeDePerguntaId && p.dependeDeOpcao) {
    return [{ perguntaId: p.dependeDePerguntaId, opcao: p.dependeDeOpcao }]
  }
  return []
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