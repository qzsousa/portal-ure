/**
 * Configuração do monitor.
 *
 * Manifesto de DVRs, um por linha — herde o formato do pingInfoView:
 *
 *   { "ip": "10.109.121.194", "hostname": "VIDEO-DVR1", "tipo": "ADM" }
 *
 * Tipo ADM = rede administrativa da escola, PED = rede pedagógica. O painel
 * agrupa por escola e, dentro dela, separa os dois grupos. Um endereço em duas
 * escolas é erro de endereçamento real: câmera cadastrada no IP errado. O
 * serviço avisa e mantém só a primeira ocorrência.
 *
 * Sem dependência externa de propósito: a máquina do monitoramento é um Windows
 * que roda 24/7 e não deve precisar de `npm install` para subir.
 */
import { readFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'

export function normalizarId(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') /* combining diacritics U+0300–U+036F */
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

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
 * STRUCTURE — um host COM os campos de domínio da câmera:
 *
 *   {
 *     ip: '10.109.121.194',
 *     hostname: 'VIDEO-DVR1',     // qual gravador é (1, 2 ou 3)
 *     tipo: 'ADM',                // 'ADM' = administrativa, 'PED' = pedagógica
 *     faixa: 'escola-1',          // grupo no manifesto
 *     escolaId: '1',
 *     escola: 'E.E. ADHEMAR ANTONIO PRADO',
 *     portas: [80, 554, 8000],
 *   }
 *
 * Todos os erros são juntados antes de falhar: corrigir a configuração por
 * rodada de erro (subiu, reclamou de um problema, morreu) obriga a reiniciar o
 * serviço N vezes — e, na prática, a máquina acaba servindo a configuração
 * antiga sem ninguém perceber.
 */
export function carregarConfig(caminho, env = process.env) {
  const absoluto = isAbsolute(caminho) ? caminho : resolve(caminho)

  let texto
  try {
    texto = readFileSync(absoluto, 'utf8')
  } catch (erro) {
    throw new Error(`não foi possível ler a configuração em "${absoluto}": ${erro.message}`)
  }

  // O arquivo é editado com o Bloco de Notas na máquina da rede, e o Windows
  // salva UTF-8 COM BOM por padrão; `JSON.parse` rejeita esse primeiro
  // caractere, então tiramos antes de qualquer validação.
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1)

  let bruto
  try {
    bruto = JSON.parse(texto)
  } catch (erro) {
    throw new Error(`configuração inválida em "${absoluto}": ${erro.message}`)
  }

  const erros = []
  const avisos = []

  const config = {
    caminho: absoluto,
    porta: numeroInteiro(env.PORTA ?? bruto.porta, 4000, { min: 1, max: 65535, campo: 'porta', erros }),
    host: env.HOST || bruto.host || '127.0.0.1',
    intervaloSegundos: numeroInteiro(env.INTERVALO_SEGUNDOS ?? bruto.intervaloSegundos, 30, {
      min: 5,
      max: 3600,
      campo: 'intervaloSegundos',
      erros,
    }),
    concorrencia: numeroInteiro(env.CONCORRENCIA ?? bruto.concorrencia, 48, {
      min: 1,
      max: 256,
      campo: 'concorrencia',
      erros,
    }),
    timeoutPingMs: numeroInteiro(env.TIMEOUT_PING_MS ?? bruto.timeoutPingMs, 1000, {
      min: 200,
      max: 10000,
      campo: 'timeoutPingMs',
      erros,
    }),
    timeoutPortaMs: numeroInteiro(bruto.timeoutPortaMs, 800, {
      min: 100,
      max: 10000,
      campo: 'timeoutPortaMs',
      erros,
    }),
    historico: numeroInteiro(bruto.historico, 30, { min: 1, max: 240, campo: 'historico', erros }),
    limiteHosts: numeroInteiro(bruto.limiteHosts, 5000, { min: 1, max: 200000, campo: 'limiteHosts', erros }),
    portasPadrao: validarPortas(bruto.portasPadrao, 'portasPadrao', erros) ?? [],
  }

  const faixasBrutas = Array.isArray(bruto.faixas) ? bruto.faixas : []
  if (faixasBrutas.length === 0) erros.push('"faixas" está vazio — não há o que monitorar')

  /** @type {Array<{ip: string, numero: string, hostname: string, tipo: string, faixa: string, escolaId: string, escola: string, portas: number[]}>} */
  const hosts = []
  /** Endereços já vistos: separa "erro de tipo" de "câmera no endereço errado". */
  const vistos = new Map()

  const faixas = []
  /**
   * Ids vistos, separados de `faixas` de propósito.
   *
   * Uma faixa pode nem chegar a `faixas` (um IP malformado interrompe o
   * processamento), mas o id dela precisa continuar reservado: declarar duas
   * escolas com o mesmo id não pode virar silêncio.
   */
  const idsVistos = new Set()

  for (const [indice, faixaBruta] of faixasBrutas.entries()) {
    const onde = `faixas[${indice}]`

    const rotulo = String(faixaBruta.rotulo ?? '').trim()
    if (!rotulo) {
      erros.push(`"${onde}.rotulo" é obrigatório (é o nome da escola exibido na tela)`)
      continue
    }

    const id = String(faixaBruta.id ?? '').trim() || `escola-${indice + 1}`
    if (idsVistos.has(id)) {
      erros.push(`"${onde}.id" duplicado: "${id}" — duas escolas com o mesmo identificador`)
      continue
    }
    idsVistos.add(id)

    const portas = validarPortas(faixaBruta.portas, `${onde}.portas`, erros) ?? config.portasPadrao
    const ipsBrutos = Array.isArray(faixaBruta.ips) ? faixaBruta.ips : []

    if (ipsBrutos.length === 0) {
      erros.push(`"${onde}".ips está vazio — pelo menos um DVR precisa estar declarado`)
      continue
    }

    const faixa = { id, rotulo, escolaId: id.replace(/^escola-/, ''), total: 0 }
    faixas.push(faixa)

    for (const [i, itemBruto] of ipsBrutos.entries()) {
      const numero = String(itemBruto?.ip ?? '').trim()
      try {
        ipParaNumero(numero)
      } catch (erro) {
        erros.push(`${onde}.ips[${i}]: ${erro.message}`)
        continue
      }

      const anterior = vistos.get(numero)
      if (anterior) {
        // Mantém a primeira e avisa — o mais provável é câmera cadastrada no
        // endereço errado, e esconder a duplicidade esconde o problema.
        avisos.push(
          `endereço ${numero} aparece em "${anterior}" e em "${rotulo}" — mantido em "${anterior}"`,
        )
        continue
      }
      vistos.set(numero, rotulo)

      const hostname = String(itemBruto.hostname ?? '').trim()
      const tipo = String(itemBruto.tipo ?? '').trim().toUpperCase()

      if (!/^VIDEO-DVR\d+$/.test(hostname)) {
        erros.push(
          `${onde}.ips[${i}]: hostname inválido: "${hostname}" — use VIDEO-DVR1, VIDEO-DVR2 ou VIDEO-DVR3`,
        )
        continue
      }
      if (tipo !== 'ADM' && tipo !== 'PED') {
        erros.push(
          `${onde}.ips[${i}]: tipo inválido: "${tipo}" — use ADM (administrativa) ou PED (pedagógica)`,
        )
        continue
      }

      hosts.push({
        ip: numero,
        numero,
        hostname,
        tipo,
        faixa: id,
        escolaId: faixa.escolaId,
        escola: rotulo,
        portas,
      })
      faixa.total += 1

      if (hosts.length > config.limiteHosts) {
        // Serializar mais erros aqui não serve: a prioridade é avisar que a
        // configuração está inflada.
        erros.push(`a configuração gera mais de ${config.limiteHosts} endereços — reveja o arquivo`)
        break
      }
    }
    // Sem `break` no laço externo de faixas: parar no primeiro erro obrigaria
    // quem corrige o config.json a rodar o serviço N vezes.
  }

  if (erros.length > 0) {
    throw new Error(`configuração inválida:\n  - ${erros.join('\n  - ')}`)
  }

  return { config, faixas, hosts, avisos }
}