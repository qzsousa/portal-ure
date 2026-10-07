import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { cabecalhosCors, tokenDoCabecalho, verificarToken } from '../src/auth.mjs'

const SEGREDO = 'segredo-de-teste-do-monitor'

function base64url(entrada) {
  return Buffer.from(entrada).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function assinar(payload, segredo = SEGREDO, alg = 'HS256') {
  const cabecalho = base64url(JSON.stringify({ alg, typ: 'JWT' }))
  const corpo = base64url(JSON.stringify(payload))
  const assinatura =
    alg === 'HS256'
      ? createHmac('sha256', segredo).update(`${cabecalho}.${corpo}`).digest('base64url')
      : 'assinatura-forjada'
  return `${cabecalho}.${corpo}.${assinatura.replace(/=+$/, '')}`
}

const ACCESS = {
  type: 'access',
  email: 'tecnico@ure.leste3.sec.gov.br',
  nivel: 'TECNICO',
  exp: Math.floor(Date.now() / 1000) + 900,
}

test('token válido do portal é aceito', () => {
  const payload = verificarToken(assinar(ACCESS), SEGREDO)
  assert.equal(payload.email, ACCESS.email)
  assert.equal(payload.nivel, 'TECNICO')
})

test('assinatura com segredo diferente é recusada', () => {
  // É o que acontece se o monitor receber um segredo que não é o JWT_SECRET
  // do backend de chamados: a tela volta 401 e o serviço parece "quebrado".
  assert.equal(verificarToken(assinar(ACCESS, 'outro-segredo'), SEGREDO), null)
})

test('payload adulterado continua inválido — a assinatura não bate', () => {
  const partes = assinar(ACCESS).split('.')
  const forjado = `${partes[0]}.${base64url(JSON.stringify({ ...ACCESS, nivel: 'ADMIN' }))}.${partes[2]}`
  assert.equal(verificarToken(forjado, SEGREDO), null)
})

test('alg "none" é recusado — sem fixar o algoritmo o token passa forjado', () => {
  assert.equal(verificarToken(assinar(ACCESS, SEGREDO, 'none'), SEGREDO), null)
})

test('HS512 (mesma família HMAC) é recusado', () => {
  assert.equal(verificarToken(assinar(ACCESS, SEGREDO, 'HS512'), SEGREDO), null)
})

test('token expirado é recusado, com 30 s de tolerância de relógio', () => {
  const vencido = { ...ACCESS, exp: Math.floor(Date.now() / 1000) - 120 }
  assert.equal(verificarToken(assinar(vencido), SEGREDO), null)

  const quase = { ...ACCESS, exp: Math.floor(Date.now() / 1000) - 10 }
  assert.ok(verificarToken(assinar(quase), SEGREDO))
})

test('refresh token não serve para API', () => {
  assert.equal(verificarToken(assinar({ ...ACCESS, type: 'refresh' }), SEGREDO), null)
})

test('token sem e-mail é recusado (ninguém para quem ele pertence)', () => {
  assert.equal(verificarToken(assinar({ type: 'access', exp: Math.floor(Date.now() / 1000) + 900 }), SEGREDO), null)
})

test('lixo, token vazio e string cortada não derrubam o serviço', () => {
  for (const entrada of [null, undefined, '', 'abc', 'a.b', 'a.b.c.d', '....']) {
    assert.equal(verificarToken(entrada, SEGREDO), null)
  }
  assert.equal(verificarToken(assinar(ACCESS), null), null)
})

test('lê o token do cabeçalho Authorization com caixa e espaço tolerados', () => {
  assert.equal(tokenDoCabecalho({ authorization: 'Bearer abc.def.ghi' }), 'abc.def.ghi')
  assert.equal(tokenDoCabecalho({ authorization: 'bearer abc.def.ghi' }), 'abc.def.ghi')
  assert.equal(tokenDoCabecalho({ authorization: 'Bearer  abc.def.ghi ' }), 'abc.def.ghi')
})

test('cabeçalho ausente ou em formato inesperado devolve null', () => {
  assert.equal(tokenDoCabecalho({}), null)
  assert.equal(tokenDoCabecalho({ authorization: 'abc.def.ghi' }), null)
  assert.equal(tokenDoCabecalho({ authorization: 'Basic dXNlcjpwdw==' }), null)
  assert.equal(tokenDoCabecalho(null), null)
})

test('sem lista de origens libera qualquer origem (o caso do portal na Vercel)', () => {
  const c = cabecalhosCors([], 'https://portal.exemplo.com')
  assert.equal(c['Access-Control-Allow-Origin'], '*')
  assert.equal(c.Vary, undefined)
  assert.match(c['Access-Control-Allow-Headers'], /Authorization/)
})

test('com lista de origens só a origem do pedido é aceita', () => {
  const origens = ['https://portal.exemplo.com']
  assert.equal(
    cabecalhosCors(origens, 'https://portal.exemplo.com')['Access-Control-Allow-Origin'],
    'https://portal.exemplo.com',
  )
  assert.equal(cabecalhosCors(origens, 'https://outro.exemplo.com')['Access-Control-Allow-Origin'], 'null')
  assert.equal(cabecalhosCors(origens, 'https://portal.exemplo.com').Vary, 'Origin')
})