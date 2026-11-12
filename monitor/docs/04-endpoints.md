# 04 · Endpoints

| Rota | Auth | Descrição |
|---|---|---|
| `GET /health` | público | `{ ok, servico, ssoConfigurado, monitorados, escolas, emAndamento, ultimaVarreduraEm, totalVarreduras, uptimeSegundos }` |
| `GET /api/resumo` | JWT + nível | Totais + por faixa (payload pequeno) |
| `GET /api/hosts` | JWT + nível | Totais + lista completa de DVRs |
| `GET /api/escolas` | JWT + nível | Escolas com contagem ligadas/desligadas |
| `POST /api/varredura` | JWT + nível | Força varredura (rate-limit 15s, 429); 202 imediato, varre em background |
| `POST /api/config/recarregar` | JWT + nível | Relê `config.json` sem reiniciar (400 em config inválida) |

Preflight `OPTIONS` tratado antes do token. CORS via `cabecalhosCors`.
Cache-Control `no-store`.