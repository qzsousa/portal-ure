/**
 * Configuração do monitor de rede: leitura do JSON, validação e EXPANSÃO das
 * faixas declaradas para a lista plana de endereços que será monitorada.
 *
 * Por que expandir no backend e não no navegador: quem conhece a topologia da
 * rede é a máquina, não o navegador. O portal recebe a lista já pronta (com o
 * rótulo de cada endereço) e nunca monta faixa por faixa.
 *
 * Sem dependência externa de propósito: a máquina do monitoramento é um
 * Windows que roda 24/7 e não deve precisar de `npm install` para subir.
 */
import { readFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'

/** Teto de segurança: uma configuração errada não pode gerar 4 milhões de pings. */
export const LIMITE_HOSTS_PADRAO = 5000

/* ---------------- IPv4 em número de 32 bits ---------------- */

/** "10.20.1.7" → número sem sinal (0..4294967295). */
export function ipParaNumero(ip) {
  const partes = String(ip ?? '').trim().split('.')
  if (partes.length !== 4) throw new Error(`endereço IPv4 inválido: "${ip}"`)
  let n = 0
  for (const parte of partes) {
    if (!/^\d{1,3}$/.test(parte)) throw new Error(`endereço IPv4 inválido: "${ip}"`)
    const valor = Number(parte)
    if (valor > 255) throw new Error(`endereço IPv4 inválido: "${ip}"`)
    n = n * 256 + valor
  }
  return n
}

/** Número sem sinal → "10.20.1.7". */
export function numeroParaIp(n) {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')
}

/* ---------------- Expansão de faixa ---------------- */

/**
 * Expande uma notação CIDR para o intervalo útil, em números.
 *
 * /31 e /32 mantêm TODOS os endereços: em prefixos esses não existe "endereço
 * de rede" nem "de broadcast" (RFC 3021), então descartá-los apagaria do
 * monitoramento um equipamento legítimo — o erro clássico de rede que "some"
 * do painel.
 */
export function expandirCidr(cidr) {
  const texto = String(cidr ?? '').trim()
  const [base, mascaraTexto] = texto.split('/')
  const bits = mascaraTexto === undefined ? 32 : Number(mascaraTexto)

  if (!Number.isInteger(bits) || bits < 0 || bits > 32) {
    throw new Error(`máscara inválida em "${texto}": use /0 a /32`)
  }

  const endereco = ipParaNumero(base)
  // `<< 32` em JS equivale a `<< 0` (shift é módulo 32), daí o caso /0 à parte.
  const mascara = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
  const inicio = (endereco & mascara) >>> 0
  const tamanho = 2 ** (32 - bits)
  const fim = (inicio + tamanho - 1) >>> 0

  const temBordas = bits <= 30
  const primeiro = temBordas ? inicio + 1 : inicio
  const ultimo = temBordas ? fim - 1 : fim

  return { primeiro, ultimo, quantidade: Math.max(0, ultimo - primeiro + 1) }
}

/* ---------------- Validação ---------------- */

function numeroInteiro(valor, padrao, { min, max, campo, erros }) {
  if (valor === undefined || valor === null || valor === '') return padrao
  const n = Number(valor)
  if (!Number.isInteger(n) || n < min || n > max) {
    erros.push(`"${campo}" precisa ser um inteiro entre ${min} e ${max} (recebido: ${JSON.stringify(valor)})`)
    return padrao
  }
  return n
}

function validarPortas(valor, campo, erros) {
  if (valor === undefined || valor === null) return null
  if (!Array.isArray(valor)) {
    erros.push(`"${campo}" precisa ser uma lista de números`)
    return null
  }
  const portas = []
  for (const bruto of valor) {
    const p = Number(bruto)
    if (!Number.isInteger(p) || p < 1 || p > 65535) {
      erros.push(`"${campo}" tem porta inválida: ${JSON.stringify(bruto)}`)
      continue
    }
    if (!portas.includes(p)) portas.push(p)
  }
  return portas
}

/**
 * Lê e valida o arquivo de configuração.
 *
 * Todos os erros são juntados e lançados de uma vez: corrigir a configuração
 * por rodada de erro (subiu, reclamou do primeiro problema, morreu) obriga a
 * reiniciar o serviço N vezes — e na prática acaba-se desistindo e o serviço
 * fica no ar com a configuração antiga.
 */
export function carregarConfig(caminho, env = process.env) {
  const absoluto = isAbsolute(caminho) ? caminho : resolve(caminho)
  let texto
  try {
    texto = readFileSync(absoluto, 'utf8')
  } catch (erro) {
    throw new Error(`não foi possível ler a configuração em "${absoluto}": ${erro.message}`)
  }

  // O arquivo é editado à mão, no Bloco de Notas da máquina do monitoramento, e
  // o Windows salva UTF-8 COM BOM por padrão. `JSON.parse` não tolera esse
  // primeiro caractere e derrubaria o serviço com "Unexpected token", que não
  // aponta a causa — quem edita o arquivo por fora não desconfia do próprio
  // Bloco de Notas.
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1)

  let bruto
  try {
    bruto = JSON.parse(texto)
  } catch (erro) {
    throw new Error(`configuração inválida em "${absoluto}": ${erro.message}`)
  }

  const erros = []
  const avisos = []

  const intervaloSegundos = numeroInteiro(env.INTERVALO_SEGUNDOS ?? bruto.intervaloSegundos, 30, {
    min: 5,
    max: 3600,
    campo: 'intervaloSegundos',
    erros,
  })
  const concorrencia = numeroInteiro(env.CONCORRENCIA ?? bruto.concorrencia, 48, {
    min: 1,
    max: 256,
    campo: 'concorrencia',
    erros,
  })
  const timeoutPingMs = numeroInteiro(env.TIMEOUT_PING_MS ?? bruto.timeoutPingMs, 1000, {
    min: 200,
    max: 10000,
    campo: 'timeoutPingMs',
    erros,
  })
  const timeoutPortaMs = numeroInteiro(bruto.timeoutPortaMs, 800, {
    min: 100,
    max: 10000,
    campo: 'timeoutPortaMs',
    erros,
  })
  const historico = numeroInteiro(bruto.historico, 30, {
    min: 1,
    max: 240,
    campo: 'historico',
    erros,
  })
  const limiteHosts = numeroInteiro(bruto.limiteHosts, LIMITE_HOSTS_PADRAO, {
    min: 1,
    max: 200000,
    campo: 'limiteHosts',
    erros,
  })
  const portasPadrao = validarPortas(bruto.portasPadrao, 'portasPadrao', erros) ?? []

  const faixasBrutas = Array.isArray(bruto.faixas) ? bruto.faixas : []
  if (faixasBrutas.length === 0) {
    erros.push('"faixas" está vazio — não há o que monitorar')
  }

  const config = {
    caminho: absoluto,
    porta: numeroInteiro(env.PORTA ?? bruto.porta, 4000, { min: 1, max: 65535, campo: 'porta', erros }),
    host: env.HOST || bruto.host || '127.0.0.1',
    intervaloSegundos,
    concorrencia,
    timeoutPingMs,
    timeoutPortaMs,
    historico,
    limiteHosts,
    portasPadrao,
  }

  /** @type {Array<{ip: string, faixa: string, rotulo: string, portas: number[]}>} */
  const hosts = []
  const vistos = new Map()
  const faixas = []
  /**
   * Ids vistos, separados de `faixas` de propósito.
   *
   * Uma faixa INVÁLIDA não entra em `faixas` (o serviço não sobe), mas o id
   * dela precisa continuar reservado. Se a checagem usasse `faixas`, declarar
   * "lab" duas vezes ficaria silencioso justamente quando a primeira já está
   * com erro — e quem lê o log veria dois grupos com o mesmo rótulo na tela.
   */
  const idsVistos = new Set()

  faixasBrutas.forEach((faixa, indice) => {
    const onde = `faixas[${indice}]`
    const id = String(faixa.id ?? '').trim()
    if (!id) {
      erros.push(`"${onde}.id" é obrigatório (é o identificador do grupo exibido na tela)`)
      return
    }
    if (idsVistos.has(id)) {
      erros.push(`"${onde}.id" duplicado: "${id}" já foi declarado acima`)
      return
    }
    idsVistos.add(id)

    const rotulo = String(faixa.rotulo ?? id).trim()
    const portas = validarPortas(faixa.portas, `${onde}.portas`, erros) ?? portasPadrao

    /** @type {Array<[number, number]>} */
    const intervalos = []

    if (faixa.cidr) {
      try {
        const { primeiro, ultimo, quantidade } = expandirCidr(faixa.cidr)
        intervalos.push([primeiro, ultimo])
        if (quantidade > 4000) {
          avisos.push(`${id}: ${quantidade} endereços em "${faixa.cidr}" — a varredura pode ficar lenta`)
        }
      } catch (erro) {
        erros.push(`${onde}.cidr: ${erro.message}`)
      }
    }

    if (faixa.inicio !== undefined || faixa.fim !== undefined) {
      if (faixa.inicio === undefined || faixa.fim === undefined) {
        erros.push(`"${onde}" precisa dos DOIS campos: "inicio" e "fim"`)
      } else {
        try {
          const inicio = ipParaNumero(faixa.inicio)
          const fim = ipParaNumero(faixa.fim)
          if (fim < inicio) {
            erros.push(`"${onde}": "fim" (${faixa.fim}) é menor que "inicio" (${faixa.inicio})`)
          } else {
            intervalos.push([inicio, fim])
          }
        } catch (erro) {
          erros.push(`${onde}: ${erro.message}`)
        }
      }
    }

    const ipsSoltos = Array.isArray(faixa.ips) ? faixa.ips : []
    for (const ip of ipsSoltos) {
      try {
        const n = ipParaNumero(ip)
        intervalos.push([n, n])
      } catch (erro) {
        erros.push(`${onde}.ips: ${erro.message}`)
      }
    }

    if (intervalos.length === 0) {
      // Só cobra a fonte de endereços se ela não foi preenchida. Se veio
      // preenchida e foi REJEITADA acima, a mensagem "precisa de cidr…" seria
      // um eco do erro verdadeiro: corrigir o eco não faria o serviço subir, e
      // quem lê a lista de erros perde o problema real no meio do barulho.
      const temFonte = Boolean(faixa.cidr) || faixa.inicio !== undefined || Array.isArray(faixa.ips)
      if (!temFonte) erros.push(`"${onde}" precisa de "cidr", de "inicio"+"fim" ou de "ips"`)
      return
    }

    faixas.push({ id, rotulo, descricao: faixa.cidr || (ipsSoltos.length ? `${ipsSoltos.length} endereço(s)` : faixa.inicio) })

    for (const [inicio, fim] of intervalos) {
      for (let n = inicio; n <= fim; n += 1) {
        const ip = numeroParaIp(n)
        const anterior = vistos.get(ip)
        if (anterior) {
          // Não é fatal: o endereço continua monitorado, uma vez, sob o primeiro
          // rótulo. Vira aviso porque costuma ser erro de digitação na faixa.
          avisos.push(`endereço ${ip} declarado em "${anterior}" e em "${id}" — mantido em "${anterior}"`)
          continue
        }
        vistos.set(ip, id)
        hosts.push({ ip, faixa: id, rotulo, portas })
        if (hosts.length > limiteHosts) {
          erros.push(`a configuração gera mais de ${limiteHosts} endereços — reveja as faixas`)
          break
        }
      }
      if (erros.length > 0) break
    }
  })

  if (erros.length > 0) {
    throw new Error(`configuração inválida:\n  - ${erros.join('\n  - ')}`)
  }

  return { config, faixas, hosts, avisos }
}