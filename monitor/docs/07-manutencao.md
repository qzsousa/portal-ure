# 07 · Manutenção

## Tarefas comuns

- **Rodar:** `npm start` (ou `node server.mjs`).
- **Testes:** `npm test` (39 testes, runner nativo do Node).
- **Parse de DVRs:** `npm run parse-dvr`.
- **Recarregar config sem reiniciar:** `POST /api/config/recarregar`.

## Troubleshooting

- **503 em /api/*:** `SSO_SECRET` ausente ou diferente do chamados.
- **401:** token expirado ou segredo diferente.
- **DVRs não aparecem:** verificar `config.json` e `carregarConfig`.
- **Ping não funciona:** verificar `ping.exe` disponível (Windows) ou permissões.

## Testes

`testes/*.test.mjs`: validação do manifesto, JWT (alg:none, refresh token,
expirado), pool de concorrência, transições de estado, sondas contra loopback.