# Documentação do Portal URE Leste 3

Documentação técnica completa do **Portal URE Leste 3** — o portal unificado da
Unidade Regional de Ensino Leste 3 (SETEC / Governo do Estado de São Paulo) que
reúne **chamados de suporte técnico** e **inventário de equipamentos** em uma
única interface.

> Este repositório (`portal/`) contém o **frontend**. O sistema completo é formado
> por três aplicações que conversam entre si — veja [Arquitetura](./02-arquitetura.md).

---

## Por onde começar

| Se você quer… | Leia |
|---|---|
| Entender o que o sistema faz e quem usa | [01 · Visão geral](./01-visao-geral.md) |
| Entender como as 3 aplicações se conectam (SSO) | [02 · Arquitetura](./02-arquitetura.md) |
| Saber o que está em cada pasta | [03 · Estrutura do projeto](./03-estrutura-do-projeto.md) |
| Saber quem enxerga o quê (ADMIN/TÉCNICO/GESTOR/VISUALIZADOR) | [04 · Autenticação e permissões](./04-autenticacao-e-permissoes.md) |
| Saber o que existe em cada tela e rota | [05 · Rotas e telas](./05-rotas-e-telas.md) |
| Descobrir qual endpoint o sistema consome | [06 · Backends e endpoints](./06-backends-e-endpoints.md) |
| Entender stores, composables e utilitários | [07 · Estado, stores e composables](./07-estado-stores-composables.md) |
| Reaproveitar botões, tabelas e cores | [08 · Componentes e design system](./08-componentes-e-design-system.md) |
| **Saber o que fazer quando algo dá errado** | **[09 · Tratamento de erros](./09-tratamento-de-erros.md)** ⭐ |
| Rodar, compilar e publicar | [10 · Build, deploy e ambientes](./10-build-deploy-ambientes.md) |
| Fazer uma manutenção comum | [11 · Manutenção e checklists](./11-manutencao-e-checklists.md) |
| Decifrar siglas e nomes próprios | [12 · Glossário](./12-glossario.md) |

---

## Mapas de telas (prints reais)

Todas as imagens estão em [`./screenshots/`](./screenshots/) e foram capturadas do
sistema rodando com dados reais.

### Portal público (sem login)

| # | Tela | Arquivo |
|---|---|---|
| 01 | Abertura de chamado — escolha de categoria | [`01-chamado-novo-home.png`](./screenshots/01-chamado-novo-home.png) |
| 02 | Abertura de chamado — perguntas da categoria *Equipamento* | [`02-chamado-novo-perguntas.png`](./screenshots/02-chamado-novo-perguntas.png) |
| 03 | Abertura de chamado — pergunta condicional aparecendo | [`03-chamado-novo-pergunta-condicional.png`](./screenshots/03-chamado-novo-pergunta-condicional.png) |
| 04 | Abertura de chamado — categoria *Rede* com pergunta condicional | [`04-chamado-novo-rede-condicional.png`](./screenshots/04-chamado-novo-rede-condicional.png) |
| 05 | Abertura de chamado — identificação e envio | [`05-chamado-novo-identificacao.png`](./screenshots/05-chamado-novo-identificacao.png) |
| 06 | Abertura de chamado — protocolo gerado | [`06-chamado-novo-sucesso.png`](./screenshots/06-chamado-novo-sucesso.png) |
| 07 | Consulta por protocolo + e-mail | [`07-consulta-protocolo.png`](./screenshots/07-consulta-protocolo.png) |
| 08 | Consulta — par protocolo/e-mail não confere (HTTP 404) | [`08-consulta-erro-404.png`](./screenshots/08-consulta-erro-404.png) |
| 09 | Elogios e sugestões | [`09-elogios-sugestoes.png`](./screenshots/09-elogios-sugestoes.png) |
| 10 | Painel geral de chamados (transparência) | [`10-painel-geral-publico.png`](./screenshots/10-painel-geral-publico.png) |
| 11 | Painel do dirigente | [`11-painel-dirigente.png`](./screenshots/11-painel-dirigente.png) |
| 12 | Login — credenciais inválidas | [`12-login-erro-credenciais.png`](./screenshots/12-login-erro-credenciais.png) |

### Área autenticada

| # | Tela | Arquivo |
|---|---|---|
| 13 | Login | [`13-login.png`](./screenshots/13-login.png) |
| 14 | Painel — perfil matriz (ADMIN/TÉCNICO) | [`14-painel-matriz.png`](./screenshots/14-painel-matriz.png) |
| 15 | Painel — perfil escola (com simulação ativa) | [`15-painel-escola.png`](./screenshots/15-painel-escola.png) |
| 16 | Chamados — lista, KPIs, filtros e barra de lote | [`16-chamados.png`](./screenshots/16-chamados.png) |
| 17 | Chamados — detalhe com histórico e ações da matriz | [`17-chamado-detalhe.png`](./screenshots/17-chamado-detalhe.png) |
| 18 | Equipamentos — gráfico com drilldown e tabela | [`18-equipamentos.png`](./screenshots/18-equipamentos.png) |
| 19 | Manutenção | [`19-manutencao.png`](./screenshots/19-manutencao.png) |
| 20 | Unidades escolares (matriz) | [`20-unidades.png`](./screenshots/20-unidades.png) |
| 21 | Tutoriais | [`21-tutoriais.png`](./screenshots/21-tutoriais.png) |
| 22 | Relatórios | [`22-relatorios.png`](./screenshots/22-relatorios.png) |
| 23 | Usuários | [`23-usuarios.png`](./screenshots/23-usuarios.png) |
| 24 | Configurações — Logs do sistema | [`24-config-logs.png`](./screenshots/24-config-logs.png) |
| 25 | Configurações — Integrações (os 3 testes OK) | [`25-config-integracoes.png`](./screenshots/25-config-integracoes.png) |
| 26 | Configurações — Testes de acesso | [`26-config-acesso.png`](./screenshots/26-config-acesso.png) |
| 27 | Configurações — Formulário de chamados (com condicionais visíveis) | [`27-config-formulario.png`](./screenshots/27-config-formulario.png) |
| 28 | Elogios e avaliações (ADMIN) | [`28-feedback.png`](./screenshots/28-feedback.png) |
| 29 | Configurações — Encaminhamento automático | [`29-config-encaminhamento.png`](./screenshots/29-config-encaminhamento.png) |

> **Sobre os prints.** Todos foram capturados do portal rodando localmente
> (`localhost:5173`) contra o banco de desenvolvimento, com um usuário
> **Administrador**. Duas ressalvas:
>
> - **24 — Logs do sistema:** as três entradas de "Erros dos backends" são
>   **exemplo**, inseridas manualmente para ilustrar o agrupamento (`×3`), o
>   status "sem resposta" e o badge de contagem na aba. Foram removidas em
>   seguida. Os demais números (5.224 equipamentos, 363 chamados) são reais.
> - **15 — Painel escola:** capturado com a **simulação de perfil** ativa
>   (banner amarelo no topo), que só existe em desenvolvimento. Repare que o
>   menu perde *Unidades Escolares*, *Usuários* e *Configurações*, mas os
>   filtros e a tabela completa de equipamentos continuam — é o comportamento do
>   VISUALIZADOR descrito em
>   [Autenticação e permissões](./04-autenticacao-e-permissoes.md).
>
> Os prints 01–06 e 07 usam o chamado **`CH-20260929-0006`**, criado durante a
> captura para demonstrar o fluxo completo de ponta a ponta.

---

## Resumo em 30 segundos

- **Frontend:** Vue 3 + TypeScript + Vite + Pinia + Vue Router + Chart.js + axios.
- **Dois backends:**
  - **Chamados** (porta `10000`) — é quem emite o **JWT** e cuida de identidade,
    usuários, chamados, escolas, notificações, tutoriais, formulário de abertura,
    encaminhamento e avaliações.
  - **SCE** (porta `3000`) — inventário de equipamentos, manutenção, empréstimos,
    catálogo e auditoria. **Aceita o mesmo JWT** do backend de chamados por SSO.
- **Identidade:** um único login. O `accessToken` fica **só em memória** e o
  `refreshToken` viaja num cookie `httpOnly` — nada de credencial fica legível
  por script da página. O mesmo token é aceito pelos dois backends.
- **Papéis:** `ADMIN`, `TECNICO`, `GESTOR`, `VISUALIZADOR` — mais o papel de
  unidade `MAE`/`FILHA` (escolas que dividem o mesmo prédio).
- **Público:** qualquer pessoa da rede pode abrir chamado, consultar por
  protocolo + e-mail, elogiar, sugerir, ver o painel geral e acessar tutoriais
  por link compartilhável — **sem login**.

---

## Convenções

- **Código e comentários** — português, com termos de domínio preservados
  (`chamado`, `equipamento`, `filial`, `técnico`).
- **Mensagens de interface** — todas em português do Brasil, com tom direto
  ("Confira…", "Não foi possível…", "Tente novamente").
- **Data e hora** — exibida em `America/Sao_Paulo`, formato `dd/mm/aaaa hh:mm`.
- **Protocolo de chamado** — `CH-AAAAMMDD-NNNN`, sequencial por dia.
