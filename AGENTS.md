# Portal URE Leste 3 — AGENTS.md

Portal unificado da Unidade Regional de Ensino Leste 3 (SETEC): chamados de suporte técnico e inventário de equipamentos em uma interface. Documentação completa em `docs/README.md` (15 capítulos). Código em Vue 3 + TypeScript + Vite + Pinia + Vue Router.

## Setup

```bash
npm install
Copy-Item .env.example .env
npm run dev              # http://localhost:5173
```

O portal precisa dos três backends rodando: chamados (`:10000`, repo `~/Desktop/chamados`), SCE (`:3000`, repo `~/Desktop/sce`) e monitor de DVRs (`:4000`, pasta `monitor/`). URLs em `.env` (`VITE_API_CHAMADOS_URL`, `VITE_API_SCE_URL`, `VITE_API_MONITOR_URL`); há fallback em `src/api/http.ts`.

## Verificação

```bash
npm run build            # vue-tsc -b (checagem de tipos) + vite build -> dist/
npm run preview          # serve o dist/ localmente
```

Não há `test`, `lint` nem `format`. A "conferência" automática é o `vue-tsc` do build — rode `npm run build` ao terminar qualquer mudança e corrija erros de tipo.

## Servidores de dev (Windows)

Use sempre `dev-restart -Port <PORTA> -Dir <DIR_DO_PROJETO>` para subir/reiniciar qualquer servidor de dev. Nunca monte manualmente comando com `cmd.exe /c` ou segure processos de longa duração no shell (ver regras globais). Veja skill `dev-server`.

## Convenções

- Identificadores e comentários em português, exceto nomes herdados da plataforma (`ref`, `computed`, `props`, `emit`, `mount`, `watch`).
- Funções de API em `src/api/<recurso>.ts` no infinitivo (`listarChamados`, `criarEquipamento`); tipos compartilhados em `src/types/index.ts`.
- Views: `PascalCaseView.vue` em `src/views/` (públicas em `src/views/publico/`).
- CSS é scoped por padrão; apenas classes globais (`.card`, `.btn*`, `.field`, `.input`, `.table*`, reset) vivem em `src/styles/main.css`; tokens de design em `src/styles/tokens.css`.
- Strict TS (`tsconfig.app.json`); use aliases `@/`.

## Estrutura-chave

- `src/router/index.ts` — rotas, `meta` (public/roles/title) e guard global.
- `src/stores/auth.ts` — tokens, usuário, permissões, simulação de perfil.
- `src/api/http.ts` — instâncias axios, interceptors de refresh/log.
- `src/stores/ui.ts`, `src/utils/apiError.ts` — toasts e mensagens de erro legíveis.

## Regras

- `.env` e `monitor/config.json`, `monitor/dvr-raw.txt` não são versionados — não commitar.
- Variáveis `VITE_*` são embutidas no bundle em build e ficam públicas no navegador: nunca segredo.
- Antes de editar, leia a view/componente existente e siga o padrão; não crie arquivos novos sem necessidade.
- Não adicionar comentários, nem README/docs, salvo pedido explícito.