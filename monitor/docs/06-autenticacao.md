# 06 · Autenticação

Sem usuários próprios: valida o access token JWT do portal com o mesmo segredo
do backend de chamados (`SSO_SECRET` = `JWT_SECRET`).

- `auth.verificarToken`: split 3 partes, base64url decode, exige `alg === 'HS256'`
  e `typ === 'JWT'` (bloqueia `alg: none` e troca de algoritmo), verifica
  HMAC-SHA256 com `timingSafeEqual`, checa `exp` (30s tolerância), rejeita
  `type !== 'access'` e ausência de `email`.
- `tokenDoCabecalho`: extrai `Bearer <token>` do `Authorization`.
- `exigirToken`: 503 se `SSO_SECRET` ausente; 401 se token ausente/inválido;
  403 se nível não permitido (`NIVEIS_PERMITIDOS`, padrão ADMIN).

CORS: `origens` vazia → `*`; com lista, ecoa a origem se permitida; `Vary: Origin`
quando restrito. Nunca `*` com credenciais.