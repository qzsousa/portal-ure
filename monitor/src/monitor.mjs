/**
 * Motor de monitoramento: pool de concorrência, cache de estado e agregações.
 *
 * As três decisões que sustentam centenas de DVRs:
 *
 *  1. CONCORRÊNCIA. Ping de 432 câmeras em série, com 1 s de timeout, leva
 *     minutos. Com pool, a rede inteira sai em segundos — rápido o bastante
 *     para atualizar o painel a cada ciclo.
 *  2. CACHE COM CICLO. A varredura roda agendada (30 s por padrão) e a API lê o
 *     resultado pronto. Nenhum clique na tela dispara ping: 10 pessoas com o
 *     painel aberto não podem virar um flood na rede.
 *  3. DOMÍNIO. O cache leva os campos da câmera (escola, hostname
 *     VIDEO-DVRn, tipo ADM/PED) para que as agregações por escola e por rede
 *     parem de ser reescritas no fronte.
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
        worker.aoFalhar?.(atual, erro)
      }
    }
  }

  const trabalhadores = Math.max(1, Math.min(concorrencia, fila.length))
  await Promise.all(Array.from({ length: trabalhadores }, () => consumir()))
}

/** Sonda padrão: ICMP primeiro; se não responder, as portas TCP da faixa. */
function criarSondador({ timeoutPingMs, timeoutPortaMs, logger }) {
  return async function sondar(host) {
    const icmp = await ping(host.ip, timeoutPingMs)

    if (icmp.ok) {
      return { status: 'online', metodo: 'icmp', latenciaMs: icmp.latencyMs, ttl: icmp.ttl }
    }

    // ICMP pode ter sido filtrado. Se nem o binário existe (`ok === null`), as
    // portas ainda decidem; sem porta configurada é a máquina do monitor que
    // está mal montada, não a câmera.
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
      logger?.aviso?.(
        `sonda indisponível para ${host.ip} (${icmp.erro || 'sem porta TCP configurada'})`,
      )
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
   * @param {Array}  [opcoes.faixas] grupos exibidos na tela (escolas)
   * @param {Array}  [opcoes.hosts]  endereços já com hostname/tipo/escola
   * @param {Function} [opcoes.sondar] sondagem injetada (testes)
   * @param {object} [opcoes.logger]
   */
  constructor({ config, faixas = [], hosts = [], sondar = null, logger = console }) {
    this.config = config
    this.faixas = faixas
    /**
     * Endereços monitorados.
     *
     * NÃO se chama `this.hosts`: o método `hosts()` logo abaixo monta a lista
     * da API, e um atributo com o mesmo nome o esconde (o da instância vence o
     * do protótipo) — resultado: TypeError em toda requisição a /api/hosts.
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
    for (const alvo of this.alvos) {
      this.estado.set(alvo.numero, {
        // Domínio: quem é a câmera
        ip: alvo.ip,
        numero: alvo.numero,
        hostname: alvo.hostname,
        tipo: alvo.tipo,
        faixa: alvo.faixa,
        escolaId: alvo.escolaId,
        escola: alvo.escola,
        portas: alvo.portas,
        // Dinâmico: como ela está
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

    // DEFESA: `sondar` é a única porta de resultado externo. Se lançar, `comPool`
    // engole e o host ficaria "desconhecido" para sempre — invisível na tela. O
    // wrap transforma qualquer falha em estado visível.
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

  /** Aplica o resultado de uma sondagem ao cache e detecta transição de estado. */
  registrar(registro, resultado) {
    const agora = Date.now()
    const mudou = registro.status !== 'desconhecido' && registro.status !== resultado.status

    registro.status = resultado.status
    registro.metodo = resultado.metodo
    registro.latenciaMs = resultado.latenciaMs
    registro.ttl = resultado.ttl
    registro.verificadoEm = agora
    registro.totalVerificacoes += 1

    // A contagem é BIDIRECIONAL. Contar só a subida (offline→online) deixaria a
    // câmera que caiu e não voltou com zero alternâncias — exatamente o caso
    // mais comum de atendimento apareceria limpo.
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

    // Histórico como STRING "10110": 30 caracteres por host em vez de 30
    // objetos. O fronte só pinta; não precisa de objeto para isso.
    registro.historico = (registro.historico + (resultado.status === 'online' ? '1' : '0')).slice(
      -this.config.historico,
    )
  }

  async varrer() {
    if (this.emAndamento) {
      this.logger.aviso?.('varredura anterior ainda em andamento — ciclo pulado')
      return null
    }

    this.emAndamento = true
    const inicio = performance.now()
    const inicioAbsoluto = Date.now()

    try {
      await comPool(this.alvos, this.config.concorrencia, async (host) => {
        const resultado = await this.sondar(host)
        this.registrar(this.estado.get(host.numero), resultado)
      })
    } finally {
      this.emAndamento = false
      this.ultimaVarreduraEm = inicioAbsoluto
      this.duracaoVarreduraMs = Math.round(performance.now() - inicio)
      this.proximaVarreduraEm = inicioAbsoluto + this.config.intervaloSegundos * 1000
      this.totalVarreduras += 1
    }

    const resumo = this.resumo()
    this.logger.info?.(
      `varredura #${this.totalVarreduras}: ${resumo.online} ligadas, ${resumo.offline} desligadas ` +
        `de ${resumo.total} em ${this.duracaoVarreduraMs} ms`,
    )
    return resumo
  }

  /** Totais + quebra por escola e por tipo (ADM/PED), tudo o painel usa. */
  resumo() {
    const hosts = [...this.estado.values()]

    // Map em vez de varrer a lista: com 72 escolas e 432 pings, o lookup por
    // id precisa ser O(1), não O(n).
    const porFaixa = new Map(
      this.faixas.map((f) => [
        f.id,
        {
          id: f.id,
          rotulo: f.rotulo,
          escolaId: f.escolaId,
          total: 0,
          online: 0,
          offline: 0,
          desconhecido: 0,
          adm: { online: 0, offline: 0 },
          ped: { online: 0, offline: 0 },
        },
      ]),
    )

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

        if (h.tipo === 'ADM') {
          if (h.status === 'online') faixa.adm.online += 1
          else if (h.status === 'offline') faixa.adm.offline += 1
        } else if (h.tipo === 'PED') {
          if (h.status === 'online') faixa.ped.online += 1
          else if (h.status === 'offline') faixa.ped.offline += 1
        }
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
        // Queda de agora é transição real, não "já estava desligada".
        if (
          h.offlineDesde &&
          h.offlineDesde >= (this.ultimaVarreduraEm ?? 0) - this.config.intervaloSegundos * 1000
        ) {
          caidosAgora += 1
        }
      } else {
        desconhecido += 1
      }
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

  /** Lista completa de DVRs (o fronte filtra, ordena e pagina em memória). */
  hosts() {
    return [...this.estado.values()].map((r) => ({
      ip: r.ip,
      numero: r.numero,
      hostname: r.hostname,
      tipo: r.tipo,
      faixa: r.faixa,
      escolaId: r.escolaId,
      escola: r.escola,
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