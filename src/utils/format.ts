/**
 * Datas do backend chegam em dois formatos: timestamp ISO completo
 * ("2026-09-16T12:07:06.266+00:00") e data pura ("2026-03-03") — é o caso das
 * colunas DATE, como a data prevista de devolução de um empréstimo.
 *
 * Não dá para tratar os dois igual: `new Date('2026-03-03')` é interpretado como
 * meia-noite UTC e, formatado em America/Sao_Paulo (UTC-3), voltaria um dia —
 * o usuário leria "02/03" num registro que vence em 03/03. Para data pura o
 * parser é reescrito no fuso local, que é a leitura pretendida.
 */
const DATA_PURA = /^\d{4}-\d{2}-\d{2}$/

function paraData(iso: string): Date {
  if (DATA_PURA.test(iso)) {
    const [ano, mes, dia] = iso.split('-').map(Number)
    return new Date(ano, mes - 1, dia)
  }
  return new Date(iso)
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = paraData(iso)
  if (isNaN(d.getTime())) return '—'
  // Data pura já está no fuso certo; formatar com timeZone puxaria de novo.
  return DATA_PURA.test(iso)
    ? d.toLocaleDateString('pt-BR')
    : d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—'
  const d = paraData(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
