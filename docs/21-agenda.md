# 21 · Agenda

Calendário de atribuições por dia (`/agenda`), restrito a ADMIN e TÉCNICO.
Backend de chamados em `/agenda/*`.

## Visão geral

- UI em `src/views/AgendaView.vue`; API em `src/api/agenda.ts`.
- Navegação por mês (anterior/próximo), grade de dias com atribuições.
- Atribuir técnico a um dia/escola (`atribuirDia`), remover atribuição
  (somente ADMIN).
- Cores por técnico via `corDoTecnico` (hash de cor determinístico).
- Lista de técnicos ordenada (`ordenarTecnicos`), escolas via `/usuarios`.
- Integração com Chat IA (consulta de agenda).

## Permissões

Atribuir: ADMIN e TÉCNICO. Remover: somente ADMIN.

## Ver também

[05 · Rotas e telas](./05-rotas-e-telas.md) ·
[19 · Chat IA](./19-chat-ia.md)