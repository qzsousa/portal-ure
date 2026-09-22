import { computed, reactive } from 'vue'
import { defineStore } from 'pinia'
import { useUiStore } from './ui'

/**
 * Registro local de erros de BACKEND (HTTP 5xx ou backend sem resposta).
 *
 * Alimentado pelos interceptors de axios (ver `api/http.ts`): toda falha
 * final de requisição contra um backend gera uma entrada aqui, dispara um
 * toast de erro (com cooldown por assinatura, para não spammar quando o
 * polling do sino/topbar falha repetidamente) e fica visível na aba
 * "Logs do sistema" das Configurações.
 *
 * Persistido em localStorage para sobreviver a recarregamentos da página.
 */

export interface ErroBackend {
  id: number
  /** ISO string do momento (da última ocorrência, se houver repetições) */
  data: string
  /** Rótulo amigável do backend ('Chamados', 'SCE', ...) */
  backend: string
  /** Método HTTP (GET, POST, ...) */
  metodo: string
  /** Caminho da rota chamada (ex.: '/chamados') */
  rota: string
  /** Status HTTP, ou null quando não houve resposta (rede/timeout) */
  status: number | null
  /** Mensagem de erro extraída da resposta (ou do axios) */
  mensagem: string
  /** Quantas vezes o mesmo erro ocorreu em sequência */
  repeticoes: number
}

const STORAGE_KEY = 'portal.backendErrors'
const MAX_ENTRIES = 100
/** Intervalo mínimo entre dois toasts da MESMA assinatura de erro. */
const TOAST_COOLDOWN_MS = 60_000

function carregarPersistidos(): ErroBackend[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as ErroBackend[]) : []
  } catch {
    return []
  }
}

function assinatura(e: Pick<ErroBackend, 'backend' | 'metodo' | 'rota' | 'status'>): string {
  return `${e.backend}|${e.metodo}|${e.rota}|${e.status ?? 'sem-resposta'}`
}

export const useErrorLogStore = defineStore('errorLog', () => {
  const erros = reactive<ErroBackend[]>(carregarPersistidos())
  let nextId = erros.reduce((max, e) => Math.max(max, e.id), 0) + 1
  const ultimoToast = new Map<string, number>()

  function persistir() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(erros.slice(0, MAX_ENTRIES)))
    } catch {
      /* storage cheio/indisponível — o log em memória continua funcionando */
    }
  }

  function registrar(input: Omit<ErroBackend, 'id' | 'data' | 'repeticoes'>) {
    const agora = Date.now()
    const assinaturaAtual = assinatura(input)

    // Mesma assinatura do erro mais recente → só incrementa o contador.
    const ultimo = erros[0]
    if (ultimo && assinatura(ultimo) === assinaturaAtual) {
      ultimo.repeticoes += 1
      ultimo.data = new Date(agora).toISOString()
      ultimo.mensagem = input.mensagem
    } else {
      erros.unshift({
        id: nextId++,
        data: new Date(agora).toISOString(),
        repeticoes: 1,
        ...input,
      })
      if (erros.length > MAX_ENTRIES) erros.splice(MAX_ENTRIES)
    }
    persistir()

    const ultimoToastEm = ultimoToast.get(assinaturaAtual) ?? 0
    if (agora - ultimoToastEm >= TOAST_COOLDOWN_MS) {
      ultimoToast.set(assinaturaAtual, agora)
      const statusTxt = input.status ? `HTTP ${input.status}` : 'sem resposta'
      useUiStore().error(
        `Erro no backend ${input.backend}: ${input.metodo} ${input.rota} (${statusTxt})`,
      )
    }
  }

  function limpar() {
    erros.splice(0, erros.length)
    ultimoToast.clear()
    persistir()
  }

  const total = computed(() => erros.length)

  return { erros, total, registrar, limpar }
})
