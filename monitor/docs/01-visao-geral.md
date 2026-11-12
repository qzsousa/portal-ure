# 01 · Visão geral

Serviço de monitoramento de **câmeras DVR** das escolas. Faz ping (ICMP + TCP)
nos DVRs cadastrados e expõe status online/offline, latência e histórico.

## Responsabilidades

- **Ping** de DVRs (ICMP via `ping.exe`, fallback TCP nas portas).
- **Cache de estado** com transições e histórico.
- **Agregações** (totais, por escola, latência média/máxima).
- **Importação** de lista de DVRs (parse de `dvr-raw.txt`).
- **Health check** público.
- **SSO** JWT (mesmo segredo do chamados).

## Stack

Node 18+ ESM, sem dependências externas (módulos nativos:
`node:http`, `node:crypto`, `node:fs`, `node:net`, `node:child_process`,
`node:perf_hooks`).