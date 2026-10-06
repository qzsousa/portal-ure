import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { carregarConfig, expandirCidr, ipParaNumero, numeroParaIp } from '../src/config.mjs'

/* ---------------- IPv4 ---------------- */

test('ipParaNumero e numeroParaIp fazem ida e volta', () => {
  for (const ip of ['0.0.0.0', '10.20.1.7', '255.255.255.255']) {
    assert.equal(numeroParaIp(ipParaNumero(ip)), ip)
  }
})

test('ipParaNumero rejeita o que não é IPv4', () => {
  for (const invalido of ['10.20.1', '10.20.1.256', '10.20.1.a', '', '10.20.1.7/24', null]) {
    assert.throws(() => ipParaNumero(invalido), /IPv4 inválido/)
  }
})

/* ---------------- CIDR ---------------- */

test('/24 devolve os 254 hosts úteis, sem rede nem broadcast', () => {
  const { primeiro, ultimo, quantidade } = expandirCidr('10.20.1.0/24')
  assert.equal(quantidade, 254)
  assert.equal(numeroParaIp(primeiro), '10.20.1.1')
  assert.equal(numeroParaIp(ultimo), '10.20.1.254')
})

test('/24 normaliza um endereço de rede fora de ordem (10.20.1.77/24)', () => {
  const { primeiro, ultimo } = expandirCidr('10.20.1.77/24')
  assert.equal(numeroParaIp(primeiro), '10.20.1.1')
  assert.equal(numeroParaIp(ultimo), '10.20.1.254')
})

test('/30 e /31: as bordas são hosts legítimos e precisam entrar', () => {
  // Rede corporativa usa /31 para link ponto a ponto. Descartar "rede" e
  // "broadcast" aqui esconderia equipamento real do monitoramento.
  assert.equal(expandirCidr('10.20.1.0/30').quantidade, 2)
  assert.equal(expandirCidr('10.20.1.0/31').quantidade, 2)
  assert.equal(expandirCidr('10.20.1.7/32').quantidade, 1)
})

test('/0 cobre a internet inteira sem estourar a aritmética de 32 bits', () => {
  const { primeiro, ultimo, quantidade } = expandirCidr('0.0.0.0/0')
  assert.equal(primeiro, 1)
  assert.equal(numeroParaIp(ultimo), '255.255.255.254')
  assert.equal(ultimo - primeiro + 1, quantidade)
})

test('máscara fora de 0..32 é recusada com mensagem', () => {
  assert.throws(() => expandirCidr('10.20.1.0/33'), /máscara inválida/)
  assert.throws(() => expandirCidr('10.20.1.0/abc'), /máscara inválida/)
})

/* ---------------- Configuração completa ---------------- */

function escreverConfig(objeto) {
  const pasta = mkdtempSync(join(tmpdir(), 'monitor-cfg-'))
  const caminho = join(pasta, 'config.json')
  writeFileSync(caminho, JSON.stringify(objeto), 'utf8')
  return caminho
}

test('expande cidr + intervalo + ips avulsos, com o rótulo de cada faixa', () => {
  const caminho = escreverConfig({
    faixas: [
      { id: 'lab', rotulo: 'Laboratório', cidr: '10.20.1.0/29' },
      { id: 'ped', rotulo: 'Pedagógica', inicio: '10.20.2.10', fim: '10.20.2.12' },
      { id: 'srv', ips: ['10.20.9.7'] },
    ],
  })

  const { config, faixas, hosts, avisos } = carregarConfig(caminho)

  assert.equal(hosts.length, 6 + 3 + 1)
  assert.deepEqual(avisos, [])
  assert.equal(faixas.length, 3)

  const lab = hosts.filter((h) => h.faixa === 'lab')
  assert.equal(lab[0].ip, '10.20.1.1')
  assert.equal(lab[0].rotulo, 'Laboratório')
  assert.equal(lab.at(-1).ip, '10.20.1.6')

  assert.deepEqual(
    hosts.filter((h) => h.faixa === 'ped').map((h) => h.ip),
    ['10.20.2.10', '10.20.2.11', '10.20.2.12'],
  )
  assert.equal(hosts.find((h) => h.faixa === 'srv').ip, '10.20.9.7')

  // Puxa as portas padrão para as faixas que não declaram as suas.
  assert.deepEqual(config.portasPadrao, [])
})

test('portas da faixa substituem as padrão; ausentes herdam as padrão', () => {
  const caminho = escreverConfig({
    portasPadrao: [445],
    faixas: [
      { id: 'a', cidr: '10.0.0.0/30', portas: [80, 443] },
      { id: 'b', cidr: '10.0.1.0/30' },
    ],
  })
  const { hosts } = carregarConfig(caminho)
  assert.deepEqual(hosts.filter((h) => h.faixa === 'a')[0].portas, [80, 443])
  assert.deepEqual(hosts.filter((h) => h.faixa === 'b')[0].portas, [445])
})

test('endereço repetido em duas faixas vira aviso e é monitorado uma vez só', () => {
  const caminho = escreverConfig({
    faixas: [
      { id: 'a', cidr: '10.0.0.0/30' },
      { id: 'b', ips: ['10.0.0.1', '10.0.0.2'] },
    ],
  })
  const { hosts, avisos } = carregarConfig(caminho)
  assert.equal(hosts.length, 2)
  assert.equal(hosts.filter((h) => h.ip === '10.0.0.1').length, 1)
  assert.equal(avisos.length, 2)
  assert.match(avisos[0], /declarado em "a" e em "b"/)
})

/* ---------------- DVR: ips com equipamento e rede ---------------- */

test('ips como texto herdam o rótulo da faixa e não têm equipamento nem rede', () => {
  const caminho = escreverConfig({ faixas: [{ id: 'lab', rotulo: 'Laboratório', ips: ['10.0.0.1'] }] })
  const [host] = carregarConfig(caminho).hosts
  assert.equal(host.rotulo, 'Laboratório')
  assert.equal(host.equip, null)
  assert.equal(host.rede, null)
})

test('ips como objeto carregam equipamento e rede por endereço', () => {
  // O formato que `gerar-config.mjs` produz: uma escola, seis DVRs, e cada um
  // sabendo qual equipamento é e em qual rede está.
  const caminho = escreverConfig({
    portasPadrao: [554],
    faixas: [
      {
        id: 'ee-alfa',
        rotulo: 'E.E. ALFA',
        ips: [
          { ip: '10.109.105.194', equip: 'VIDEO-DVR1', rede: 'ADM' },
          { ip: '10.109.105.195', equip: 'VIDEO-DVR2', rede: 'ADM' },
          { ip: '10.116.247.20', equip: 'VIDEO-DVR1', rede: 'PED' },
        ],
      },
    ],
  })
  const { hosts } = carregarConfig(caminho)
  assert.equal(hosts.length, 3)
  assert.deepEqual(hosts[0], {
    ip: '10.109.105.194',
    faixa: 'ee-alfa',
    rotulo: 'VIDEO-DVR1',
    equip: 'VIDEO-DVR1',
    rede: 'ADM',
    portas: [554],
  })
  assert.equal(hosts[1].equip, 'VIDEO-DVR2')
  assert.equal(hosts[2].rede, 'PED')
})

test('"rotulo" dentro do objeto é aceito como apelido de "equip"', () => {
  const caminho = escreverConfig({
    faixas: [{ id: 'e', rotulo: 'Escola', ips: [{ ip: '10.0.0.1', rotulo: 'DVR-01', rede: 'ADM' }] }],
  })
  const [host] = carregarConfig(caminho).hosts
  assert.equal(host.equip, 'DVR-01')
  assert.equal(host.rotulo, 'DVR-01')
})

test('metadados em branco caem para null em vez de virar string vazia', () => {
  const caminho = escreverConfig({
    faixas: [{ id: 'e', rotulo: 'Escola', ips: [{ ip: '10.0.0.1', equip: '   ', rede: '' }] }],
  })
  const [host] = carregarConfig(caminho).hosts
  assert.equal(host.equip, null)
  assert.equal(host.rede, null)
  // Sem equipamento, o rótulo volta a ser o da faixa: a escola ainda aparece.
  assert.equal(host.rotulo, 'Escola')
})

test('as duas formas de "ips" convivem na mesma faixa', () => {
  const caminho = escreverConfig({
    faixas: [{ id: 'e', rotulo: 'Escola', ips: ['10.0.0.1', { ip: '10.0.0.2', equip: 'DVR', rede: 'ADM' }] }],
  })
  const hosts = carregarConfig(caminho).hosts
  assert.equal(hosts.length, 2)
  assert.equal(hosts[0].equip, null)
  assert.equal(hosts[1].equip, 'DVR')
})

test('item de "ips" que não é texto nem objeto é recusado dizendo o formato', () => {
  const caminho = escreverConfig({ faixas: [{ id: 'e', rotulo: 'Escola', ips: [123] }] })
  assert.throws(() => carregarConfig(caminho), /precisa ser texto ou \{ip, equip, rede\}/)
})

test('metadados preservam o aviso de endereço repetido', () => {
  // A checagem de duplicidade não pode ser contornada pelo formato novo.
  const caminho = escreverConfig({
    faixas: [
      { id: 'a', ips: ['10.0.0.1'] },
      { id: 'b', ips: [{ ip: '10.0.0.1', equip: 'DVR', rede: 'ADM' }] },
    ],
  })
  const { hosts, avisos } = carregarConfig(caminho)
  assert.equal(hosts.length, 1)
  assert.equal(hosts[0].equip, null, 'o primeiro declarado vence')
  assert.equal(avisos.length, 1)
  assert.match(avisos[0], /10\.0\.0\.1 declarado em "a" e em "b"/)
})

test('cidr continua aceito e não ganha equipamento nem rede', () => {
  const caminho = escreverConfig({ faixas: [{ id: 'lab', rotulo: 'Lab', cidr: '10.0.0.0/30' }] })
  const hosts = carregarConfig(caminho).hosts
  assert.equal(hosts.length, 2)
  assert.equal(hosts[0].equip, null)
  assert.equal(hosts[0].rede, null)
  assert.equal(hosts[0].rotulo, 'Lab')
})

test('erros são juntados numa única exceção (não um por reinício)', () => {
  const caminho = escreverConfig({
    faixas: [
      { id: 'a', cidr: '10.0.0.0/33' },
      { id: 'a', cidr: '10.0.1.0/30' },
      { id: 'b', inicio: '10.0.2.5' },
      { id: 'c', inicio: '10.0.9.10', fim: '10.0.9.1' },
      { id: 'd' },
    ],
  })

  assert.throws(
    () => carregarConfig(caminho),
    (erro) => {
      const texto = erro.message
      assert.match(texto, /máscara inválida/)
      assert.match(texto, /"faixas\[1\]\.id" duplicado/)
      assert.match(texto, /precisa dos DOIS campos/)
      assert.match(texto, /"fim" .* é menor que "inicio"/)
      assert.match(texto, /precisa de "cidr"/)
      // Todos de uma vez: quem lê o log corrige tudo num passo só.
      assert.equal((texto.match(/\n {2}- /g) || []).length, 5)
      return true
    },
  )
})

test('configuração sem faixas não sobe o serviço', () => {
  assert.throws(() => carregarConfig(escreverConfig({ faixas: [] })), /"faixas" está vazio/)
})

test('teto de endereços protege contra faixa escrita sem querer', () => {
  const caminho = escreverConfig({
    limiteHosts: 10,
    faixas: [{ id: 'g', cidr: '10.20.0.0/24' }],
  })
  assert.throws(() => carregarConfig(caminho), /mais de 10 endereços/)
})

test('variáveis de ambiente sobrescrevem o arquivo', () => {
  const caminho = escreverConfig({ intervaloSegundos: 30, faixas: [{ id: 'a', cidr: '10.0.0.0/30' }] })
  const { config } = carregarConfig(caminho, { INTERVALO_SEGUNDOS: '15', PORTA: '4321', CONCORRENCIA: '8' })
  assert.equal(config.intervaloSegundos, 15)
  assert.equal(config.porta, 4321)
  assert.equal(config.concorrencia, 8)
})

test('intervalo abaixo do mínimo é recusado em vez de virar rajada de ping', () => {
  const caminho = escreverConfig({ intervaloSegundos: 1, faixas: [{ id: 'a', cidr: '10.0.0.0/30' }] })
  assert.throws(() => carregarConfig(caminho), /"intervaloSegundos"/)
})

test('arquivo salvo com BOM (padrão do Bloco de Notas no Windows) é lido', () => {
  // O Notepad grava UTF-8 COM BOM; `JSON.parse` rejeita esse caractere com
  // "Unexpected token" e derruba o serviço na subida.
  const pasta = mkdtempSync(join(tmpdir(), 'monitor-bom-'))
  const caminho = join(pasta, 'config.json')
  writeFileSync(
    caminho,
    '﻿' + JSON.stringify({ faixas: [{ id: 'a', cidr: '10.0.0.0/30' }] }),
    'utf8',
  )
  assert.equal(carregarConfig(caminho).hosts.length, 2)
})

test('JSON sintaticamente quebrado diz qual arquivo, não só "Unexpected token"', () => {
  const pasta = mkdtempSync(join(tmpdir(), 'monitor-quebrado-'))
  const caminho = join(pasta, 'config.json')
  writeFileSync(caminho, '{ "faixas": [ }', 'utf8')
  assert.throws(() => carregarConfig(caminho), /configuração inválida/)
  assert.throws(() => carregarConfig(caminho), new RegExp(caminho.replace(/\\/g, '\\\\')))
})

test('arquivo inexistente falha com o caminho na mensagem', () => {
  assert.throws(() => carregarConfig(join(tmpdir(), 'nao-existe-monitor.json')), /não foi possível ler/)
})