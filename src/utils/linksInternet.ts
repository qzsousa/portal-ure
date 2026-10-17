import { LINKS_INTERNET, type LinkInternetUnidade } from '@/data/linksInternetData'
import { chaveEscola } from '@/utils/escola'

const STORAGE_KEY = 'portal:links-internet:v1'

export function carregarLinksInternet(): LinkInternetUnidade[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as LinkInternetUnidade[]
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // ignora cache inválido
  }
  return LINKS_INTERNET.map((r) => ({ ...r }))
}

export function buscarLinkInternetPorEscola(nome: string | null | undefined): LinkInternetUnidade | null {
  if (!nome || !nome.trim()) return null
  const alvo = chaveEscola(nome)
  return carregarLinksInternet().find((r) => chaveEscola(r.escola) === alvo) || null
}
