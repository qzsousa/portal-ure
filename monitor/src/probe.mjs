/**
 * Sondas de rede.
 *
 * Por que o `ping` do sistema e não pacote ICMP montado à mão: abrir socket
 * "raw" exige privilégio de administrador (ou CAP_NET_RAW no Linux), e o
 * serviço tem de rodar na conta de usuário normal da máquina 24/7. Chamar o
 * `ping.exe` que já existe no Windows produz o mesmo veredito sem elevar
 * privilégio nem instalar driver.
 *
 * Por que a sonda TCP existe: o firewall das unidades pode filtrar ICMP. Sem a
 * sonda, um DVR que responde à web e ao RTSP aparece como "desligado" — e
 * painel que mente sobre o estado da câmera é pior do que não ter painel.
 */
import { spawn } from 'node:child_process'
import net from 'node:net'

const JANELA_PING = 4096

/** `-n 1` no Windows; `-c 1` + prazo nos demais. */
function argumentosPing(ip, timeoutMs) {
  if (process.platform === 'win32') {
    return ['-n', '1', '-4', '-w', String(timeoutMs), ip]
  }
  const segundos = Math.max(1, Math.ceil(timeoutMs / 1000))
  if (process.platform === 'darwin') {
    // macOS: `-W` é em MILISSEGUNDOS.
    return ['-c', '1', '-4', '-W', String(timeoutMs), ip]
  }
  return ['-c', '1', '-4', '-W', String(segundos), '-w', String(segundos), ip]
}

/**
 * Dispara um ICMP.
 *
 * @returns {Promise<{ok: boolean|null, latencyMs: number|null, ttl: number|null, erro?: string}>}
 *   `ok: null` = "não deu para saber" (ping não existe nesta máquina), que é
 *   diferente de "offline": separa falha de configuração do serviço de
 *   equipamento desligado, e a primeira não pode pintar a segunda de vermelho.
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
      /* mensagens do próprio ping não mudam o veredito (exit code) */
    })

    filho.on('error', (erro) => {
      // ENOENT = o executável `ping` não existe nesta máquina.
      terminar({ ok: null, latencyMs: null, ttl: null, erro: erro.message })
    })

    filho.on('close', (codigo) => {
      // Veredito = CÓDIGO DE SAÍDA. O Windows em português escreve "tempo<1ms",
      // não "time<1ms", então o texto só serve para extrair latência e TTL.
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
 * Bem mais barata que o ping: não cria processo, só um socket. Com 48 hosts no
 * pool e 5 portas cada, ficam no máximo ~240 sockets abertos ao mesmo tempo —
 * baixo o bastante para não estourar o limite de portas efêmeras do Windows.
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
    // ECONNREFUSED (porta fechada) é o resultado NORMAL: sem este handler o
    // erro vira exceção não tratada e derruba o serviço no meio da varredura.
    socket.once('error', () => terminar(false))
    socket.connect(porta, ip)
  })
}