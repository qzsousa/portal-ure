import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { carregarConfig } from '../src/config.mjs'
import {
  conferirConvencao,
  conferirDuplicatas,
  conferirRedes,
  gerarConfig,
  ipValido,
  lerArgumentos,
  lerLista,
  slug,
} from '../gerar-config.mjs'

/* ---------------- utilidades ---------------- */

/** Escreve a lista num arquivo temporário e devolve o caminho. */
function listaEm(texto) {
  const dir = mkdtempSync(join(tmpdir(), 'gerar-config-'))
  const caminho = join(dir, 'lista.txt')
  writeFileSync(caminho, texto, 'utf8')
  return caminho
}

/**
 * Bloco de 6 endereços de uma escola, no formato real do arquivo.
 *
 * Os dois prefixos são separados de propósito: na lista de verdade a rede ADM
 * e a PED estão em /24 diferentes, e as três últimas posições (.194/.195/.197
 * na ADM, .20/.21/.22 na PED) são o padrão real dos DVRs.
 */
function escola(nome, prefixoAdm, prefixoPed) {
  return [
    `Group: ${nome}`,
    `${prefixoAdm}.194 VIDEO-DVR1 ADM`,
    `${prefixoAdm}.195 VIDEO-DVR2 ADM`,
    `${prefixoAdm}.197 VIDEO-DVR3 ADM`,
    `${prefixoPed}.20 VIDEO-DVR1 PED`,
    `${prefixoPed}.21 VIDEO-DVR2 PED`,
    `${prefixoPed}.22 VIDEO-DVR3 PED`,
  ].join('\n')
}

const DUAS_ESCOLAS = [
  escola('E.E. ALFA', '10.109.105', '10.116.247'),
  escola('E.E. BETA', '10.109.106', '10.116.242'),
].join('\n\n')

/* ---------------- argumentos ---------------- */

test('lerArgumentos lê entrada, saída e portas', () => {
  const o = lerArgumentos(['dvrs.txt', '--saida', 'c.json', '--portas', '554,37777', '--forcar'])
  assert.equal(o.entrada, 'dvrs.txt')
  assert.equal(o.saida, 'c.json')
  assert.equal(o.portas, '554,37777')
  assert.equal(o.forcar, true)
})

test('lerArgumentos recusa duas entradas e opção desconhecida', () => {
  assert.throws(() => lerArgumentos(['a.txt', 'b.txt']), /sobe UM arquivo/)
  assert.throws(() => lerArgumentos(['--nao-existe']), /opção desconhecida/)
  assert.throws(() => lerArgumentos([]), /faltou o arquivo/)
})

/* ---------------- IPv4 e slug ---------------- */

test('ipValido aceita IPv4 e recusa o resto', () => {
  assert.equal(ipValido('10.109.121.194'), true)
  assert.equal(ipValido('0.0.0.0'), true)
  assert.equal(ipValido('10.109.999.1'), false)
  assert.equal(ipValido('10.109.1'), false)
  assert.equal(ipValido('10.109.1.7/24'), false)
  assert.equal(ipValido(''), false)
})

test('slug tira acento e pontuação, mantendo o id utilizável em URL', () => {
  assert.equal(slug('E.E. ANTONIETA DE SOUZA ALCANTARA'), 'E-E-ANTONIETA-DE-SOUZA-ALCANTARA')
  assert.equal(slug('E.E. ADHEMAR ANTONIO PRADO'), 'E-E-ADHEMAR-ANTONIO-PRADO')
  assert.equal(slug('  surrounds  '), 'SURROUNDS')
})

/* ---------------- leitura ---------------- */

test('lerLista separa escolas e endereços, ignorando linhas em branco', () => {
  const { escolas, erros } = lerLista(listaEm(`\n\n${DUAS_ESCOLAS}\n\n   \n`))
  assert.deepEqual(erros, [])
  assert.equal(escolas.length, 2)
  assert.equal(escolas[0].nome, 'E.E. ALFA')
  assert.equal(escolas[0].hosts.length, 6)
  assert.equal(escolas[0].hosts[0].ip, '10.109.105.194')
  assert.equal(escolas[0].hosts[0].papel, 'VIDEO-DVR1')
  assert.equal(escolas[0].hosts[0].rede, 'ADM')
  assert.equal(escolas[0].hosts[5].ip, '10.116.247.22')
  assert.equal(escolas[0].hosts[5].rede, 'PED')
})

test('lerLista lê arquivo salvo com BOM (padrão do Bloco de Notas)', () => {
  const caminho = listaEm(DUAS_ESCOLAS)
  writeFileSync(caminho, `\ufeff${DUAS_ESCOLAS}`, 'utf8')
  const { escolas, erros } = lerLista(caminho)
  assert.deepEqual(erros, [])
  assert.equal(escolas[0].nome, 'E.E. ALFA')
})

test('lerLista acusa endereço antes do cabeçalho, IP inválido e "Group:" sem nome', () => {
  const { erros } = lerLista(
    listaEm(
      [
        'Group:',
        'Group: E.E. GAMA',
        '10.109.999.1 VIDEO-DVR1 ADM',
        '10.109.5.1 VIDEO-DVR1 ADM',
        '10.109.6.1 VIDEO-DVR1',
      ].join('\n'),
    ),
  )
  const texto = erros.join('\n')
  assert.match(texto, /"Group:" sem nome/)
  assert.match(texto, /"10\.109\.999\.1" não é um IPv4 válido/)
  assert.match(texto, /não entendi "10\.109\.6\.1 VIDEO-DVR1"/)
})

test('endereço órfão é acusado, mas o IPv4 ilegível tem prioridade', () => {
  // Sem cabeçalho, o relatório não pode virar 432 cópias da mesma complaint e
  // esconder o dígito errado que provocou o desarranjo.
  const { erros } = lerLista(listaEm('10.109.9.9 VIDEO-DVR1 ADM\n10.109.999.1 VIDEO-DVR1 ADM\n'))
  assert.equal(erros.length, 3)
  assert.match(erros[0], /10\.109\.9\.9.*antes de qualquer "Group:"/)
  assert.match(erros[1], /10\.109\.999\.1.*não é um IPv4 válido/)
  assert.match(erros[2], /nenhuma escola encontrada/)
})

test('lerLista recusa arquivo sem nenhum "Group:"', () => {
  const { erros } = lerLista(listaEm('10.109.1.1 VIDEO-DVR1 ADM\n'))
  assert.match(erros.join('\n'), /nenhuma escola encontrada/)
})

test('lerLista diz o número da linha de cada problema', () => {
  const { erros } = lerLista(listaEm('Group: E.E. DELTA\n10.109.999.1 VIDEO-DVR1 ADM\n'))
  assert.match(erros[0], /^linha 2:/)
})

/* ---------------- convenção ---------------- */

test('escola com 5 endereços é recusada — não é "flexibilidade", é dado faltando', () => {
  const { escolas } = lerLista(
    listaEm(escola('E.E. GAMMA', '10.109.107', '10.116.243').split('\n').slice(0, 6).join('\n')),
  )
  assert.match(conferirConvencao(escolas).join('\n'), /tem 5 endereço\(s\), esperado 6/)
})

test('escola com os 6 endereços passa na convenção', () => {
  const { escolas } = lerLista(listaEm(DUAS_ESCOLAS))
  assert.deepEqual(conferirConvencao(escolas), [])
})

test('escola com tudo em uma rede só é recusada', () => {
  // Escrito à mão porque o helper sempre marca a segunda trio como PED.
  const bloco = [
    'Group: E.E. DELTA',
    '10.109.108.194 VIDEO-DVR1 ADM',
    '10.109.108.195 VIDEO-DVR2 ADM',
    '10.109.108.197 VIDEO-DVR3 ADM',
    '10.109.109.20 VIDEO-DVR1 ADM',
    '10.109.109.21 VIDEO-DVR2 ADM',
    '10.109.109.22 VIDEO-DVR3 ADM',
  ].join('\n')
  const { escolas } = lerLista(listaEm(bloco))
  const erros = conferirConvencao(escolas).join('\n')
  assert.match(erros, /usa 1 rede\(s\)/)
  assert.match(erros, /6 endereço\(s\) em ADM, esperado 3/)
})

test('papel repetido na mesma rede é recusado', () => {
  const bloco = escola('E.E. EPSILON', '10.109.110', '10.116.245').replace('VIDEO-DVR2 ADM', 'VIDEO-DVR1 ADM')
  const { escolas } = lerLista(listaEm(bloco))
  assert.match(conferirConvencao(escolas).join('\n'), /papel repetido em ADM/)
})

test('endereço repetido entre escolas é apontado com as duas linhas', () => {
  // Mesma /24 administrativa nas duas: é o Ctrl+C/V que não trocou o octeto.
  const texto = [escola('E.E. ALFA', '10.109.105', '10.116.247'), escola('E.E. BETA', '10.109.105', '10.116.242')].join('\n\n')
  const { escolas } = lerLista(listaEm(texto))
  const erros = conferirDuplicatas(escolas)
  assert.equal(erros.length, 3)
  assert.match(erros[0], /10\.109\.105\.194 aparece em "E\.E\. ALFA" \(linha \d+\) e em "E\.E\. BETA"/)
})

test('conferirRedes aponta ADM fora do 10.109.x sem tratar como erro', () => {
  const texto = [
    escola('E.E. ALFA', '10.109.105', '10.116.247'),
    escola('E.E. ZETA', '10.110.189', '10.117.128'),
  ].join('\n\n')
  const { escolas } = lerLista(listaEm(texto))
  assert.deepEqual(conferirConvencao(escolas), [])
  const fora = conferirRedes(escolas)
  assert.equal(fora.length, 1)
  assert.equal(fora[0].ip, '10.110.189.194')
  assert.match(fora[0].escola, /ZETA/)
})

/* ---------------- geração ---------------- */

test('gerarConfig produz uma faixa por escola, com equipamento e rede por endereço', () => {
  const { escolas } = lerLista(listaEm(DUAS_ESCOLAS))
  const config = gerarConfig(escolas, null)
  assert.equal(config.faixas.length, 2)
  assert.equal(config.faixas[0].id, 'E-E-ALFA')
  // A faixa continua sendo a ESCOLA — é ela que agrupa na tela.
  assert.equal(config.faixas[0].rotulo, 'E.E. ALFA')
  assert.equal(config.faixas[0].ips.length, 6)

  // O que impede a tela de mostrar "E.E. ALFA" seis vezes: cada endereço carrega
  // o equipamento e a rede que vieram do .txt.
  assert.deepEqual(config.faixas[0].ips[0], {
    ip: '10.109.105.194',
    equip: 'VIDEO-DVR1',
    rede: 'ADM',
  })
  assert.deepEqual(config.faixas[0].ips[5], {
    ip: '10.116.247.22',
    equip: 'VIDEO-DVR3',
    rede: 'PED',
  })

  // Sem porta informada, não inventa: a lista sai com portas vazias para o
  // serviço cair no ICMP em vez de sondar 445 e mentir "offline".
  assert.deepEqual(config.faixas[0].portas, undefined)
  assert.deepEqual(config.portasPadrao, [])
})

test('portas informadas vão para o padrão e para cada faixa', () => {
  const { escolas } = lerLista(listaEm(DUAS_ESCOLAS))
  const config = gerarConfig(escolas, [554])
  assert.deepEqual(config.portasPadrao, [554])
  assert.deepEqual(config.faixas[1].portas, [554])
})

test('duas escolas que só diferem por acento não viram o mesmo id', () => {
  const texto = [escola('E.E. JOAO', '10.109.111', '10.116.1'), escola('E.E. JOÃO', '10.109.112', '10.116.2')].join('\n\n')
  const { escolas } = lerLista(listaEm(texto))
  const config = gerarConfig(escolas, null)
  const ids = config.faixas.map((f) => f.id)
  assert.equal(new Set(ids).size, 2, `ids colidiram: ${ids.join(', ')}`)
})

test('o config.json gerado é aceito pelo carregarConfig do serviço', () => {
  const { escolas } = lerLista(listaEm(DUAS_ESCOLAS))
  const config = gerarConfig(escolas, [554])
  const caminho = listaEm(JSON.stringify(config))
  const { hosts, faixas, avisos } = carregarConfig(caminho)
  assert.deepEqual(avisos, [])
  assert.equal(faixas.length, 2)
  assert.equal(hosts.length, 12)
  assert.deepEqual(hosts[0].portas, [554])
  // O serviço precisa devolver o equipamento e a rede: sem eles a tela volta a
  // repetir o nome da escola em cada linha.
  assert.equal(hosts[0].equip, 'VIDEO-DVR1')
  assert.equal(hosts[0].rede, 'ADM')
  assert.equal(hosts[0].rotulo, 'VIDEO-DVR1')
  assert.equal(hosts[0].faixa, 'E-E-ALFA')
  assert.equal(hosts[11].rede, 'PED')
})

test('escala real: 72 escolas viram 432 endereços e o serviço aceita', () => {
  const blocos = []
  for (let i = 0; i < 72; i++) {
    const n = String(i).padStart(3, '0')
    blocos.push(escola(`E.E. ESCOLA NUMERO ${n}`, `10.109.${100 + i}`, `10.116.${i}`))
  }
  const { escolas, erros } = lerLista(listaEm(blocos.join('\n\n')))
  assert.deepEqual(erros, [])
  assert.deepEqual(conferirConvencao(escolas), [])
  assert.deepEqual(conferirDuplicatas(escolas), [])

  const caminho = listaEm(JSON.stringify(gerarConfig(escolas, [554])))
  const { hosts, faixas, avisos } = carregarConfig(caminho)
  assert.deepEqual(avisos, [])
  assert.equal(faixas.length, 72)
  assert.equal(hosts.length, 432)

  // Metade em cada rede — é o que o painel de rede ADM/PED vai mostrar.
  assert.equal(hosts.filter((h) => h.rede === 'ADM').length, 216)
  assert.equal(hosts.filter((h) => h.rede === 'PED').length, 216)
  // E nenhum endereço sem equipamento: a lista inteira é legível na tela.
  assert.equal(hosts.filter((h) => !h.equip).length, 0)
})