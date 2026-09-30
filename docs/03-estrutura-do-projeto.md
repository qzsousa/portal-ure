# 03 · Estrutura do projeto

## Árvore completa

```
portal/
├── index.html              Mount point (#app) + meta tags
├── package.json            Scripts e dependências
├── vite.config.ts          Plugin Vue, alias @, porta 5173
├── vercel.json             Rewrite SPA: tudo → index.html
├── tsconfig.json           Referências a app + node
├── tsconfig.app.json       Regras do código de src/ (strict)
├── tsconfig.node.json      Regras do vite.config.ts
├── .env.example            Modelo das variáveis de ambiente
├── .env                    Local (NÃO versionado)
│
├── public/
│   └── logo-ure.png        Brasão usado na sidebar, login e páginas públicas
│
├── docs/                   ← esta documentação
│   ├── README.md
│   ├── 01…12-*.md
│   └── screenshots/
│
└── src/
    ├── main.ts             createApp + pinia + router + main.css
    ├── App.vue             <RouterView/> + <ToastContainer/>
    │
    ├── router/
    │   └── index.ts        Rotas, meta (public/roles/title) e guard global
    │
    ├── types/
    │   └── index.ts        Nivel, PapelUnidade, User, Chamado, Equipamento…
    │
    ├── api/
    │   ├── http.ts         chamadosApi, sceApi, interceptors de refresh e log
    │   ├── chamados.ts     Chamados, status, mensagens, encaminhamento
    │   ├── sce.ts          Equipamentos, unidades, catálogo, exportação
    │   ├── publico.ts      Endpoints SEM autenticação (axios puro)
    │   ├── usuarios.ts     CRUD de usuários + lista de escolas
    │   ├── escolas.ts      Painel de unidades (1 linha por prédio)
    │   ├── notificacoes.ts Sino da topbar
    │   ├── tutoriais.ts    Base de conhecimento
    │   ├── formulario.ts   Categorias e perguntas do formulário público
    │   ├── encaminhamentos.ts  Regras de encaminhamento automático (ADMIN)
    │   └── feedback.ts     Avaliações + elogios/sugestões (autenticado)
    │
    ├── stores/
    │   ├── auth.ts         Tokens, usuário, permissões, simulação de perfil
    │   ├── ui.ts           Fila de toasts
    │   └── errorLog.ts     Registro persistente de erros de backend
    │
    ├── composables/
    │   ├── useAutoRefresh.ts  Polling com pausa e anti-overlap
    │   ├── useSidebar.ts      Drawer mobile (singleton de módulo)
    │   └── useEquipamentos.ts Fonte de dados de equipamentos (2 estratégias)
    │
    ├── utils/
    │   ├── format.ts       formatDate / formatDateTime (America/Sao_Paulo)
    │   ├── apiError.ts     Extrai mensagem legível de erro da API
    │   ├── tecnicos.ts     Escala de atendimento (quem pode receber um chamado)
    │   └── escola.ts       Casa nomes de escola entre os dois backends
    │
    ├── views/
    │   ├── LoginView.vue
    │   ├── TrocarSenhaView.vue
    │   ├── PainelView.vue
    │   ├── EquipamentosView.vue
    │   ├── ManutencaoView.vue
    │   ├── ChamadosView.vue
    │   ├── TutoriaisView.vue
    │   ├── TutorialDetalheView.vue
    │   ├── UnidadesView.vue
    │   ├── RelatoriosView.vue
    │   ├── UsuariosView.vue
    │   ├── FeedbackView.vue
    │   ├── ConfiguracoesView.vue
    │   ├── StubView.vue         (óptico — não usado por nenhuma rota)
    │   └── publico/
    │       ├── NovoChamadoView.vue
    │       ├── ConsultaProtocoloView.vue
    │       ├── ElogiosSugestoesView.vue
    │       ├── TutorialPublicoView.vue
    │       ├── DashboardPublicoView.vue
    │       └── DashboardDirigenteView.vue
    │
    ├── components/
    │   ├── layout/
    │   │   ├── AppShell.vue       Sidebar + topbar + RouterView
    │   │   ├── AppSidebar.vue     Menu filtrado por perfil
    │   │   └── AppTopbar.vue      Título, relógio, sino, menu do usuário
    │   ├── ui/
    │   │   ├── StatCard.vue       Card de KPI
    │   │   ├── StatusPill.vue     Pílula de status (tom inferido do texto)
    │   │   ├── DonutCard.vue      Gráfico de rosca + legenda
    │   │   ├── PaginationBar.vue  Paginação padrão
    │   │   ├── BaseModal.vue      Modal base (Teleport, backdrop, footer)
    │   │   ├── RowActions.vue     Menu "⋮" de ações da linha
    │   │   └── ToastContainer.vue Renderiza a fila de toasts
    │   ├── publico/
    │   │   ├── PublicoLayout.vue  Moldura das páginas públicas
    │   │   └── BarChartCard.vue   Gráfico de barras
    │   ├── config/
    │   │   ├── FormularioAdmin.vue      Aba do formulário
    │   │   ├── CategoriaFormModal.vue   Criar/editar categoria
    │   │   └── PerguntaFormModal.vue    Criar/editar pergunta
    │   ├── equipamentos/
    │   │   ├── EquipamentoFormModal.vue Criar/editar equipamento
    │   │   └── GraficoCategorias.vue    Rosca com drilldown
    │   └── tutoriais/
    │       └── TutorialFormModal.vue    Criar/editar tutorial
    │
    └── styles/
        ├── tokens.css       Variáveis de design (cor, raio, sombra, medida)
        └── main.css         Reset + classes globais (.card, .btn, .table…)
```

---

## Convenções de nomenclatura

| Tipo | Padrão | Exemplo |
|---|---|---|
| Componente de tela | `PascalCaseView.vue` | `ChamadosView.vue` |
| Componente | `PascalCase.vue` | `StatCard.vue` |
| Tela pública | `src/views/publico/` | `NovoChamadoView.vue` |
| Módulo de API | substantivo do recurso | `chamados.ts`, `notificacoes.ts` |
| Store | substantivo | `auth.ts`, `ui.ts`, `errorLog.ts` |
| Composable | `use` + PascalCase | `useAutoRefresh.ts` |
| Função de API | verbo no infinitivo | `listarChamados`, `criarEquipamento` |
| Variável de API | substantivo singular | `TecnicoDestino`, `UnidadeResumo` |
| Token de cor | `--bloco-estado` | `--blue-soft`, `--ch-aguardando` |
| Classe global | `.kebab-case` | `.table-wrap`, `.btn-primary` |

### Português no código

Identificadores e comentários em português **exceto** nomes herdados da
plataforma (`mount`, `props`, `emit`, `computed`, `ref`, `watch`). Isso vale para:

- Funções: `listarChamados`, `carregarExtras`, `alternarDetalhe`, `validarForca`
- Estados: `carregando`, `salvando`, `erroEnvio`, `filtros`, `respostas`
- Mensagens de interface: `'Não foi possível carregar os chamados.'`

---

## Onde mexer para cada tarefa

| Quero… | Arquivo principal | Também mexer em |
|---|---|---|
| Adicionar uma rota | `router/index.ts` | `AppSidebar.vue` (se for menu), `AppTopbar` (título vem do `meta`) |
| Adicionar uma coluna numa tabela | a `view` correspondente | — |
| Adicionar um card de KPI | a `view` | — |
| Criar uma chamada de API nova | `api/<recurso>.ts` | o tipo em `types/index.ts` |
| Mudar cor / raio / sombra | `styles/tokens.css` | — |
| Mudar um botão padrão | `styles/main.css` (`.btn*`) | — |
| Mudar o que cada perfil enxerga | a `view` (`v-if="ehGestor"`, `podeGerenciar`…) | `AppSidebar.vue`, `router/index.ts` |
| Adicionar um item de menu | `AppSidebar.vue` | `router/index.ts` (rota) |
| Mudar regras de sessão / refresh | `api/http.ts`, `stores/auth.ts` | — |
| Mudar como erros são exibidos | `stores/ui.ts`, `utils/apiError.ts` | ver [Tratamento de erros](./09-tratamento-de-erros.md) |
| Adicionar uma pergunta ao formulário público | `Configurações → Formulário de chamados` (sem código) | — |
| Mudar o intervalo de atualização de uma tela | a `view` (argumento de `useAutoRefresh`) | — |

---

## Detalhes que costumam surpreender

**`StubView.vue` está morto.** Nenhuma rota o referencia. Está no repositório
como modelo para módulos futuros: exibe `route.meta.modulo` e o texto padrão
sobre as fases de unificação.

**O CSS é 100% scoped por padrão.** Só `.card`, `.btn*`, `.field`, `.input`,
`.table*` e o reset vivem em `main.css`. Isso reduz acoplamento visual, mas
significa que uma classe nova usada em 5 telas precisa ser criada 5 vezes (ou
promovida a global de propósito).

**`.spin` é redeclarado em várias telas.** É uma animação de 3 linhas. Não é
drama, mas é duplicação que existe para evitar mais um arquivo global.

**`equipamentos-da-filial` devolve o parque inteiro e o filtro é local.**
Para perfil não-matriz, `useEquipamentos` baixa a lista completa uma vez, cacheia
e filtra/pagina no navegador. Para ADMIN, usa `/equipamentos-global`, que pagina
e agrega no servidor. É a diferença entre "requisição pesada única" e "requisições
pequenas sempre". Exceção: se o SCE estiver numa versão sem `stats.porModelo`, o
ADMIN deriva o drilldown do gráfico pela lista completa (compatibilidade).

**`api/usuarios.ts` tem comentário dizendo "somente ADMIN", mas GESTOR também
usa.** A rota aceita `['ADMIN', 'GESTOR']` e o próprio backend limita o Gestor à
sua filial e ao perfil Visualizador. O comentário do módulo está desatualizado —
confie na rota e no backend, não no comentário.

**Não existe `api/configuracoes.ts`.** As configurações são espalhadas por
`api/sce.ts` (catálogo, status, auditoria), `api/encaminhamentos.ts` (regras) e
`api/formulario.ts` (perguntas).

---

Ver também: [Arquitetura](./02-arquitetura.md) ·
[Estado, stores e composables](./07-estado-stores-composables.md) ·
[Componentes e design system](./08-componentes-e-design-system.md)
