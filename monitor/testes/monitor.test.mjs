import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import net from 'node:net'
import { MonitorRede, comPool } from '../src/monitor.mjs'
import { ping, sondaTcp } from '../src/probe.mjs'

/* ---------------- pool ---------------- */

test('comPool respeita o limite de concorrência', async () => {
  let emVoo = 0
  let maximoVisto = 0
  let processados = 0

  await comPool(Array.from({ length: 40 }, (_, i) => i), 6, async () => {
    emVoo += 1
    maximoVisto = Math.max(maximoVisto, emVoo)
    await new Promise((r) => setTimeout(r, 5))
    processados += 1
    emVoo -= 1
  })

  assert.equal(processados, 40)
  assert.ok(maximoVisto <= 6, `concorrência estourou: ${maximoVisto}`)
  assert.ok(maximoVisto > 1, 'o pool não paralelizou nada')
})

test('um item que falha não derruba os demais', async () => {
  const feitos = []

  await comPool([1, 2, 3, 4], 2, async (n) => {
    if (n === 2) throw new Error('host travado')
    feitos.push(n)
  })

  assert.deepEqual(feitos.sort(), [1, 3, 4])
})

test('fila vazia não trava e não cria trabalhadores inúteis', async () => {
  await comPool([], 8, () => {
    throw new Error('não deveria ser chamado')
  })
})

/* ---------------- sondagem injetada ---------------- */

function monitorDeTeste(hosts, sondar, config = {}) {
  const faixas = [{ id: 'lab', rotulo: 'Laboratório' }]
  const lista = hosts.map((ip) => ({ ip, faixa: 'lab', rotulo: 'Laboratório', portas: [445] }))
  return new MonitorRede({
    config: {
      intervaloSegundos: 30,
      concorrencia: 8,
      timeoutPingMs: 1000,
      timeoutPortaMs: 500,
      historico: 5,
      limiteHosts: 5000,
      portasPadrao: [445],
      caminho: 'teste',
      ...config,
    },
    faixas,
    hosts: lista,
    sondar,
    logger: { info: () => {}, aviso: () => {} },
  })
}

const ONLINE = { status: 'online', metodo: 'icmp', latenciaMs: 3, ttl: 128 }
const OFFLINE = { status: 'offline', metodo: 'icmp', latenciaMs: null, ttl: null }

test('primeira varredura marca todos como desconhecidos até haver resultado', async () => {
  const m = monitorDeTeste(['10.0.0.1'], async () => OFFLINE)
  assert.equal(m.hosts()[0].status, 'desconhecido')

  await m.varrer()
  const [host] = m.hosts()
  assert.equal(host.status, 'offline')
  assert.equal(host.offlineDesde !== null, true)
  assert.equal(host.onlineDesde, null)
})

test('varredura registra transição, alternâncias e tempo no estado atual', async () => {
  let resposta = OFFLINE
  const m = monitorDeTeste(['10.0.0.1'], async () => resposta)

  await m.varrer()
  assert.equal(m.hosts()[0].status, 'offline')

  resposta = ONLINE
  await m.varrer()
  let host = m.hosts()[0]
  assert.equal(host.status, 'online')
  assert.equal(host.alternancias, 1)
  assert.equal(host.offlineDesde, null)
  assert.ok(host.onlineDesde !== null)

  await m.varrer()
  host = m.hosts()[0]
  assert.equal(host.alternancias, 1, 'permanecer online não é uma nova alternância')

  resposta = OFFLINE
  await m.varrer()
  assert.equal(m.hosts()[0].alternancias, 2)
})

test('histórico é limitado e do mais antigo para o mais novo', async () => {
  const respostas = [ONLINE, OFFLINE, ONLINE, OFFLINE, ONLINE, OFFLINE]
  let i = 0
  const m = monitorDeTeste(['10.0.0.1'], async () => respostas[i++], { historico: 4 })

  for (let c = 0; c < 6; c += 1) await m.varrer()

  assert.equal(m.hosts()[0].historico.length, 4)
  assert.equal(m.hosts()[0].historico, '1010')
})

test('resumo agrega totais, percentual e quebra por faixa', async () => {
  const m = monitorDeTeste(['10.0.0.1', '10.0.0.2', '10.0.0.3', '10.0.0.4'], async (host) =>
    host.ip.endsWith('1') || host.ip.endsWith('2') ? ONLINE : OFFLINE,
  )

  await m.varrer()
  const r = m.resumo()

  assert.equal(r.total, 4)
  assert.equal(r.online, 2)
  assert.equal(r.offline, 2)
  assert.equal(r.desconhecido, 0)
  assert.equal(r.percentualOnline, 50)
  assert.equal(r.latenciaMediaMs, 3)
  assert.equal(r.porFaixa[0].online, 2)
  assert.equal(r.porFaixa[0].offline, 2)
  assert.equal(r.ultimaVarreduraEm !== null, true)
  assert.ok(r.proximaVarreduraEm > r.ultimaVarreduraEm)
})

test('varredura em andamento não se sobrepõe à seguinte', async () => {
  let liberar
  const trava = new Promise((r) => {
    liberar = r
  })
  const m = monitorDeTeste(['10.0.0.1', '10.0.0.2'], async () => {
    await trava
    return ONLINE
  })

  const primeira = m.varrer()
  const segunda = await m.varrer()
  assert.equal(segunda, null, 'a segunda varredura deveria ser pulada, não empilhada')

  liberar()
  assert.ok(await primeira)
  assert.equal(m.emAndamento, false)
})

test('snapshot entrega resumo + lista no mesmo payload', async () => {
  const m = monitorDeTeste(['10.0.0.1'], async () => ONLINE)
  await m.varrer()

  const snap = m.snapshot()
  assert.equal(snap.total, 1)
  assert.equal(snap.hosts.length, 1)
  assert.equal(snap.hosts[0].ip, '10.0.0.1')
  assert.ok(snap.geradoEm > 0)
  // O estado interno não pode vazar por referência (o cache muda a cada ciclo).
  assert.notEqual(snap.hosts[0], m.estado.get('10.0.0.1'))
})

/* ---------------- sondas reais (loopback, sem depender da rede) ---------------- */

test('sondaTcp acha a porta aberta e recusa a porta fechada', async () => {
  const servidor = createServer((_req, res) => res.end('ok'))
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r))
  const { port } = servidor.address()
  const portaFechada = await new Promise((r) => {
    const s = net.createServer()
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port
      s.close(() => r(p))
    })
  })

  try {
    const aberta = await sondaTcp('127.0.0.1', port, 1000)
    assert.equal(aberta.ok, true)
    assert.equal(typeof aberta.latencyMs, 'number')

    // "connection refused" precisa virar {ok:false} — não exceção não tratada,
    // que derrubaria o serviço inteiro no meio da varredura.
    const fechada = await sondaTcp('127.0.0.1', portaFechada, 1000)
    assert.equal(fechada.ok, false)
  } finally {
    await new Promise((r) => servidor.close(r))
  }
})

test('sondaTcp respeita o tempo limite em endereço que não responde', async () => {
  // 203.0.113.0/24 é faixa reservada para documentação (RFC 5737): nada
  // responde, então o resultado tem que ser "não" no prazo, não pendurado.
  const inicio = Date.now()
  const r = await sondaTcp('203.0.113.1', 9, 300)
  assert.equal(r.ok, false)
  assert.ok(Date.now() - inicio < 2000)
})

test('ping no próprio loopback responde e traz latência/TTL', async () => {
  const r = await ping('127.0.0.1', 2000)
  assert.equal(r.ok, true)
  assert.equal(typeof r.latencyMs, 'number')
  assert.ok(r.ttl === null || typeof r.ttl === 'number')
})

test('ping em endereço que não responde devolve offline (não exceção)', async () => {
  const r = await ping('203.0.113.1', 400)
  assert.equal(r.ok, false)
  assert.equal(r.latencyMs, null)
})