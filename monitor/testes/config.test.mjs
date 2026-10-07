import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { carregarConfig, ipParaNumero, normalizarId } from '../src/config.mjs'

/* ---------------- IP ---------------- */

test('ipParaNumero converte para número de 32 bits sem estourar', () => {
  assert.equal(ipParaNumero('10.109.121.194'), ((10 * 256 + 109) * 256 + 121) * 256 + 194)
  assert.equal(ipParaNumero('0.0.0.0'), 0)
  assert.equal(ipParaNumero('255.255.255.255'), 0xffffffff)
})

test('ipParaNumero rejeita o que não é IPv4', () => {
  for (const invalido of ['10.20.1', '10.20.1.256', '10.20.1.a', '', '10.20.1.7/24', null, undefined]) {
    assert.throws(() => ipParaNumero(invalido), /IPv4 inválido/)
  }
})

test('normalizarId vira id amigável do nome da escola', () => {
  assert.equal(normalizarId('E.E. JARDIM DOM ANGELICO'), 'e-e-jardim-dom-angelico')
  assert.equal(normalizarId('E.E. Zípora Rubinstein'), 'e-e-zipora-rubinstein')
  assert.equal(normalizarId(''), '')
})

/* ---------------- Configuração ---------------- */

function escreverConfig(objeto) {
  const pasta = mkdtempSync(join(tmpdir(), 'monitor-cfg-'))
  const caminho = join(pasta, 'config.json')
  writeFileSync(caminho, JSON.stringify(objeto), 'utf8')
  return caminho
}

test('expande DVR com hostname, tipo e escola', () => {
  const caminho = escreverConfig({
    faixas: [
      {
        id: 'escola-1',
        rotulo: 'E.E. JARDIM DOM ANGELICO',
        ips: [
          { ip: '10.109.121.194', hostname: 'VIDEO-DVR1', tipo: 'ADM' },
          { ip: '10.116.239.20', hostname: 'VIDEO-DVR1', tipo: 'PED' },
        ],
      },
    ],
  })

  const { config, faixas, hosts, avisos } = carregarConfig(caminho)

  assert.equal(hosts.length, 2)
  assert.deepEqual(avisos, [])
  assert.equal(faixas[0].rotulo, 'E.E. JARDIM DOM ANGELICO')
  assert.equal(faixas[0].total, 2)

  const adm = hosts.find((h) => h.tipo === 'ADM')
  assert.equal(adm.ip, '10.109.121.194')
  assert.equal(adm.hostname, 'VIDEO-DVR1')
  assert.equal(adm.faixa, 'escola-1')
  assert.equal(adm.escola, 'E.E. JARDIM DOM ANGELICO')
  assert.equal(adm.escolaId, '1')

  // Faixa sem "portas" usa as padrão da raiz.
  assert.deepEqual(config.portasPadrao, [])
})

test('faixa sem id recebe "escola-N" pela ordem', () => {
  const caminho = escreverConfig({
    faixas: [
      { rotulo: 'E.E. A', ips: [{ ip: '10.0.0.1', hostname: 'VIDEO-DVR1', tipo: 'ADM' }] },
      { rotulo: 'E.E. B', ips: [{ ip: '10.0.0.2', hostname: 'VIDEO-DVR2', tipo: 'PED' }] },
    ],
  })
  const { faixas, hosts } = carregarConfig(caminho)
  assert.equal(faixas[0].id, 'escola-1')
  assert.equal(faixas[1].id, 'escola-2')
  assert.equal(hosts[1].faixa, 'escola-2')
})

test('portas da faixa substituem as padrão; ausentes herdam as padrão', () => {
  const caminho = escreverConfig({
    portasPadrao: [80],
    faixas: [
      { id: 'a', rotulo: 'E.E. A', portas: [554, 8000], ips: [{ ip: '10.0.0.1', hostname: 'VIDEO-DVR1', tipo: 'ADM' }] },
      { id: 'b', rotulo: 'E.E. B', ips: [{ ip: '10.0.0.2', hostname: 'VIDEO-DVR2', tipo: 'ADM' }] },
    ],
  })
  const { hosts } = carregarConfig(caminho)
  assert.deepEqual(hosts.find((h) => h.faixa === 'a').portas, [554, 8000])
  assert.deepEqual(hosts.find((h) => h.faixa === 'b').portas, [80])
})

test('endereço repetido em duas escolas avisa e monitora uma vez só', () => {
  const caminho = escreverConfig({
    faixas: [
      { id: 'a', rotulo: 'E.E. A', ips: [{ ip: '10.0.0.1', hostname: 'VIDEO-DVR1', tipo: 'ADM' }] },
      { id: 'b', rotulo: 'E.E. B', ips: [{ ip: '10.0.0.1', hostname: 'VIDEO-DVR2', tipo: 'ADM' }] },
    ],
  })
  const { hosts, avisos } = carregarConfig(caminho)
  assert.equal(hosts.length, 1)
  assert.equal(avisos.length, 1)
  assert.match(avisos[0], /aparece em/)
})

test('hostname e tipo inválidos são recusados com a posição na mensagem', () => {
  const caminho = escreverConfig({
    faixas: [
      {
        id: 'x',
        rotulo: 'E.E. X',
        ips: [
          { ip: '10.0.0.1', hostname: 'CAM1', tipo: 'ADM' },
          { ip: '10.0.0.2', hostname: 'VIDEO-DVR2', tipo: 'Terceira' },
        ],
      },
    ],
  })
  assert.throws(
    () => carregarConfig(caminho),
    (erro) => {
      assert.match(erro.message, /hostname inválido/)
      assert.match(erro.message, /tipo inválido/)
      return true
    },
  )
})

test('faixa sem nome ou sem IP não sobe o serviço', () => {
  assert.throws(
    () =>
      carregarConfig(
        escreverConfig({ faixas: [{ ips: [{ ip: '10.0.0.1', hostname: 'VIDEO-DVR1', tipo: 'ADM' }] }] }),
      ),
    /rotulo" é obrigatório/,
  )
  assert.throws(
    () => carregarConfig(escreverConfig({ faixas: [{ rotulo: 'E.E. VAZIA', ips: [] }] })),
    /está vazio/,
  )
  assert.throws(() => carregarConfig(escreverConfig({ faixas: [] })), /"faixas" está vazio/)
})

test('teto de endereços protege contra manifesto escrito sem querer', () => {
  const caminho = escreverConfig({
    limiteHosts: 3,
    faixas: [
      {
        id: 'a',
        rotulo: 'E.E. A',
        ips: [
          { ip: '10.0.0.1', hostname: 'VIDEO-DVR1', tipo: 'ADM' },
          { ip: '10.0.0.2', hostname: 'VIDEO-DVR2', tipo: 'ADM' },
          { ip: '10.0.0.3', hostname: 'VIDEO-DVR3', tipo: 'ADM' },
          { ip: '10.0.0.4', hostname: 'VIDEO-DVR1', tipo: 'PED' },
          { ip: '10.0.0.5', hostname: 'VIDEO-DVR2', tipo: 'PED' },
        ],
      },
    ],
  })
  assert.throws(() => carregarConfig(caminho), /mais de 3 endereços/)
})

test('variáveis de ambiente sobrescrevem o arquivo', () => {
  const caminho = escreverConfig({
    intervaloSegundos: 30,
    faixas: [{ id: 'a', rotulo: 'E.E. A', ips: [{ ip: '10.0.0.1', hostname: 'VIDEO-DVR1', tipo: 'ADM' }] }],
  })
  const { config } = carregarConfig(caminho, { INTERVALO_SEGUNDOS: '15', PORTA: '4321', CONCORRENCIA: '8' })
  assert.equal(config.intervaloSegundos, 15)
  assert.equal(config.porta, 4321)
  assert.equal(config.concorrencia, 8)
})

test('intervalo abaixo do mínimo é recusado em vez de virar rajada de ping', () => {
  const caminho = escreverConfig({
    intervaloSegundos: 1,
    faixas: [{ id: 'a', rotulo: 'E.E. A', ips: [{ ip: '10.0.0.1', hostname: 'VIDEO-DVR1', tipo: 'ADM' }] }],
  })
  assert.throws(() => carregarConfig(caminho), /intervaloSegundos/)
})

test('arquivo salvo com BOM (padrão do Bloco de Notas) é lido', () => {
  const pasta = mkdtempSync(join(tmpdir(), 'monitor-bom-'))
  const caminho = join(pasta, 'config.json')
  writeFileSync(
    caminho,
    '﻿' +
      JSON.stringify({
        faixas: [{ id: 'a', rotulo: 'E.E. A', ips: [{ ip: '10.0.0.1', hostname: 'VIDEO-DVR1', tipo: 'ADM' }] }],
      }),
    'utf8',
  )
  assert.equal(carregarConfig(caminho).hosts.length, 1)
})

test('um IP malformado não esconde os erros das outras faixas', () => {
  const caminho = escreverConfig({
    faixas: [
      { id: 'a', rotulo: 'E.E. A', ips: [{ ip: '10.0.0.999', hostname: 'VIDEO-DVR1', tipo: 'ADM' }] },
      { id: 'a', rotulo: 'E.E. A DUP', ips: [{ ip: '10.0.0.2', hostname: 'VIDEO-DVR2', tipo: 'ADM' }] },
      { id: 'b', ips: [{ ip: '10.0.0.3', hostname: 'VIDEO-DVR1', tipo: 'ADM' }] },
      { id: 'c', rotulo: 'E.E. C', ips: [] },
    ],
  })
  assert.throws(
    () => carregarConfig(caminho),
    (erro) => {
      const msg = erro.message
      assert.match(msg, /IPv4 inválido/)
      // A duplicidade de "a" precisa aparecer mesmo com a 1ª ocorrência com erro.
      assert.match(msg, /duplicado: "a"/)
      assert.match(msg, /rotulo" é obrigatório/)
      assert.match(msg, /está vazio/)
      return true
    },
  )
})

test('arquivo inexistente e JSON quebrado dizem qual arquivo', () => {
  assert.throws(() => carregarConfig(join(tmpdir(), 'nao-existe-monitor.json')), /não foi possível ler/)

  const pasta = mkdtempSync(join(tmpdir(), 'monitor-quebrado-'))
  const caminho = join(pasta, 'config.json')
  writeFileSync(caminho, '{ "faixas": [ }', 'utf8')
  assert.throws(() => carregarConfig(caminho), /configuração inválida/)
})