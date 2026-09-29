# Portal URE Leste 3

Portal unificado da **Unidade Regional de Ensino Leste 3** (SETEC) — chamados de
suporte técnico e inventário de equipamentos em uma única interface.

📚 **Documentação completa em [`/docs`](./docs/README.md)** — 12 capítulos e 29
prints reais do sistema rodando, incluindo um
[guia de tratamento de erros](./docs/09-tratamento-de-erros.md).

---

## Stack

Vue 3 · TypeScript · Vite · Pinia · Vue Router · Chart.js · axios

## Rodando local

```bash
npm install
cp .env.example .env     # Windows: Copy-Item .env.example .env
npm run dev              # http://localhost:5173
```

O portal precisa dos **dois backends** no ar:

| Serviço | Porta | Repositório |
|---|---|---|
| Backend de chamados (identidade, chamados, usuários) | `10000` | `~/Desktop/chamados` |
| SCE (equipamentos, manutenção, catálogo) | `3000` | `~/Desktop/sce` |

Ajuste as URLs em `.env`:

```bash
VITE_API_CHAMADOS_URL=http://localhost:10000/api
VITE_API_SCE_URL=http://localhost:3000/api
```

## Scripts

```bash
npm run dev       # servidor de desenvolvimento (HMR)
npm run build     # vue-tsc (checagem de tipos) + build de produção
npm run preview   # serve o dist/ localmente
```

> No Windows, para subir qualquer um dos três processos use
> `dev-restart -Port <PORTA> -Dir <DIR>` em vez de montar o comando à mão —
> veja [Build, deploy e ambientes](./docs/10-build-deploy-ambientes.md#subindo-os-backends-com-segurança-windows).

## Primeiro passo se algo não funcionar

1. **Configurações → Integrações → "Testar agora"** — diz exatamente qual
   backend está fora.
2. **Configurações → Logs do sistema** — mostra o erro real, com método, rota,
   status e mensagem.
3. Se nada disso responder: [capítulo 9 da documentação](./docs/09-tratamento-de-erros.md).

## Estrutura

```
src/
  api/         clientes HTTP (um módulo por backend/recurso)
  components/  layout, ui, config, equipamentos, tutoriais, publico
  composables/ useAutoRefresh, useSidebar, useEquipamentos
  router/      rotas + guard de autenticação/permissão
  stores/      auth, ui (toasts), errorLog
  styles/      tokens.css + main.css
  types/       contratos TypeScript compartilhados
  utils/       format, apiError, escola
  views/       telas (públicas em views/publico/)
```

Detalhes: [Estrutura do projeto](./docs/03-estrutura-do-projeto.md).
