# 20 · Ponto

Registro de ponto com **geolocalização** (`/ponto`), disponível a todos os
autenticados. Backend de chamados em `/ponto/*`.

## Visão geral

- UI em `src/views/PontoView.vue`; estado em `src/stores/ponto.ts`; API em
  `src/api/ponto.ts`.
- Técnico registra ponto de visita a uma escola: GPS do navegador vs coordenadas
  da escola (distância via Haversine), status `NO_HORARIO`/`TARDIO_AUTORIZADO`.
- Lista de técnicos-alvo filtrada (`HEBERT, JOSEMIR, VALDEIR, CHARLES, JOAO,
  CAROL, GUILHERME`).
- Resumo do dia para admin (`resumoPontoHoje`), histórico por usuário, solicitações
  de ponto com aprovação/reprovação.
- Férias: marcar período por usuário (`marcarFerias`).
- Envio de WhatsApp (integração no fluxo).

## Redirecionamento automático

No `/painel`, às 17h técnicos são redirecionados para `/ponto` para garantir o
registro de fim de expediente.

## Permissões

Todos autenticados; ações administrativas (aprovar/reprovar, resumo) restritas a
ADMIN.

## Ver também

[05 · Rotas e telas](./05-rotas-e-telas.md) ·
[04 · Autenticação e permissões](./04-autenticacao-e-permissoes.md)