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

test('um item que falha no worker não derruba os demais', async () => {
  const feitos = []
  await comPool([1, 2, 3, 4], 2, async (n) => {
    if (n === 2) throw new Error('host travado')
    feitos.push(n)
  })
  assert.deepEqual(feitos.sort(), [1, 3, 4])
})

test('fila vazia não trava', async () => {
  await comPool([], 8, () => {
    throw new Error('não deveria ser chamado')
  })
})

/* ---------------- motor com sondagem injetada ---------------- */

const ONLINE = { status: 'online', metodo: 'icmp', latenciaMs: 3, ttl: 128 }
const OFFLINE = { status: 'offline', metodo: 'icmp', latenciaMs: null, ttl: null }

function monitorDeTeste(dvrs, sondar, cfgExtra = {}) {
  const lista = dvrs.map(([ip, escola, hostname, tipo]) => ({
    ip,
    numero: ip,
    hostname,
    tipo,
    escolaId: escola,
    escola,
    faixa: escola,
    portas: [80],
  }))
  const faixas = [...new Set(lista.map((h) => h.faixa))].map((id) => ({
    id,
    rotulo: id,
    escolaId: id,
    total: lista.filter((h) => h.faixa === id).length,
  }))
  return new MonitorRede({
    config: {
      intervaloSegundos: 30,
      concorrencia: 8,
      timeoutPingMs: 1000,
      timeoutPortaMs: 400,
      historico: 6,
      limiteHosts: 5000,
      portasPadrao: [80],
      caminho: 'teste',
      ...cfgExtra,
    },
    faixas,
    hosts: lista,
    sondar,
    logger: { info: () => {}, aviso: () => {}, erro: () => {} },
  })
}

test('sem varredura ainda: todo DVR começa como desconhecido', () => {
  const m = monitorDeTeste([['10.0.0.1', 'e-e-a', 'VIDEO-DVR1', 'ADM']], async () => OFFLINE)
  assert.equal(m.hosts()[0].status, 'desconhecido')
})

test('transição conta em duas direções — desligar também é evento', () => {
  let resposta = OFFLINE
  const m = monitorDeTeste([['10.0.0.1', 'e-e-a', 'VIDEO-DVR1', 'ADM']], async () => resposta)

  return (async () => {
    await m.varrer()
    assert.equal(m.hosts()[0].status, 'offline')

    resposta = ONLINE
    await m.varrer()
    assert.equal(m.hosts()[0].alternancias, 1)

    resposta = OFFLINE
    await m.varrer()
    assert.equal(m.hosts()[0].alternancias, 2, 'a queda ficaria invisível se contasse só a subida')
  })()
})

test('histórico fica dos últimos N ciclos, do mais antigo ao mais novo', async () => {
  const respostas = [ONLINE, OFFLINE, ONLINE, OFFLINE, ONLINE, OFFLINE, ONLINE]
  let i = 0
  const m = monitorDeTeste(
    [['10.0.0.1', 'e-e-a', 'VIDEO-DVR1', 'ADM']],
    async () => respostas[i++],
    { historico: 4 },
  )

  for (let c = 0; c < 7; c += 1) await m.varrer()
  assert.equal(m.hosts()[0].historico.length, 4)
  assert.equal(m.hosts()[0].historico, '0101')
})

test('resumo quebra por escola e por tipo ADM x PED', async () => {
  const dvrs = [
    ['10.0.0.1', 'e-e-a', 'VIDEO-DVR1', 'ADM'],
    ['10.0.0.2', 'e-e-a', 'VIDEO-DVR2', 'ADM'],
    ['10.116.0.1', 'e-e-a', 'VIDEO-DVR1', 'PED'],
    ['10.116.0.2', 'e-e-a', 'VIDEO-DVR2', 'PED'],
    ['10.0.1.1', 'e-e-b', 'VIDEO-DVR1', 'ADM'],
    ['10.0.1.2', 'e-e-b', 'VIDEO-DVR1', 'PED'],
  ]
  const desligados = new Set(['10.0.0.2', '10.116.0.2'])
  const m = monitorDeTeste(dvrs, async (h) => (desligados.has(h.numero) ? OFFLINE : ONLINE))

  await m.varrer()
  const r = m.resumo()

  assert.equal(r.total, 6)
  assert.equal(r.online, 4)
  assert.equal(r.offline, 2)
  assert.equal(r.percentualOnline, 66.7)

  const a = r.porFaixa.find((f) => f.id === 'e-e-a')
  const b = r.porFaixa.find((f) => f.id === 'e-e-b')
  assert.equal(a.online, 2)
  assert.equal(a.offline, 2)
  assert.equal(a.adm.online, 1)
  assert.equal(a.adm.offline, 1)
  assert.equal(a.ped.online, 1)
  assert.equal(a.ped.offline, 1)
  assert.equal(b.online, 2)
  assert.equal(b.offline, 0)
})

test('snapshot entrega resumo + DVRs e não vaza o cache por referência', async () => {
  const m = monitorDeTeste([['10.0.0.1', 'e-e-a', 'VIDEO-DVR1', 'ADM']], async () => ONLINE)
  await m.varrer()
  const snap = m.snapshot()
  assert.equal(snap.total, 1)
  assert.equal(snap.hosts.length, 1)
  assert.equal(snap.hosts[0].hostname, 'VIDEO-DVR1')
  assert.notEqual(snap.hosts[0], m.estado.get('10.0.0.1'))
})

test('varredura em andamento é pulada, não empilhada', async () => {
  let liberar
  const trava = new Promise((r) => {
    liberar = r
  })
  const m = monitorDeTeste(
    [['10.0.0.1', 'e-e-a', 'VIDEO-DVR1', 'ADM']],
    async () => {
      await trava
      return ONLINE
    },
  )

  const primeira = m.varrer()
  const segunda = await m.varrer()
  assert.equal(segunda, null)

  liberar()
  assert.ok(await primeira)
  assert.equal(m.emAndamento, false)
})

test('sonda que lança vira estado visível em vez de "sem resposta" eterno', async () => {
  const m = monitorDeTeste(
    [['10.0.0.1', 'e-e-a', 'VIDEO-DVR1', 'ADM']],
    async () => {
      throw new Error('ping travado')
    },
  )
  await m.varrer()
  assert.equal(m.hosts()[0].status, 'indisponivel')
  assert.equal(m.hosts()[0].metodo, 'falha')
})

/* ---------------- sondas reais (loopback) ---------------- */

test('sondaTcp abre e fecha sem vazar erro para o processo', async () => {
  const servidor = createServer((req, res) => res.end('ok'))
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r))
  const { port: portaAberta } = servidor.address()

  const portaFechada = await new Promise((r) => {
    const s = net.createServer()
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port
      s.close(() => r(p))
    })
  })

  try {
    const aberta = await sondaTcp('127.0.0.1', portaAberta, 800)
    assert.equal(aberta.ok, true)
    assert.equal(typeof aberta.latencyMs, 'number')

    const fechada = await sondaTcp('127.0.0.1', portaFechada, 300)
    assert.equal(fechada.ok, false)
  } finally {
    await new Promise((r) => servidor.close(r))
  }
})

test('sondaTcp respeita o tempo em endereço que não responde', async () => {
  // 203.0.113.x é faixa reservada para documentação (RFC 5737): nada responde.
  const inicio = Date.now()
  const r = await sondaTcp('203.0.113.1', 9, 300)
  assert.equal(r.ok, false)
  assert.ok(Date.now() - inicio < 2000)
})

test('ping no loopback responde com latência e TTL', async () => {
  const r = await ping('127.0.0.1', 2000)
  assert.equal(r.ok, true)
  assert.equal(typeof r.latencyMs, 'number')
})

test('ping em endereço que não responde dá offline, não exceção', async () => {
  const r = await ping('203.0.113.1', 400)
  assert.equal(r.ok, false)
  assert.equal(r.latencyMs, null)
})