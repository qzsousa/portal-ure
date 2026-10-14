/** Status de equipamento → classe de cor de fundo da linha (`main.css`). */
export type ClasseLinhaStatus = string

/**
 * Mesma codificação de cor do SCE (`status.css`): a linha inteira assume a cor
 * do status. Quem usa o inventário há anos lê a tabela pela cor de fundo, então
 * o nome do status passa por uma normalização em vez de virar slug direto —
 * "Emprestado", "Emprestad[o]" e "emprestado" precisam cair na mesma classe.
 *
 * Status desconhecido fica sem classe (linha branca): inventar uma cor errada
 * seria pior do que não colorir.
 */
export function classeLinhaStatus(status: string | null | undefined): ClasseLinhaStatus {
  const s = (status || '').trim().toLowerCase()
  if (!s) return ''

  /* O SCE gerava `status-<slug>`; manter os mesmos nomes evita a divergência
   * entre o que a pessoa já conhece e o que o portal mostra. */
  const alias: Array<[RegExp, string]> = [
    [/dispon/, 'disponivel'],
    [/manuten/, 'manutencao'],
    [/empres/, 'emprestado'],
    [/verifica/, 'em-verificacao'],
    [/quebrad/, 'quebrado'],
    [/extrav|extravi/, 'extraviado'],
    [/inserv/, 'inservivel'],
    [/removid/, 'removido'],
  ]
  for (const [re, nome] of alias) {
    if (re.test(s)) return `linha-status-${nome}`
  }
  return ''
}

/**
 * Cor da linha na tela de Manutenção.
 *
 * Aqui a coluna "Status" mostra o andamento do serviço (Pendente / Em
 * andamento / Concluído), não o status do equipamento — por isso um conjunto
 * próprio, casando com os tons dos cartões de KPI logo acima da tabela.
 */
export function classeLinhaManutencao(statusManutencao: string | null | undefined): string {
  const s = (statusManutencao || '').trim().toLowerCase()
  if (!s) return ''
  if (/pendent/.test(s)) return 'linha-man-pendente'
  if (/andamento|atendimento/.test(s)) return 'linha-man-andamento'
  if (/conclu/.test(s)) return 'linha-man-concluido'
  return ''
}
