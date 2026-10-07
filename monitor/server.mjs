/**
 * Servidor HTTP do monitoramento de DVRs.
 *
 * Rotas:
 *   GET  /health                  público (health check do túnel/serviço)
 *   GET  /api/resumo              autenticado — só os totais (payload pequeno)
 *   GET  /api/hosts               autenticado — totais + lista de DVRs
 *   GET  /api/escolas             autenticado — escolas com a contagem
 *   POST /api/varredura           autenticado — força uma varredura agora
 *   POST /api/config/recarregar   autenticado — relê o config.json sem reiniciar
 *
 * Escuta em 127.0.0.1 de propósito: quem fala com o navegador é o Cloudflare
 * Tunnel, não o roteador aberto. Sem porta aberta no roteador e com HTTPS no
 * túnel, o portal (Vercel) alcança a máquina da rede sem IP público.
 */
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { carregarConfig } from './src/config.mjs'
import { cabecalhosCors, tokenDoCabecalho, verificarToken } from './src/auth.mjs'
import { MonitorRede } from './src/monitor.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))
const ARQUIVO_CONFIG = process.env.MONITOR_CONFIG || join(AQUI, 'config.json')
const NIVEIS_PADRAO = ['ADMIN', 'TECNICO']

function log(prefixo) {
  return (...partes) => console.log(`[${new Date().toISOString()}] ${prefixo}`, ...partes)
}

function criarMonitor(caminho = ARQUIVO_CONFIG) {
  const { config, faixas, hosts, avisos } = carregarConfig(caminho)
  const logger = { info: log('monitor-dvr'), aviso: log('monitor-dvr ⚠'), erro: log('monitor-dvr ✗') }
  for (const aviso of avisos) logger.aviso(aviso)
  logger.info(
    `configuração "${config.caminho}": ${hosts.length} DVRs em ${faixas.length} escolas ` +
      `(ciclo ${config.intervaloSegundos}s, concorrência ${config.concorrencia})`,
  )
  return new MonitorRede({ config, faixas, hosts, logger })
}

let monitor = criarMonitor()
const config = monitor.config

const SSO_SECRET = process.env.SSO_SECRET || null
const NIVEIS_PERMITIDOS = (process.env.NIVEIS_PERMITIDOS || NIVEIS_PADRAO.join(','))
  .split(',')
  .map((n) => n.trim().toUpperCase())
  .filter(Boolean)
const ORIGENS = (process.env.CORS_ORIGENS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

const INTERVALO_MINIMO_FORCADO_MS = 15_000

function responder(req, res, status, corpo, extras = {}) {
  const cabecalhos = {
    ...cabecalhosCors(ORIGENS, req.headers.origin),
    'Content-Type': 'application/json; charset=utf-8',
    // o painel reconsulta a cada 30 s: guardar no túnel serve estado velho.
    'Cache-Control': 'no-store',
    ...extras,
  }
  res.writeHead(status, cabecalhos)
  res.end(JSON.stringify(corpo))
}

/** 401 com mensagem utilizável — a tela mostra o texto, não "erro genérico". */
function naoAutorizado(req, res, motivo) {
  responder(req, res, 401, { erro: motivo }, { 'WWW-Authenticate': 'Bearer' })
}

/**
 * Exige access token válido do portal + nível permitido.
 * Devolve o payload autenticado, ou `null` (já tendo respondido).
 */
function exigirToken(req, res) {
  if (!SSO_SECRET) {
    responder(req, res, 503, {
      erro:
        'SSO_SECRET não configurado no serviço — sem ele nenhuma requisição é autorizada. ' +
        'O valor é o JWT_SECRET do backend de chamados.',
    })
    return null
  }

  const token = tokenDoCabecalho(req.headers)
  if (!token) {
    naoAutorizado(req, res, 'Token de acesso ausente')
    return null
  }

  const payload = verificarToken(token, SSO_SECRET)
  if (!payload) {
    naoAutorizado(req, res, 'Token inválido ou expirado')
    return null
  }

  const nivel = String(payload.nivel || '').toUpperCase()
  if (nivel && !NIVEIS_PERMITIDOS.includes(nivel)) {
    responder(req, res, 403, { erro: `Perfil "${nivel}" sem acesso ao monitoramento de DVRs` })
    return null
  }

  return payload
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const rota = url.pathname.replace(/\/+$/, '') || '/'
  const metodo = (req.method ?? 'GET').toUpperCase()

  // Preflight antes do token: sem OPTIONS liberado o navegador nem chega a
  // enviar o GET com o Authorization.
  if (metodo === 'OPTIONS') {
    res.writeHead(204, cabecalhosCors(ORIGENS, req.headers.origin))
    res.end()
    return
  }

  try {
    if (rota === '/health') {
      const resumo = monitor.resumo()
      responder(req, res, 200, {
        ok: true,
        servico: 'monitor-dvr',
        ssoConfigurado: Boolean(SSO_SECRET),
        monitorados: resumo.total,
        escolas: monitor.faixas.length,
        emAndamento: resumo.emAndamento,
        ultimaVarreduraEm: resumo.ultimaVarreduraEm,
        totalVarreduras: resumo.totalVarreduras,
        uptimeSegundos: Math.round(process.uptime()),
      })
      return
    }

    if (rota === '/api/resumo') {
      if (metodo !== 'GET') return responder(req, res, 405, { erro: 'Use GET' })
      if (!exigirToken(req, res)) return
      responder(req, res, 200, { geradoEm: Date.now(), ...monitor.resumo() })
      return
    }

    if (rota === '/api/hosts') {
      if (metodo !== 'GET') return responder(req, res, 405, { erro: 'Use GET' })
      if (!exigirToken(req, res)) return
      responder(req, res, 200, monitor.snapshot())
      return
    }

    if (rota === '/api/escolas') {
      if (metodo !== 'GET') return responder(req, res, 405, { erro: 'Use GET' })
      if (!exigirToken(req, res)) return
      const porFaixa = new Map(monitor.resumo().porFaixa.map((p) => [p.id, p]))
      responder(req, res, 200, {
        escolas: monitor.faixas.map((f) => ({
          id: f.id,
          rotulo: f.rotulo,
          escolaId: f.escolaId,
          ...porFaixa.get(f.id),
        })),
      })
      return
    }

    if (rota === '/api/varredura') {
      if (metodo !== 'POST') return responder(req, res, 405, { erro: 'Use POST' })
      if (!exigirToken(req, res)) return
      const agora = Date.now()
      if (agora - monitor.ultimaForcadaEm < INTERVALO_MINIMO_FORCADO_MS) {
        responder(
          req,
          res,
          429,
          {
            erro: 'Varredura pedida há pouco — o ciclo automático cuida do resto.',
            proximaLiberacaoEm: monitor.ultimaForcadaEm + INTERVALO_MINIMO_FORCADO_MS,
          },
          { 'Retry-After': String(Math.ceil(INTERVALO_MINIMO_FORCADO_MS / 1000)) },
        )
        return
      }
      monitor.ultimaForcadaEm = agora
      // Não segura a requisição: a varredura leva segundos e o fronte já está
      // reconsultando a cada ciclo.
      void monitor.varrer()
      responder(req, res, 202, { aceito: true, monitorados: monitor.estado.size })
      return
    }

    if (rota === '/api/config/recarregar') {
      if (metodo !== 'POST') return responder(req, res, 405, { erro: 'Use POST' })
      if (!exigirToken(req, res)) return
      try {
        const recarregado = carregarConfig(ARQUIVO_CONFIG)
        monitor = new MonitorRede({
          config: recarregado.config,
          faixas: recarregado.faixas,
          hosts: recarregado.hosts,
        })
        for (const aviso of recarregado.avisos) log('monitor-dvr ⚠')(aviso)
        void monitor.varrer()
        responder(req, res, 200, {
          recarregado: true,
          monitorados: recarregado.hosts.length,
          escolas: recarregado.faixas.length,
        })
      } catch (erro) {
        // Configuração inválida NÃO derruba o painel de quem está atendendo chamado.
        responder(req, res, 400, { erro: erro.message })
      }
      return
    }

    responder(req, res, 404, { erro: `Rota desconhecida: ${metodo} ${rota}` })
  } catch (erro) {
    log('monitor-dvr ✗')(erro)
    if (!res.headersSent) {
      responder(req, res, 500, { erro: 'Falha interna no serviço de monitoramento' })
    }
  }
})

/* ---------------- ciclo de varredura ---------------- */

// setTimeout recursivo em vez de setInterval: se uma varredura atrasar, a
// próxima só é agendada depois que a anterior termina — em vez de acumular.
function agendar() {
  const espera = Math.max(1000, monitor.config.intervaloSegundos * 1000)
  setTimeout(async () => {
    try {
      await monitor.varrer()
    } catch (erro) {
      log('monitor-dvr ✗')('falha na varredura:', erro.message)
    } finally {
      agendar()
    }
  }, espera)
}

servidor.listen(config.porta, config.host, () => {
  log('monitor-dvr')(`escutando em http://${config.host}:${config.porta} — ${config.caminho}`)
  if (!SSO_SECRET) {
    log('monitor-dvr ⚠')(
      'SSO_SECRET ausente: as rotas /api/* vão responder 503. ' +
        'Use o JWT_SECRET do backend de chamados.',
    )
  }
  // Primeira varredura já na subida: quem abrir a tela logo depois do serviço
  // subir vê estado real, não "aguardando" até o ciclo fechar.
  void monitor.varrer().finally(agendar)
})

function encerrar(sinal) {
  log('monitor-dvr')(`recebido ${sinal}, encerrando…`)
  servidor.close(() => process.exit(0))
  // Se algum socket prender o shutdown, não segurar para sempre.
  setTimeout(() => process.exit(0), 3000).unref()
}

process.on('SIGINT', () => encerrar('SIGINT'))
process.on('SIGTERM', () => encerrar('SIGTERM'))