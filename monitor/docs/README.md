# Monitor de DVRs — Documentação

Node.js 18+ (ESM), sem dependências externas. Serviço HTTP em `127.0.0.1:4000`,
consumido pelo portal via Cloudflare Tunnel.

## Por onde começar

| Se você quer… | Leia |
|---|---|
| Entender o que o serviço faz | [01 · Visão geral](./01-visao-geral.md) |
| Entender a estrutura | [02 · Estrutura do projeto](./02-estrutura-do-projeto.md) |
| Configurar o serviço | [03 · Configuração](./03-configuracao.md) |
| Descobrir endpoints | [04 · Endpoints](./04-endpoints.md) |
| Entender ping/sonda | [05 · Ping e sonda](./05-ping-e-sonda.md) |
| Entender autenticação (SSO) | [06 · Autenticação](./06-autenticacao.md) |
| Fazer manutenção | [07 · Manutenção](./07-manutencao.md) |

## Resumo em 30 segundos

- **Stack:** Node 18+ ESM, sem dependências (só módulos nativos).
- **Porta:** `4000` (`127.0.0.1`).
- **Auth:** SSO JWT (mesmo segredo do chamados).
- **Ping:** ICMP (`ping.exe`) + fallback TCP nas portas configuradas.
- **Ciclo:** varredura inicial no boot + intervalo configurável.