# 17 · Assistente CaféIA (público)

Assistente conversacional público (sem login) para abertura de chamados, disponível
em `/assistente`. Usa o modelo `Beam-1.0-501B-A23B` (reflection.ai) via proxy do
backend de chamados (`/api/ia/publico/chat`).

## Como funciona

- Página pública: `/assistente` (rota `assistente`, meta `public: true`).
- Componente: `src/views/publico/ChatChamadoView.vue`.
- A IA guia o usuário passo a passo: identifica categoria, coleta perguntas
  obrigatórias, identificação e cria o chamado via tool `criar_chamado`.
- Histórico da conversa é salvo em `localStorage` (chave `cafeia_publico_conversa`)
  para não perder ao recarregar.
- Botões de opção `[[...]]` renderizados como botões clicáveis (um por linha).
- Formulário de identificação inline (modal) com select de escola/cargo/urgência
  e campos de nome/e-mail.
- Guardrail: responde apenas sobre abertura/acompanhamento de chamados.

## Endpoints (backend)

- `POST /api/ia/publico/chat` — proxy de IA sem auth, rate limit 30/min/IP.
- `GET /api/ia/publico/modelos` — lista modelos disponíveis.

## Impacto de contrato

- Novos endpoints públicos no backend de chamados.
- Portal consome via `publicoHttp`.

## Arquivos

- `src/views/publico/ChatChamadoView.vue`
- `src/api/publico.ts` (funções `chamarIAPublico`, `listarModelosIAPublico`)
- `src/router/index.ts` (rota `/assistente`)
- Link de entrada: botão "Falar com a CaféIA" em `/chamado/novo`.
