# 19 · Chat IA (CaféIA)

Assistente conversacional do portal, restrito a **ADMIN** (`/chat`). Backend de
chamados expõe os endpoints `/ia/*` (modelos, chat streaming, resumo).

## Visão geral

- UI em `src/views/ChatIaView.vue`: histórico de conversas (lateral), painel de
  seleção de modelo, área de streaming de mensagens, sugestões iniciais.
- Branding: logo `/logoCafeIA.png`, nome **CaféIA**.
- Conversas salvas por usuário (título, data de atualização); exclusão individual.
- Seleção de modelo LLM via painel filtrável (`/ia/modelos`).
- Status de carregamento da base ("Espere um pouco, o café já está passando!").

## Contexto (resumo agregado)

`src/composables/useContextoIA.ts` monta um resumo dos **dois backends** uma única
vez por aba:

- Chamados: total, por status, abertos por escola, resolvidos por técnico,
  técnico→escola (via `/ia/resumo`).
- Equipamentos: total, por status, top 10 unidades com mais disponíveis
  (via `/unidades-resumo` e `/equipamentos-global`).

Carregado por `App.vue` na subida do portal; reaproveitado em qualquer tela.
Chamadas concorrentes compartilham a mesma promessa (`emVoo`).

## Ações (ia/acoes.ts)

A IA pode executar ações estruturadas além de responder texto — consultar agenda,
solicitar ponto, etc. Ver `src/ia/acoes.ts`.

## Permissões

Rota `meta.roles: [ADMIN]` e `meta.rota: 'dashboard'`. Técnicos e gestores não
acessam.

## Ver também

[05 · Rotas e telas](./05-rotas-e-telas.md) ·
[07 · Estado, stores e composables](./07-estado-stores-composables.md)