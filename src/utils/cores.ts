/**
 * Cor por técnico na agenda de atendimento.
 *
 * A paleta é a MESMA de `src/components/ui/DonutCard.vue` (8 cores) — copiada
 * de propósito, como os outros contratos espelhados à mão, para o portal não
 * depender de `@shared/api`. Se mudar lá, muda aqui.
 */
export const PALETA: readonly string[] = [
  '#2563eb',
  '#16a34a',
  '#f59e0b',
  '#dc2626',
  '#64748b',
  '#9333ea',
  '#0891b2',
  '#db2777',
]

/** Hex de 6 dígitos, com ou sem o '#' inicial, em qualquer caixa. */
const HEX_RE = /^#?[0-9a-fA-F]{6}$/

/**
 * Cor vinda do backend só vira `style` depois de validada.
 *
 * Um valor inválido (null, formato fora do padrão, string longa demais) não é
 * problema de "dia sem cor": ele quebraria a célula inteira, porque o Vue
 * aplica o estilo inline em todo o elemento. Por isso inválido = cai no hash.
 */
export function hexValido(valor: string | null | undefined): valor is string {
  return typeof valor === 'string' && valor.length <= 7 && HEX_RE.test(valor)
}

/** Canonicaliza para '#' + 6 dígitos minúsculos, pronto para o `style`. */
function normalizarHex(valor: string): string {
  const hex = valor.startsWith('#') ? valor.slice(1) : valor
  return `#${hex.toLowerCase()}`
}

/**
 * Hash estável do id do técnico.
 *
 * A mesma pessoa sai sempre com a mesma cor, independente da ordem em que o
 * backend devolve a lista ou de quantos dias ela já tem atribuídos. O desloc
 * `>>> 0` garante um inteiro sem sinal 32 bits, então o resultado não varia
 * entre plataformas.
 */
function hashDe(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0
  }
  return h
}

/**
 * Cor do técnico.
 *
 * Usa o campo `cor` do Usuário quando o backend o devolve (`tecnicoCor`); quando
 * vem null — o caso de todo mundo hoje, porque a coluna começa nula — cai no
 * hash estável do id sobre a paleta fixa. É por isso que a Agenda não fica sem
 * cor só porque o cadastro ainda não foi atualizado.
 */
export function corDoTecnico(tecnicoId: string, tecnicoCor?: string | null): string {
  if (hexValido(tecnicoCor)) return normalizarHex(tecnicoCor)
  return PALETA[hashDe(tecnicoId) % PALETA.length]
}
