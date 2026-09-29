# 02 · Arquitetura

## O sistema em três aplicações

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   NAVEGADOR                                                     │
│   ┌───────────────────────────────────────────────────────────┐ │
│   │  PORTAL URE LESTE 3  (Vue 3 + Vite — este repositório)    │ │
│   │  · rotas, telas, componentes, stores                      │ │
│   │  · guarda de sessão (JWT + refresh)                        │ │
│   │  · 3 clientes HTTP: chamados, SCE, público                 │ │
│   └───────┬──────────────────────────────┬────────────────────┘ │
│           │ Bearer <JWT>                 │ Bearer <JWT>         │
│           ▼                              ▼                      │
│   ┌────────────────────┐        ┌────────────────────┐           │
│   │ BACKEND CHAMADOS   │        │ BACKEND SCE         │           │
│   │ :10000              │        │ :3000               │           │
│   │ Node 22 + Express   │        │ Node 18+ + Express   │           │
│   │ + Prisma            │        │ + Supabase JS        │           │
│   │ PostgreSQL (Supabase)│       │ PostgreSQL (Supabase)│           │
│   │                     │        │                      │           │
│   │ EMITE o JWT ─────────┼──SSO_SECRET compartilhado┼─► valida   │
│   │                     │        │                      │           │
│   │ identidade/usuários  │        │ equipamentos/         │           │
│   │ chamados/escolas     │        │ manutenção/           │           │
│   │ notificações        │        │ empréstimos            │           │
│   │ tutoriais           │        │ catálogo/auditoria     │           │
│   │ formulário/avaliação │        │ CSV/PDF               │           │
│   └────────────────────┘        └────────────────────┘           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Por que três e não um

O portal nasceu da **unificação progressiva** de dois sistemas que já rodavam:
o sistema de *chamados* e o *SCE* (controle de equipamentos). Reescrever os
dois seria arriscado e lento. A decisão foi construir a camada de apresentação
por cima, deixando cada backend como dono do seu domínio. Isso explica várias
características do código:

- **Dois clientes HTTP separados** (`chamadosApi` e `sceApi`), porque os
  contratos e as permissões são diferentes.
- **Envelope de resposta diferente**: o SCE responde `{ success, data, error }`
  e pode devolver **HTTP 200 com `success: false`**; o backend de chamados usa
  códigos HTTP reais (400/401/403/404/409/422).
- **Reconciliação de nomes de escola no frontend**: os dois sistemas escreveram
  os nomes de escola de formas diferentes, e o portal precisa casá-los
  (`src/utils/escola.ts`).
- **Um usuário do portal precisa existir nos dois sistemas**: o backend de
  chamados sincroniza cada usuário para o SCE via `POST /internal/sync-usuario`.

---

## Fluxo de autenticação

```
1. POST /api/auth/login           (Chamados)
   → Set-Cookie: refreshToken=<...>; HttpOnly; Secure; SameSite=None
   → corpo JSON: { accessToken, user, primeiroLogin }
                   ↑ só o accessToken chega ao JavaScript

2. O frontend guarda o accessToken SÓ EM MEMÓRIA (store auth).
   O refreshToken de 7 dias viaja num cookie httpOnly — nenhum
   script da página consegue lê-lo.

3. Toda requisição autenticada leva:
     Authorization: Bearer <accessToken>
   (o cookie httpOnly é anexado pelo navegador sozinho, sem o JS intervir)

4. Se a resposta é 401 (access token expirou, 15 min):
   a fila de refresh dispara POST /api/auth/refresh com corpo VAZIO
   uma única vez; as requisições que estavam aguardando
   são retomadas com o token novo.

5. Se o refresh também falha (401/403):
   `clearSession()` → limpa a memória → o guard leva para /login.

6. Ao RECARREGAR a página (F5) não há token em disco para recuperar.
   `initialize()` chama /auth/refresh com o cookie; se responder, a
   sessão é reconstruída; se der 401, o usuário segue deslogado
   (o 401 é o resultado esperado, não um erro).

7. Toda requisição ao SCE leva o MESMO accessToken.
   O SCE:
     a) procura um token nativo na tabela `sessoes`; ou
     b) valida o JWT com `SSO_SECRET` e resolve o usuário
        pelo e-mail na tabela local `usuarios`.
   O SCE NUNCA confia no `nivel` do JWT — ele lê do próprio banco.
```

> **Por que o token não fica no `localStorage`.** O `localStorage` é legível
> por qualquer script da página. Uma única dependência comprometida — ou um
> XSS — daria acesso a uma credencial de longa duração. O custo é pequeno e
> está registrado em [Decisões de projeto](#decisões-de-projeto-que-valem-registro).

### Fila de refresh (evita corrida)

O `src/api/http.ts` mantém `isRefreshing` e `failedQueue`. Quando várias
requisições tomam 401 ao mesmo tempo, **apenas a primeira** faz o refresh; as
outras ficam em uma fila e são retomadas quando o token novo chega. Isso evita
que um burst de polling (sino + topbar + tabela) derrube o refresh token na
rotação.

---

## Camadas do frontend

```
┌──────────────────────────────────────────────────────────┐
│ views/            Telas (páginas completas)               │
│   publico/        telas sem login (shell PublicoLayout)   │
│   ConfiguracoesView etc.  telas internas (AppShell)      │
├──────────────────────────────────────────────────────────┤
│ components/       Componentes                            │
│   layout/         AppShell, AppSidebar, AppTopbar         │
│   ui/             StatCard, StatusPill, BaseModal, ...   │
│   publico/        PublicoLayout, BarChartCard            │
│   config/         Formulário de chamados (ADMIN)         │
│   equipamentos/   Formulário de equipamento, gráficos    │
│   tutoriais/      Formulário de tutorial                  │
├──────────────────────────────────────────────────────────┤
│ stores/           Pinia: auth, ui (toasts), errorLog     │
│ composables/      useAutoRefresh, useSidebar,             │
│                   useEquipamentos                         │
├──────────────────────────────────────────────────────────┤
│ api/              Um módulo por backend/recurso          │
│   http.ts         Clientes axios + interceptors           │
│   chamados.ts  sce.ts  publico.ts  usuarios.ts           │
│   encaminhamentos.ts  formulario.ts  tutoriais.ts        │
│   escolas.ts  feedback.ts  notificacoes.ts               │
├──────────────────────────────────────────────────────────┤
│ types/            Contratos TypeScript compartilhados      │
│ utils/            format, apiError, escola                │
│ styles/           tokens.css + main.css (globais)         │
└──────────────────────────────────────────────────────────┘
```

**Regra prática:** `views/` nunca chama `axios` direto. Sempre passa por
`api/`. E nenhuma tela faz `fetch` cru sem tratamento de erro.

---

## Estado: onde cada coisa mora

| Dado | Onde vive | Por quê |
|---|---|---|
| `accessToken` | `stores/auth.ts` (**memória**) | Não pode ser lido por script da página |
| `refreshToken` | cookie `httpOnly` (não acessível ao JS) | Credencial de 7 dias fora do alcance do navegador |
| Usuário logado | `stores/auth.ts` (memória) | Reconstruído a cada F5 via `/auth/me` |
| Toasts | `stores/ui.ts` (memória) | Precisam sumir sozinhos |
| Log de erros de backend | `stores/errorLog.ts` + `localStorage` | O ADMIN precisa ver depois que a tela já saiu — e as mensagens são **sanitizadas** antes de gravar |
| Drawer da sidebar (mobile) | `composables/useSidebar.ts` (singleton de módulo) | Só o shell usa; não justifica store |
| Equipamentos (lista, filtros, agregados) | `composables/useEquipamentos.ts` | Estado por tela, com duas estratégias (servidor vs. local) |
| Filtros de lista, paginação, modais | `ref`/`reactive` dentro da view | Não sobrevivem à navegação |

Nada de estado global "genérico": não existe store `app` nem store `filtros`.
O que é compartilhado por telas distintas vira composable; o que é de uma tela
só fica na tela.

---

## Atualização automática (polling)

`composables/useAutoRefresh.ts` é o único mecanismo de polling:

| Constante | Intervalo | Telas |
|---|---|---|
| `AUTO_REFRESH_MS.rapido` | 30 s | Chamados, Equipamentos, Consulta pública, Painel geral |
| `AUTO_REFRESH_MS.normal` | 60 s | Painel, Manutenção, Feedback, Painel do dirigente |

Regras que ele garante:

1. **Pausa com a aba oculta** (`document.hidden`) — não gasta bateria nem banda.
2. **Atualiza na hora ao voltar para a aba** (`visibilitychange`) — quem abre o
   notebook depois do almoço vê os dados do momento, não de uma hora atrás.
3. **Nunca sobrepõe execuções** — se a rodada anterior ainda está em voo, a
   próxima é ignorada.
4. **O callback precisa ser silencioso** — sem spinner, sem mensagem de erro, sem
   apagar os dados que já estão na tela. Uma falha de polling não pode assustar
   o usuário nem apagar o trabalho que ele está lendo.

Além do `useAutoRefresh`, existem dois timers manuais:

- **Sino de notificações** (`AppTopbar`): 30 s, e falha é **silenciosa** por
  decisão explícita — "a topbar não pode quebrar por causa do sino".
- **Relógio da topbar**: `setTimeout` realinhado na virada do minuto
  (`60_000 - Date.now() % 60_000 + 50`), não `setInterval` de 1 s — redesenha
  uma vez por minuto em vez de 60.

---

## Decisões de projeto que valem registro

| Decisão | Motivo |
|---|---|
| **Access token só em memória** | `localStorage` é legível por qualquer script da página. Uma dependência comprometida ou um XSS daria acesso à sessão. O refresh token de 7 dias viaja em cookie `httpOnly`. |
| **CSP e headers de segurança** | `vercel.json` define `Content-Security-Policy` (sem `unsafe-inline` em `script-src`), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, HSTS, `Permissions-Policy` e `Cross-Origin-Opener-Policy`. O `index.html` traz um CSP de fallback porque o dev server do Vite não lê o `vercel.json`. |
| **Mensagens do log de erro sanitizadas** | O log é gravado em `localStorage`, então tokens e cabeçalhos `Bearer` são redigidos e a mensagem é truncada — inclusive re-sanitizando o que já estava gravado por versões anteriores. |
| **Simulação de perfil só em desenvolvimento** | `import.meta.env.DEV`. Em produção levava o usuário a crer que trocar perfil era uma função real de autorização, e escondia bugs de menu/guard. |
| Sem biblioteca de UI | Todo o visual vem de `tokens.css` + classes globais. Vocabulário próprio, sem dependência externa. |
| `@lucide/vue` para ícones | Consistente, tree-shakeable, sem SVG embutido à mão. |
| Chart.js via `vue-chartjs` | Gráficos de rosca e barras são requisito dos painéis; a biblioteca é registrada módulo a módulo (só o que é usado). |
| `lucide` + `chart.js` registrados por componente | Evita `import 'chart.js/auto'` (bundle maior) e mantém o build rápido. |
| Modais com `Teleport to body` | Modais de tabela e menus de ação são recortados por `overflow: hidden` dos containers; o teleport resolve. |
| Rotas com `import()` dinâmico | Cada tela vira um chunk separado; o primeiro carregamento do portal é leve. |
| `document.title` dinâmico por rota | Aba do navegador identifica a tela. |
| Confirmações com `window.confirm` | Exclusão de chamado, de usuário, de catálogo e de regra são ações destrutivas; a confirmação nativa é mais difícil de contornar por engano do que um modal custom sem histórico. |
| `papelUnidade` calculado no backend | O papel MÃE/FILHA depende do catálogo de escolas, que muda. Calcular no frontend duplicaria a regra e poderia divergir. |
| Normalizar nomes de escola no frontend | Cada backend normaliza do seu jeito; o casamento é feito em um único lugar (`utils/escola.ts`) em vez de espalhado. |

---

## Stack resumida

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Vue | ^3.5.42 |
| Linguagem | TypeScript | ~6.0.2 |
| Build | Vite | ^8.3.0 |
| Rotas | vue-router | ^4.6.4 |
| Estado | pinia | ^4.0.3 |
| HTTP | axios | ^1.20.0 |
| Gráficos | chart.js + vue-chartjs | ^4.5.1 / ^5.3.4 |
| Ícones | @lucide/vue | ^1.46.0 |
| Checagem de tipos | vue-tsc | ^3.3.11 |

Detalhe de configuração em [Build, deploy e ambientes](./10-build-deploy-ambientes.md).

---

Ver também: [Visão geral](./01-visao-geral.md) ·
[Estrutura do projeto](./03-estrutura-do-projeto.md) ·
[Backends e endpoints](./06-backends-e-endpoints.md)
