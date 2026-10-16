import { AxiosError } from 'axios'

interface ApiErrorBody {
  error?: string
  message?: string
  details?: Record<string, string[]> | Array<{ field?: string; message?: string }>
}

/**
 * Extrai mensagem útil de um erro da API (inclui detalhes de validação Zod,
 * ex.: { details: { email: ['Invalid email'] } }).
 *
 * A ordem é `message` → `error` porque os dois backends não falam a mesma língua:
 * o de chamados manda `{ error: 'FORBIDDEN', message: 'Sem permissão...' }` — o
 * `message` é o texto para o usuário e o `error` é o código. Já o SCE responde
 * `standardResponse(false, null, msg)`, ou seja `{ success, data, error }`, sem
 * `message`: lá a mensagem boa ESTÁ no `error`. Ler só `message` fazia o SCE
 * cair no fallback e escondia a causa — o sintoma era um texto genérico do axios
 * em vez de "Sessão inválida ou expirada".
 */
export function apiError(e: unknown, fallback = 'Operação falhou. Tente novamente.'): string {
  const err = e as AxiosError<ApiErrorBody>
  const body = err?.response?.data
  if (!body) return err?.message || fallback

  const base = body.message || body.error || fallback

  if (body.details && !Array.isArray(body.details)) {
    const partes = Object.entries(body.details)
      .map(([campo, msgs]) => `${campo}: ${(msgs || []).join(', ')}`)
      .filter(Boolean)
    if (partes.length) return `${base} — ${partes.join(' | ')}`
  }

  return base
}
