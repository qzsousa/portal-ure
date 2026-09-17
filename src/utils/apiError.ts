import { AxiosError } from 'axios'

interface ApiErrorBody {
  error?: string
  message?: string
  details?: Record<string, string[]> | Array<{ field?: string; message?: string }>
}

/**
 * Extrai mensagem útil de um erro da API (inclui detalhes de validação Zod,
 * ex.: { details: { email: ['Invalid email'] } }).
 */
export function apiError(e: unknown, fallback = 'Operação falhou. Tente novamente.'): string {
  const err = e as AxiosError<ApiErrorBody>
  const body = err?.response?.data
  if (!body) return err?.message || fallback

  const base = body.message || fallback

  if (body.details && !Array.isArray(body.details)) {
    const partes = Object.entries(body.details)
      .map(([campo, msgs]) => `${campo}: ${(msgs || []).join(', ')}`)
      .filter(Boolean)
    if (partes.length) return `${base} — ${partes.join(' | ')}`
  }

  return base
}
