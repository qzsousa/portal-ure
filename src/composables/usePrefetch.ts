import { listarEscolas } from '@/api/usuarios'
import { listarTecnicos } from '@/api/chamados'
import { listarAtribuicoes } from '@/api/agenda'
import { useLoadingStore } from '@/stores/loading'

function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${dia}`
}

/**
 * Aquece os caches de dados comuns (escolas, técnicos e atribuições do mês
 * atual) em segundo plano, sem bloquear a interface e sem exibir overlay.
 */
export function aquecerDados() {
  const loading = useLoadingStore()
  loading.entrarSilencioso()
  const hoje = new Date()
  const inicio = iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  const fim = iso(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1))

  Promise.allSettled([
    listarEscolas(),
    listarTecnicos(),
    listarAtribuicoes({ inicio, fim }),
  ]).finally(() => loading.sairSilencioso())
}
