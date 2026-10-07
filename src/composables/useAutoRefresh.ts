import { onMounted, onUnmounted } from 'vue'

/** Intervalos de atualização automática usados no portal. */
export const AUTO_REFRESH_MS = {
  /** Telas operacionais sensíveis (chamados, equipamentos, painel público). */
  rapido: 30_000,
  /** Telas analíticas/secundárias (painel, manutenção, feedback, dirigente). */
  normal: 60_000,
  /**
   * Monitoramento das câmeras DVR.
   *
   * Alinhado ao ciclo do serviço (`intervaloSegundos`, 30 s no config.json
   * do monitor). A tela pergunta no MESMO ritmo em que a máquina varre:
   * consultar antes devolveria o mesmo payload pelo túnel, sem informação nova.
   * Se mudar o ciclo do serviço, mude aqui junto.
   */
  monitor: 30_000,
} as const

/**
 * Atualização automática de uma tela por polling.
 *
 * - Executa `atualizar` a cada `intervaloMs`.
 * - Pausa enquanto a aba está oculta e dispara uma atualização imediata
 *   quando o usuário volta para ela (dados sempre frescos ao alternar de aba).
 * - Não sobrepõe execuções: se a rodada anterior ainda não terminou,
 *   a próxima é ignorada.
 *
 * A função recebida deve ser SILENCIOSA: não pode limpar os dados exibidos
 * nem mostrar spinner/erro ao usuário — a tela continua com os dados
 * anteriores até a próxima rodada bem-sucedida.
 */
export function useAutoRefresh(atualizar: () => void | Promise<void>, intervaloMs: number) {
  let timer: number | null = null
  let executando = false

  async function tick() {
    if (document.hidden || executando) return
    executando = true
    try {
      await atualizar()
    } finally {
      executando = false
    }
  }

  function aoVoltarParaAba() {
    if (!document.hidden) void tick()
  }

  onMounted(() => {
    timer = window.setInterval(() => void tick(), intervaloMs)
    document.addEventListener('visibilitychange', aoVoltarParaAba)
  })

  onUnmounted(() => {
    if (timer !== null) window.clearInterval(timer)
    document.removeEventListener('visibilitychange', aoVoltarParaAba)
  })
}
