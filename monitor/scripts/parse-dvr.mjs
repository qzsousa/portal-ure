/**
 * Converte o texto bruto dos DVRs (colado do pingInfoView) para o
 * config.json do monitor. Rode: node scripts/parse-dvr.mjs < entrada.txt > config.json
 *
 * Formato de entrada:
 * Group: E.E. NOME DA ESCOLA
 * 10.109.121.194 VIDEO-DVR1 ADM
 * 10.109.121.195 VIDEO-DVR2 ADM
 * ...
 *
 * Saída: config.json com faixas por escola, cada IP com hostname e tipo.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const AQUI = dirname(fileURLToPath(import.meta.url))

function parseEntrada(texto) {
  const linhas = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
  const faixas = []
  let grupoAtual = null
  let contador = 0

  for (const linha of linhas) {
    if (linha.startsWith('Group:')) {
      const nome = linha.replace('Group:', '').trim()
      grupoAtual = {
        id: `escola-${++contador}`,
        rotulo: nome,
        ips: [],
      }
      faixas.push(grupoAtual)
      continue
    }

    // IP HOSTNAME TIPO
    const partes = linha.split(/\s+/)
    if (partes.length >= 3 && /^\d+\.\d+\.\d+\.\d+$/.test(partes[0])) {
      if (!grupoAtual) continue
      const [ip, hostname, tipo] = partes
      grupoAtual.ips.push({
        ip,
        hostname,
        tipo, // 'ADM' ou 'PED'
      })
    }
  }

  return faixas
}

const entrada = readFileSync(join(AQUI, '..', 'dvr-raw.txt'), 'utf8')
const faixas = parseEntrada(entrada)

const config = {
  intervaloSegundos: 30,
  concorrencia: 48,
  timeoutPingMs: 1000,
  timeoutPortaMs: 800,
  historico: 30,
  portasPadrao: [80, 443, 554, 8000, 37777], // portas comuns de DVR (HTTP, HTTPS, RTSP, web, SDK)
  faixas,
}

writeFileSync(join(AQUI, '..', 'config.json'), JSON.stringify(config, null, 2))
console.log(`Gerado config.json com ${faixas.length} escolas e ${faixas.reduce((s, f) => s + f.ips.length, 0)} DVRs`)