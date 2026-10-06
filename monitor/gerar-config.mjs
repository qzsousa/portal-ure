#!/usr/bin/env node
/**
 * Gera o `config.json` do monitor de rede a partir da lista de DVRs em texto.
 *
 * Por que existir: a lista são 72 escolas × 6 endereços = 432 IPs. Digitar isso
 * à mão no JSON significa 432 chances de erro de um dígito — e um dígito errado
 * aqui é um equipamento que SOME do painel sem aviso, ou pior, um equipamento
 * monitorado no endereço do vizinho. O arquivo de texto é a fonte da verdade;
 * este script só traduz.
 *
 *   node gerar-config.mjs <lista.txt> [--saida config.json] [--portas 554,37777] [--forcar]
 *
 * O que ele NÃO faz (e por quê):
 * - Não adivinha o equipamento. O papel e a rede vêm do arquivo, coluna a
 *   coluna; se faltar coluna, o script reclama em vez de preencher com um
 *   palpite.
 * - Não aceita configuração pela metade. Qualquer inconsistência sai como ERRO e
 *   nenhum arquivo é escrito — um config.json pela metade seria pior do que
 *   nenhum, porque o serviço sobe com a lista incompleta e ninguém percebe.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const ESTE_ARQUIVO = fileURLToPath(import.meta.url)

/* ---------------- argumentos ---------------- */

export function lerArgumentos(argv) {
  const opcoes = { entrada: null, saida: null, portas: null, forcar: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--saida') opcoes.saida = argv[++i]
    else if (arg === '--portas') opcoes.portas = argv[++i]
    else if (arg === '--forcar') opcoes.forcar = true
    else if (arg.startsWith('-')) throw new Error(`opção desconhecida: ${arg}`)
    else if (opcoes.entrada === null) opcoes.entrada = arg
    else throw new Error(`sobe UM arquivo de entrada; "${arg}" é um segundo`)
  }
  if (!opcoes.entrada) {
    throw new Error('faltou o arquivo de entrada. Exemplo: node gerar-config.mjs dvrs.txt')
  }
  return opcoes
}

/* ---------------- leitura ---------------- */

const RE_IP = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

export function ipValido(ip) {
  const m = RE_IP.exec(ip)
  if (!m) return false
  return m.slice(1).every((o) => Number(o) <= 255)
}

/** "E.E. ANTONIETA DE SOUZA ALCANTARA" → "E-E-ANTONIETA-DE-SOUZA-ALCANTARA". */
export function slug(nome) {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Lê a lista e devolve as escolas com os endereços, junto dos erros encontrados.
 *
 * Os erros são COLETADOS e lançados juntos, pelo mesmo motivo do `config.mjs`:
 * corrigir um erro por reinício (subiu, reclamou do primeiro, morreu) obriga a
 * rodar o script N vezes e as 431 linhas seguintes nunca são revisadas.
 */
export function lerLista(caminho) {
  let texto
  try {
    texto = readFileSync(caminho, 'utf8')
  } catch (erro) {
    throw new Error(`não foi possível ler "${caminho}": ${erro.message}`)
  }
  // O arquivo vem do Bloco de Notas, que salva UTF-8 COM BOM.
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1)

  const erros = []
  const avisos = []
  const escolas = []
  let atual = null

  texto.split(/\r?\n/).forEach((linha, indice) => {
    const numero = indice + 1
    const t = linha.trim()
    if (!t) return

    const grupo = /^Group:\s*(.*)$/i.exec(t)
    if (grupo) {
      const nome = grupo[1].trim()
      if (!nome) {
        // Sem este caso, um "Group:" vazio cairia no bloco de endereço e sairia
        // como "não entendi esta linha" — que culpa a linha de dados por causa
        // da linha de cabeçalho que ficou pela metade.
        erros.push(`linha ${numero}: "Group:" sem nome de escola`)
        return
      }
      atual = { nome, linha: numero, hosts: [] }
      escolas.push(atual)
      return
    }

    const m = /^(\S+)\s+(\S+)\s+(\S+)\s*$/.exec(t)
    if (!m) {
      erros.push(`linha ${numero}: não entendi "${t}" (esperado "<ip> <papel> <rede>")`)
      return
    }

    const [, ip, papel, rede] = m
    /*
     * O IPv4 é conferido ANTES do cabeçalho, de propósito.
     *
     * Numa lista que perdeu o primeiro "Group:", todas as linhas estão órfãs.
     * Se a ordem fosse o contrário, o script devolveria 432 cópias de "endereço
     * antes de qualquer Group" e nunca apontaria o "10.109.999.1" que é a causa
     * real — quem lê a saída teria de caçar o erro de digitação no meio do
     * barulho. O endereço ilegível é a informação mais acionável da linha.
     */
    if (!ipValido(ip)) {
      erros.push(`linha ${numero}: "${ip}" não é um IPv4 válido`)
      return
    }
    if (!atual) {
      erros.push(`linha ${numero}: endereço "${ip}" aparece antes de qualquer "Group:"`)
      return
    }

    atual.hosts.push({ ip, papel, rede, linha: numero })
  })

  if (escolas.length === 0) erros.push('nenhuma escola encontrada (nenhuma linha "Group:")')
  return { escolas, erros, avisos }
}

/* ---------------- validação ---------------- */

/**
 * Confere as regras que a lista segue por convenção.
 *
 * Estas NÃO são exigências do `config.json` — o monitor aceitaria uma escola com
 * 3 endereços. São exigências do que a lista significa: uma escola tem 3 DVRs na
 * rede administrativa e 3 na pedagógica. Aceitar 3 ou 7 aqui não é ser
 * flexível, é gerar um painel que mostra "escola com um DVR a menos" sem dizer
 * isso em lugar nenhum.
 */
export function conferirConvencao(escolas) {
  const erros = []

  for (const escola of escolas) {
    const n = escola.hosts.length
    if (n !== 6) {
      erros.push(`"${escola.nome}" (linha ${escola.linha}) tem ${n} endereço(s), esperado 6`)
      continue
    }
    const redes = new Set(escola.hosts.map((h) => h.rede))
    if (redes.size !== 2) {
      erros.push(
        `"${escola.nome}" (linha ${escola.linha}) usa ${redes.size} rede(s) ` +
          `(${[...redes].join(', ')}), esperado 2 (ADM e PED)`,
      )
    }
    for (const rede of redes) {
      const naRede = escola.hosts.filter((h) => h.rede === rede)
      if (naRede.length !== 3) {
        erros.push(
          `"${escola.nome}" (linha ${escola.linha}): ${naRede.length} endereço(s) em ${rede}, esperado 3`,
        )
      }
      const papeis = naRede.map((h) => h.papel)
      if (new Set(papeis).size !== papeis.length) {
        erros.push(`"${escola.nome}" (linha ${escola.linha}): papel repetido em ${rede} (${papeis.join(', ')})`)
      }
    }
  }
  return erros
}

/** Endereço repetido: quase sempre um Ctrl+C/V sem trocar o último octeto. */
export function conferirDuplicatas(escolas) {
  const erros = []
  const dono = new Map()
  for (const escola of escolas) {
    for (const h of escola.hosts) {
      const anterior = dono.get(h.ip)
      if (anterior) {
        erros.push(
          `${h.ip} aparece em "${anterior.nome}" (linha ${anterior.linha}) e em ` +
            `"${escola.nome}" (linha ${h.linha})`,
        )
      } else {
        dono.set(h.ip, { nome: escola.nome, linha: h.linha })
      }
    }
  }
  return erros
}

/**
 * Verificação de topologia.
 *
 * A rede administrativa é `10.109.x.x` para a grande maioria das escolas. Duas
 * fogem (uma em 10.107, outra em 10.110). Isso é esperado e NÃO é erro — mas
 * precisa aparecer no relatório, porque é exatamente o tipo de coisa que se
 * perde numa lista de 432 linhas e vira "a escola não aparece no painel" meses
 * depois.
 */
export function conferirRedes(escolas) {
  const fora = []
  for (const escola of escolas) {
    const adm = escola.hosts.find((h) => h.rede === 'ADM')
    if (adm && !adm.ip.startsWith('10.109.')) {
      fora.push({ escola: escola.nome, ip: adm.ip })
    }
  }
  return fora
}

/* ---------------- geração ---------------- */

export function gerarConfig(escolas, portas) {
  const usados = new Map()
  const faixas = escolas.map((escola) => {
    let id = slug(escola.nome)
    // Duas escolas que só diferem por acento viram o mesmo slug. O índice
    // mantém as duas — perder uma escola do painel é pior que um id feio.
    const anterior = usados.get(id)
    if (anterior !== undefined) {
      usados.set(id, anterior + 1)
      id = `${id}-${anterior + 1}`
    } else {
      usados.set(id, 0)
    }

    const faixa = {
      id,
      rotulo: escola.nome,
      // Objeto por endereço, e não lista solta: cada DVR precisa saber qual
      // equipamento é e em qual rede está. Com `ips: ["10.x.y.z", ...]` o
      // monitor mostraria o nome da escola seis vezes e não distinguiria o
      // VIDEO-DVR1 do VIDEO-DVR2, nem a rede ADM da PED.
      ips: escola.hosts.map((h) => ({ ip: h.ip, equip: h.papel, rede: h.rede })),
    }
    if (portas) faixa.portas = portas
    return faixa
  })

  return {
    _comentario: [
      'GERADO por monitor/gerar-config.mjs — não editar à mão.',
      'Fonte: a lista de DVRs em texto. Para mudar a topologia, corrija o .txt e rode o script de novo.',
      'Cada faixa é uma ESCOLA. Os 6 endereços são os DVRs dela: 3 VIDEO-DVR1/2/3 na',
      'rede ADM (administrativa, acesso gerencial) e os mesmos 3 na rede PED',
      '(pedagógica, gravação e projeção). O "equip" e a "rede" de cada endereço vêm',
      'das colunas do .txt — são eles que a tela usa para agrupar.',
    ],
    intervaloSegundos: 30,
    concorrencia: 48,
    timeoutPingMs: 1000,
    timeoutPortaMs: 800,
    historico: 30,
    /*
     * NÃO copie portas de Windows (445/3389) para cá: DVR não serve SMB nem
     * RDP. Se o ICMP for filtrado — o mais comum em equipamento de videovigilância
     * — e a porta aqui estiver errada, TODOS os endereços caem e o painel vira
     * um alarme falso de 432 IPs. `--portas` existe exatamente para isso.
     */
    portasPadrao: portas || [],
    faixas,
  }
}

/* ---------------- execução ---------------- */

function main() {
  const opcoes = lerArgumentos(process.argv.slice(2))

  const portas = opcoes.portas
    ? opcoes.portas.split(',').map((p) => Number(p.trim())).filter(Boolean)
    : null
  if (opcoes.portas && portas.some((p) => !Number.isInteger(p) || p < 1 || p > 65535)) {
    throw new Error(`--portas inválido: "${opcoes.portas}" (use números de 1 a 65535)`)
  }

  const { escolas, erros, avisos } = lerLista(resolve(opcoes.entrada))
  erros.push(...conferirConvencao(escolas))
  erros.push(...conferirDuplicatas(escolas))

  if (erros.length > 0) {
    console.error(`\n${erros.length} erro(s) na lista — nada foi escrito:\n`)
    for (const e of erros) console.error(`  - ${e}`)
    console.error('')
    process.exit(1)
  }

  const config = gerarConfig(escolas, portas)
  const totalHosts = config.faixas.reduce((a, f) => a + f.ips.length, 0)

  const destino = resolve(opcoes.saida || resolve(AQUI, 'config.json'))
  if (existsSync(destino) && !opcoes.forcar) {
    console.error(`\n"${destino}" já existe. Use --forcar para sobrescrever.\n`)
    process.exit(1)
  }
  writeFileSync(destino, `${JSON.stringify(config, null, 2)}\n`, 'utf8')

  /* ---- relatório: o número sozinho não diz se a lista está certa ---- */
  console.log(`\n${config.faixas.length} escolas · ${totalHosts} endereços → ${destino}\n`)

  const porRede = {}
  for (const e of escolas) {
    for (const h of e.hosts) porRede[h.rede] = (porRede[h.rede] || 0) + 1
  }
  console.log('por rede: ' + Object.entries(porRede).map(([r, n]) => `${r} ${n}`).join(' · '))

  if (!portas) {
    console.log(
      '\n⚠  NENHUMA porta configurada.\n' +
        '   O serviço só vai declarar um DVR "online" se ele responder ao ICMP.\n' +
        '   A maioria dos DVRs não responde — e aí os 432 endereços caem todos.\n' +
        '   Descubra a porta real do equipamento (554 RTSP, 37777 em Dahua,\n' +
        '   8000 em Hikvision) e regere com --portas <porta>.\n',
    )
  }

  const fora = conferirRedes(escolas)
  if (fora.length > 0) {
    console.log(`\n${fora.length} escola(s) com ADM fora do 10.109.x — confirme se é o esperado:`)
    for (const f of fora) console.log(`   ${f.ip}  ${f.escola}`)
    console.log('')
  }

  for (const aviso of avisos) console.log(`⚠  ${aviso}`)
}

/*
 * Só roda quando executado pela linha de comando.
 *
 * Sem este guard, importar o módulo para testá-lo geraria um config.json e
 * chamaria `process.exit` no meio da suíte.
 */
if (process.argv[1] && resolve(process.argv[1]) === ESTE_ARQUIVO) {
  try {
    main()
  } catch (erro) {
    console.error(`\n${erro.message}\n`)
    process.exit(1)
  }
}