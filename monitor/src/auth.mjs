/**
 * Autenticação e CORS do serviço de monitoramento.
 *
 * O serviço NÃO tem usuário e senha próprios: ele valida o MESMO access token
 * JWT que o portal já usa (o do backend de chamados), com o mesmo `SSO_SECRET`
 * compartilhado — exatamente o que o SCE faz para validar quem entra no módulo
 * de equipamentos. Efeito prático: o login do portal já abre o monitoramento,
 * sem segunda senha, sem sessão paralela para expirar.
 *
 * A verificação é feita com `node:crypto`, sem `jsonwebtoken`: o serviço não
 * instala nada na máquina, e o algoritmo fica FIXADO em HS256. Fixar o `alg` é
 * o que impede o ataque clássico de "alg: none" e de trocar HS256 por HS512
 * para passar a verificação sem conhecer o segredo.
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
 * Rejeita, além da assinatura inválida:
 * - token expirado (com 30 s de tolerância para o relógio do servidor);
 * - refresh token (`type: 'refresh'`) — quem tem refresh token não tem acesso
 *   a API até trocar por um access token.
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
 * Monta os cabeçalhos de CORS.
 *
 * O portal roda em outra origem (Vercel) e o serviço fica na rede privada,
 * então sem isto o navegador bloqueia a resposta — e o sintoma é uma tela
 * vazia sem mensagem, porque o erro do CORS só aparece no console.
 *
 * `origens` vazia = liberado para qualquer origem. Com lista, só a origem do
 * pedido que estiver na lista é liberada. Nunca usamos `*` junto de credenciais:
 * o portal manda o token no cabeçalho (não cookie), e `Allow-Credentials`
 * quebraria o `*`.
 */
export function cabecalhosCors(origens, origemRequisicao = null) {
  const permitidas = Array.isArray(origens) ? origens.filter(Boolean) : []
  const liberada = permitidas.length === 0 ? '*' : permitidas.includes(origemRequisicao) ? origemRequisicao : null

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