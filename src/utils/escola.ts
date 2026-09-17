/**
 * Normalização/casamento de nomes de escola entre os dois sistemas.
 * SCE usa "Adhemar Antonio Prado Prof"; chamados usam "E.E. ADHEMAR ANTONIO PRADO".
 */

/** Chave de comparação: caixa-alta, sem acentos, sem prefixo "E.E.". */
export function chaveEscola(nome: string): string {
  return (nome || '')
    .toUpperCase()
    .replace(/^E\.?E\.?\s*/i, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Remove sufixos honoríficos frequentes no SCE para facilitar o casamento. */
function semHonorificos(chave: string): string {
  return chave.replace(/\s+(PROF(A)?|DR(A)?|DEPUTAD[OA]|PRESIDENTE|MAESTRO)$/, '').trim()
}

/**
 * Encontra o nome padronizado (formato chamados) correspondente à string do SCE.
 * Estratégia: chave exata → chave sem honoríficos → prefixo em qualquer direção.
 */
export function casarNomeEscola(nomeSce: string, padronizados: string[]): string | null {
  const k = chaveEscola(nomeSce)
  if (!k) return null
  const kSem = semHonorificos(k)

  for (const p of padronizados) {
    if (chaveEscola(p) === k) return p
  }
  for (const p of padronizados) {
    if (chaveEscola(p) === kSem || semHonorificos(chaveEscola(p)) === kSem) return p
  }
  for (const p of padronizados) {
    const pk = chaveEscola(p)
    if (k.startsWith(pk) || pk.startsWith(kSem) || pk.startsWith(k)) return p
  }
  return null
}

/** Nome para exibição padronizada: "E.E. ..." quando casar com a lista; senão, o original. */
export function exibirNomeEscola(nomeSce: string, padronizados: string[]): string {
  return casarNomeEscola(nomeSce, padronizados) || nomeSce
}
