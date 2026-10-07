/**
 * Autenticação e CORS.
 *
 * Sem usuário e senha próprios: o serviço valida o access token JWT que o
 * portal já usa, com o mesmo segredo com que o backend de chamados o assina.
 * Fixar o algoritmo em HS256 (`node:crypto`, sem o `jsonwebtoken`) é o que
 * impede o ataque clássico de "alg: none" e de trocar HS256 por HS512 para
 * passar sem conhecer o segredo.
 *
 * ⚠️ O segredo é o **`JWT_SECRET` do backend de chamados**. No SCE o mesmo
 * valor chama-se `SSO_SECRET` — mas no backend de chamados NÃO existe variável
 * com esse nome. Quem procurar lá não encontra e pode gerar um segredo novo, e
 * aí o monitor rejeita tokens válidos silenciosamente.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

function base64urlParaBuffer(texto) {
  const normalizado = texto.replace(/-/g, '+').replace(/_/g, '/')
  const preenchimento = '='.repeat((4 - (normalizado.length % 4)) % 4)
  return Buffer.from(normalizado + preenchimento, 'base64')
}

function assinaturaValida(token, segredo) {
  const partes = token.split('.')
  if (partes.length !== 3) return false
  const [cabecalho, corpo] = partes
  const esperada = createHmac('sha256', segredo).update(`${cabecalho}.${corpo}`).digest()
  let recebida
  try {
    recebida = base64urlParaBuffer(partes[2])
  } catch {
    return false
  }
  if (recebida.length !== esperada.length) return false
  return timingSafeEqual(recebida, esperada)
}

/**
 * Valida o token e devolve o payload, ou `null`.
 *
 * Rejeita, além de assinatura errada:
 *  - token expirado (com 30 s de tolerância de relógio);
 *  - refresh token (`type: 'refresh'`) — o refresh não acessa API.
 */
export function verificarToken(token, segredo) {
  if (!token || !segredo) return null

  const partes = String(token).split('.')
  if (partes.length !== 3) return null

  let cabecalho
  let payload
  try {
    cabecalho = JSON.parse(base64urlParaBuffer(partes[0]).toString('utf8'))
    payload = JSON.parse(base64urlParaBuffer(partes[1]).toString('utf8'))
  } catch {
    return null
  }

  if (!cabecalho || cabecalho.alg !== 'HS256' || cabecalho.typ !== 'JWT') return null
  if (!assinaturaValida(token, segredo)) return null

  const agora = Math.floor(Date.now() / 1000)
  if (typeof payload.exp === 'number' && agora > payload.exp + 30) return null

  if (payload.type !== 'access') return null
  if (!payload.email) return null

  return payload
}

/** Extrai o token do cabeçalho `Authorization: Bearer …`. */
export function tokenDoCabecalho(cabecalho) {
  const bruto = cabecalho?.authorization || cabecalho?.Authorization
  if (typeof bruto !== 'string') return null
  const partes = bruto.trim().split(/\s+/)
  if (partes.length !== 2 || partes[0].toLowerCase() !== 'bearer') return null
  return partes[1] || null
}

/**
 * Cabeçalhos de CORS.
 *
 * O portal roda em outra origem (Vercel). Sem estes cabeçalhos o navegador
 * cancela a resposta do fetch antes do JS ler — e o sintoma é tela em branco,
 * com o erro só no console.
 *
 * `origens` vazia = qualquer origem (padrão, porque a API só devolve dado sob
 * token válido). Com lista, só a origem do pedido que estiver nela é aceita.
 * Nunca `*` junto de credenciais: o portal manda o token no cabeçalho, e
 * `Allow-Credentials` aqui quebraria o `*`.
 */
export function cabecalhosCors(origens, origemRequisicao = null) {
  const permitidas = Array.isArray(origens) ? origens.filter(Boolean) : []
  const liberada =
    permitidas.length === 0 ? '*' : permitidas.includes(origemRequisicao) ? origemRequisicao : null

  const cabecalhos = {
    'Access-Control-Allow-Origin': liberada ?? 'null',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    'Access-Control-Expose-Headers': 'Content-Type',
  }
  if (permitidas.length > 0) cabecalhos.Vary = 'Origin'
  return cabecalhos
}