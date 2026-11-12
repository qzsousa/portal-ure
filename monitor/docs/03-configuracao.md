# 03 · Configuração

## Variáveis de ambiente (`.env`)

- `SSO_SECRET` (obrigatório): igual ao `JWT_SECRET` do chamados; sem ele,
  `/api/*` responde 503.
- `PORTA` (4000), `HOST` (127.0.0.1).
- `NIVEIS_PERMITIDOS` (ADMIN).
- `CORS_ORIGENS` (vazio = qualquer origem).
- `MONITOR_CONFIG`, `INTERVALO_SEGUNDOS`, `CONCORRENCIA`, `TIMEOUT_PING_MS`.

## Manifesto (`config.json`)

`intervaloSegundos` (30), `concorrencia` (48), `timeoutPingMs` (1000),
`timeoutPortaMs` (800), `historico` (30), `portasPadrao` ([80, 8000, 554, 443,
37777]), `faixas` (array de escolas com DVRs). Cada IP: `{ip, hostname, tipo}`
(ADM/PED). `carregarConfig` valida tudo de uma vez (máx. 5000 hosts).

## Importação

`scripts/parse-dvr.mjs` lê `dvr-raw.txt` (formato `Group: E.E. ...` + linhas
`IP HOSTNAME TIPO`) e gera `config.json`.