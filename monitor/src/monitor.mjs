/**
 * Motor do monitoramento: pool de concorrência, cache de estado e resumo.
 *
 * As três decisões que sustentam 500+ endereços:
 *
 * 1. CONCORRÊNCIA, não sequência. `ping` de 500 hosts um atrás do outro, com
 *    1 s de timeout, leva 8 minutos — impossível para "tempo real". Com pool de
 *    48 workers a rede inteira é varrida em poucos segundos.
 * 2. CACHE. A varredura roda em ciclo (30 s por padrão) e a API só lê o
 *    resultado pronto. Nenhum clique na tela dispara ping — senão 10 usuários
 *    olhando o painel viram 5.000 pings por minuto na rede.
 * 3. ESTADO ACUMULADO. Cada ciclo vira UMA linha do histórico e, quando o
 *    estado muda, guarda desde quando. A tela mostra "offline há 12 min" sem
 *    o serviço precisar guardar histórico em disco.
 */
import { performance } from 'node:perf_hooks'
import { ping, sondaTcp } from './probe.mjs'

/** Executa `worker` sobre `itens` com no máximo `concorrencia` em voo. */
export async function comPool(itens, concorrencia, worker) {
  const fila = [...itens]
  let proximo = 0

  async function consumir() {
    while (proximo < fila.length) {
      const atual = fila[proximo]
      proximo += 1
      try {
        await worker(atual)
      } catch (erro) {
        // Um host problemático (endereço malformado, ping travado) NÃO pode
        // derrubar o ciclo inteiro — os outros 499 precisam do resultado.
        worker.aoFalhar?.(atual, erro)
      }
    }
  }

  const trabalhadores = Math.max(1, Math.min(concorrencia, fila.length))
  await Promise.all(Array.from({ length: trabalhadores }, () => consumir()))
}

/** Sondagem padrão: ICMP e, se não responder, as portas TCP da faixa. */
function criarSondador({ timeoutPingMs, timeoutPortaMs, logger }) {
  return async function sondar(host) {
    const icmp = await ping(host.ip, timeoutPingMs)

    if (icmp.ok) {
      return { status: 'online', metodo: 'icmp', latenciaMs: icmp.latencyMs, ttl: icmp.ttl }
    }

    // ICMP pode ter sido bloqueado. Se nem o binário existe (`ok === null`), as
    // portas ainda decidem; se não houver porta configurada, é falha de
    // configuração do serviço, não do equipamento — e a tela precisa distinguir.
    if (host.portas.length > 0) {
      const respostas = await Promise.all(
        host.portas.map((porta) => sondaTcp(host.ip, porta, timeoutPortaMs)),
      )
      const aberta = respostas.findIndex((r) => r.ok)
      if (aberta >= 0) {
        return {
          status: 'online',
          metodo: `tcp:${host.portas[aberta]}`,
          latenciaMs: respostas[aberta].latencyMs,
          ttl: null,
        }
      }
    }

    const semFerramenta = icmp.ok === null && host.portas.length === 0
    if (semFerramenta) {
      logger?.aviso?.(`sonda indisponível para ${host.ip} (${icmp.erro || 'sem porta TCP configurada'})`)
    }

    return {
      status: 'offline',
      metodo: semFerramenta ? 'indisponivel' : host.portas.length > 0 ? 'sem-resposta' : 'icmp',
      latenciaMs: null,
      ttl: null,
    }
  }
}

export class MonitorRede {
  /**
   * @param {object} opcoes
   * @param {object} opcoes.config  resultado de `carregarConfig`
   * @param {Array}  [opcoes.faixas] grupos exibidos na tela
   * @param {Array}  [opcoes.hosts]  endereços já expandidos
   * @param {Function} [opcoes.sondar] sondagem injetada (testes)
   * @param {object} [opcoes.logger]
   */
  constructor({ config, faixas = [], hosts = [], sondar = null, logger = console }) {
    this.config = config
    this.faixas = faixas
    /**
     * Endereços monitorados.
     *
     * NÃO se chama `this.hosts` de propósito: o método `hosts()` logo abaixo é
     * quem monta a lista da API, e um atributo com o mesmo nome o esconderia
     * (o atributo da instância vence o método do protótipo) — resultado:
     * TypeError em toda requisição de /api/hosts.
     */
    this.alvos = hosts
    this.logger = logger

    this.sondar =
      sondar ??
      criarSondador({
        timeoutPingMs: config.timeoutPingMs,
        timeoutPortaMs: config.timeoutPortaMs,
        logger,
      })

    /** ip → registro de estado (o cache). */
    this.estado = new Map()
    for (const host of this.alvos) {
      this.estado.set(host.ip, {
        ip: host.ip,
        faixa: host.faixa,
        rotulo: host.rotulo,
        equip: host.equip ?? null,
        rede: host.rede ?? null,
        portas: host.portas,
        status: 'desconhecido',
        metodo: null,
        latenciaMs: null,
        ttl: null,
        verificadoEm: null,
        onlineDesde: null,
        offlineDesde: null,
        alternancias: 0,
        totalVerificacoes: 0,
        historico: '',
      })
    }

    this.emAndamento = false
    this.ultimaVarreduraEm = null
    this.duracaoVarreduraMs = null
    this.proximaVarreduraEm = null
    this.totalVarreduras = 0
    this.ultimaForcadaEm = 0

    // DEFESA: o `sondar` é a única porta de entrada de resultado externo.
    // Se ele lançar, `comPool` engole e o host fica "desconhecido" para sempre
    // sem registro — indetectável na tela. Este wrap garante que qualquer
    // falha vire estado visível.
    const sondarOriginal = this.sondar
    this.sondar = async (host) => {
      try {
        return await sondarOriginal(host)
      } catch (erro) {
        logger.erro?.(`falha ao sondar ${host.ip}: ${erro?.message ?? erro}`)
        return { status: 'indisponivel', metodo: 'falha', latenciaMs: null, ttl: null }
      }
    }
  }

  /** Aplica um resultado ao cache e detecta mudança de estado. */
  registrar(registro, resultado) {
    const agora = Date.now()
    const mudou = registro.status !== 'desconhecido' && registro.status !== resultado.status

    registro.status = resultado.status
    registro.metodo = resultado.metodo
    registro.latenciaMs = resultado.latenciaMs
    registro.ttl = resultado.ttl
    registro.verificadoEm = agora
    registro.totalVerificacoes += 1

    if (mudou) registro.alternancias += 1

    if (resultado.status === 'online') {
      if (mudou || registro.onlineDesde === null) {
        registro.onlineDesde = agora
        registro.offlineDesde = null
      }
    } else if (mudou || registro.offlineDesde === null) {
      registro.offlineDesde = agora
      registro.onlineDesde = null
    }

    // Histórico em string ("10110"): 30 caracteres por host em vez de 30
    // objetos — o payload de 500 hosts encolhe e o front só precisa pintar.
    registro.historico = (registro.historico + (resultado.status === 'online' ? '1' : '0')).slice(
      -this.config.historico,
    )
  }

  async varrer() {
    // Ciclos não se sobrepõem: se a rede estiver lenta (VPN caída, host que
    // segura o timeout), a próxima rodada é pulada em vez de empilhar.
    if (this.emAndamento) {
      this.logger.aviso?.('varredura anterior ainda em andamento — ciclo pulado')
      return null
    }

    this.emAndamento = true
    const inicio = performance.now()
    const inicioAbsoluto = Date.now()

    try {
      await comPool(
        this.alvos,
        this.config.concorrencia,
        async (host) => {
          const resultado = await this.sondar(host)
          this.registrar(this.estado.get(host.ip), resultado)
        },
      )
    } finally {
      this.emAndamento = false
      this.ultimaVarreduraEm = inicioAbsoluto
      this.duracaoVarreduraMs = Math.round(performance.now() - inicio)
      this.proximaVarreduraEm = inicioAbsoluto + this.config.intervaloSegundos * 1000
      this.totalVarreduras += 1
    }

    const resumo = this.resumo()
    this.logger.info?.(
      `varredura #${this.totalVarreduras}: ${resumo.online} online, ${resumo.offline} offline ` +
        `de ${resumo.total} em ${this.duracaoVarreduraMs} ms`,
    )
    return resumo
  }

  /** Totais + quebra por faixa. É o que alimenta os cartões de topo. */
  resumo() {
    const hosts = []
    for (const registro of this.estado.values()) hosts.push(registro)

    const porFaixa = new Map(
      this.faixas.map((f) => [
        f.id,
        {
          id: f.id,
          rotulo: f.rotulo,
          total: 0,
          online: 0,
          offline: 0,
          desconhecido: 0,
          /*
           * Preenchido DEPOIS do laço, com `offline > 0 ? 1 : 0`.
           *
           * Contar aqui dentro do laço daria um número por endereço, não por
           * escola — e é justamente essa a confusão que o campo existe para
           * desfazer: 6 endereços fora do ar na mesma escola são UMA ocorrência,
           * quase sempre um equipamento ou um enlace que caiu, não seis defeitos.
           */
          gruposComProblema: 0,
        },
      ]),
    )

    /*
     * Quebra por rede (ADM/PED).
     *
     * Existe para responder "a rede administrativa ou a pedagógica está com
     * problema?". São atribuições diferentes: a ADM é o acesso gerencial, a PED
     * é gravação e projeção. Um painel que só diz "12 fora do ar" não separa
     * "12 escolas sem acesso" de "12 escolas sem gravação" — que são urgências
     * diferentes, com quem resolve cada uma.
     *
     * Só entram as redes declaradas: um endereço sem `rede` não é inventado
     * aqui, senão o painel mostraria uma terceira coluna sem significado.
     */
    const porRede = new Map()

    let online = 0
    let offline = 0
    let desconhecido = 0
    let somaLatencia = 0
    let comLatencia = 0
    let maxLatencia = 0
    let caidosAgora = 0

    for (const h of hosts) {
      const faixa = porFaixa.get(h.faixa)
      if (faixa) {
        faixa.total += 1
        if (h.status === 'online') faixa.online += 1
        else if (h.status === 'offline') faixa.offline += 1
        else faixa.desconhecido += 1
      }

      if (h.rede) {
        let rede = porRede.get(h.rede)
        if (!rede) {
          rede = { id: h.rede, total: 0, online: 0, offline: 0, desconhecido: 0 }
          porRede.set(h.rede, rede)
        }
        rede.total += 1
        if (h.status === 'online') rede.online += 1
        else if (h.status === 'offline') rede.offline += 1
        else rede.desconhecido += 1
      }

      if (h.status === 'online') {
        online += 1
        if (h.latenciaMs !== null) {
          somaLatencia += h.latenciaMs
          comLatencia += 1
          if (h.latenciaMs > maxLatencia) maxLatencia = h.latenciaMs
        }
      } else if (h.status === 'offline') {
        offline += 1
        // Queda de agora é transição real, não "já estava offline".
        if (h.offlineDesde && h.offlineDesde >= (this.ultimaVarreduraEm ?? 0) - this.config.intervaloSegundos * 1000) {
          caidosAgora += 1
        }
      } else {
        desconhecido += 1
      }
    }

    for (const faixa of porFaixa.values()) {
      faixa.gruposComProblema = faixa.offline > 0 ? 1 : 0
    }

    const total = hosts.length
    const respondidos = online + offline

    return {
      total,
      online,
      offline,
      desconhecido,
      caidosAgora,
      percentualOnline: total > 0 && respondidos > 0 ? Number(((online / respondidos) * 100).toFixed(1)) : 0,
      latenciaMediaMs: comLatencia > 0 ? Number((somaLatencia / comLatencia).toFixed(1)) : null,
      latenciaMaximaMs: comLatencia > 0 ? maxLatencia : null,
      porFaixa: [...porFaixa.values()],
      porRede: [...porRede.values()],
      emAndamento: this.emAndamento,
      ultimaVarreduraEm: this.ultimaVarreduraEm,
      proximaVarreduraEm: this.proximaVarreduraEm,
      duracaoVarreduraMs: this.duracaoVarreduraMs,
      intervaloSegundos: this.config.intervaloSegundos,
      totalVarreduras: this.totalVarreduras,
      concorrencia: this.config.concorrencia,
      timeoutPingMs: this.config.timeoutPingMs,
      configEm: this.config.caminho,
    }
  }

  /** Lista completa de hosts (o front filtra, ordena e pagina em memória). */
  hosts() {
    return [...this.estado.values()].map((r) => ({
      ip: r.ip,
      faixa: r.faixa,
      rotulo: r.rotulo,
      equip: r.equip,
      rede: r.rede,
      portas: r.portas,
      status: r.status,
      metodo: r.metodo,
      latenciaMs: r.latenciaMs,
      ttl: r.ttl,
      verificadoEm: r.verificadoEm,
      onlineDesde: r.onlineDesde,
      offlineDesde: r.offlineDesde,
      alternancias: r.alternancias,
      historico: r.historico,
    }))
  }

  snapshot() {
    return { geradoEm: Date.now(), ...this.resumo(), hosts: this.hosts() }
  }
}