/**
 * Sondas de rede: ICMP (ping do sistema) e conexão TCP.
 *
 * Por que o `ping` do sistema e não um pacote ICMP montado à mão:
 * abrir socket "raw" exige privilégio de administrador (ou a capability
 * CAP_NET_RAW no Linux) e um pacote ICMP bem formado. Chamar o `ping.exe` que
 * já existe na máquina entrega o mesmo resultado em uma máquina Windows comum,
 * sem instalar driver nem pedir elevação de privilégio — o serviço roda na
 * conta de usuário normal.
 *
 * Por que a sonda TCP existe:rede corporativa costuma ter ICMP filtrado por
 * política. Sem a sonda TCP, todo equipamento que bloqueia ping apareceria como
 * "offline" e o painel passaria a mentir — que é pior do que não ter painel.
 */
import { spawn } from 'node:child_process'
import net from 'node:net'

const JANELA_PING = 4096

/** `-n 1` no Windows, `-c 1` nos demais. */
function argumentosPing(ip, timeoutMs) {
  if (process.platform === 'win32') {
    return ['-n', '1', '-4', '-w', String(timeoutMs), ip]
  }
  // No Linux/macOS o `-w` é o prazo TOTAL em segundos; o `-W` (só Linux/macOS)
  // é o prazo por pacote. Nos dois, arredondamos para cima para não cortar a
  // resposta antes do instante em que ela chegaria.
  const segundos = Math.max(1, Math.ceil(timeoutMs / 1000))
  if (process.platform === 'darwin') {
    // No macOS o `-W` é em MILISSEGUNDOS.
    return ['-c', '1', '-4', '-W', String(timeoutMs), ip]
  }
  return ['-c', '1', '-4', '-W', String(segundos), '-w', String(segundos), ip]
}

/**
 * Dispara um ICMP.
 *
 * @returns {Promise<{ok: boolean|null, latencyMs: number|null, ttl: number|null, erro?: string}>}
 *   `ok: null` significa "não deu para saber" (o `ping` não existe na máquina),
 *   e não "offline" — a diferença evita mostrar 500 equipamentos vermelhos
 *   quando, na verdade, o serviço está mal configurado.
 */
export function ping(ip, timeoutMs) {
  return new Promise((resolve) => {
    let saida = ''
    let encerrado = false
    let timer = null
    let filho = null

    const terminar = (resultado) => {
      if (encerrado) return
      encerrado = true
      if (timer) clearTimeout(timer)
      try {
        filho?.kill()
      } catch {
        /* já morreu */
      }
      resolve(resultado)
    }

    try {
      filho = spawn('ping', argumentosPing(ip, timeoutMs), {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (erro) {
      resolve({ ok: null, latencyMs: null, ttl: null, erro: erro.message })
      return
    }

    timer = setTimeout(() => {
      terminar({ ok: false, latencyMs: null, ttl: null, erro: 'tempo esgotado' })
    }, timeoutMs + 400)

    filho.stdout.on('data', (d) => {
      if (saida.length < JANELA_PING) saida += d.toString()
    })
    filho.stderr.on('data', () => {
      /* mensagens de erro do próprio ping não alteram o veredito (exit code) */
    })

    filho.on('error', (erro) => {
      // ENOENT = o executável `ping` não existe nesta máquina.
      terminar({ ok: null, latencyMs: null, ttl: null, erro: erro.message })
    })

    filho.on('close', (codigo) => {
      // O veredito é o CÓDIGO DE SAÍDA, não o texto: o Windows em português
      // responde "Resposta de ...", "Sem resposta para ...", e a palavra pode
      // variar por versión/locale. O texto só serve para extrair latência e TTL.
      const latencia = /tempo[=<]\s*(\d+)\s*ms/i.exec(saida) || /time[=<]\s*(\d+)\s*ms/i.exec(saida)
      const ttl = /ttl\s*=\s*(\d+)/i.exec(saida)
      terminar({
        ok: codigo === 0,
        latencyMs: latencia ? Number(latencia[1]) : null,
        ttl: ttl ? Number(ttl[1]) : null,
      })
    })
  })
}

/**
 * Tenta abrir uma conexão TCP.
 *
 * É bem mais barata que o ping: não cria processo, só um socket, então 500+
 * endereços com 2 portas cada cabem folgados no pool de concorrência.
 */
export function sondaTcp(ip, porta, timeoutMs) {
  return new Promise((resolve) => {
    let encerrado = false
    const inicio = Date.now()

    const socket = new net.Socket()
    const terminar = (ok) => {
      if (encerrado) return
      encerrado = true
      socket.removeAllListeners()
      socket.destroy()
      resolve({ ok, latencyMs: ok ? Date.now() - inicio : null })
    }

    socket.setTimeout(timeoutMs)
    socket.once('connect', () => terminar(true))
    socket.once('timeout', () => terminar(false))
    // Sem handler, um "ECONNREFUSED" chega como exceção não tratada e derruba o
    // serviço inteiro — e porta fechada é o resultado NORMAL de uma sonda.
    socket.once('error', () => terminar(false))
    socket.connect(porta, ip)
  })
}