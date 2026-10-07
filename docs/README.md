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
| **Entender a avaliação de atendimento** (do fechamento à nota) | **[13 · Avaliação de atendimento](./13-avaliacao-de-atendimento.md)** |
| **Entender o aceite e a conclusão pelo técnico** (carimbos de horário) | **[14 · Aceite e conclusão pelo técnico](./14-aceite-e-conclusao-pelo-tecnico.md)** |
| **Ver o fluxo do chamado inteiro** (da abertura até a conferência da escola) | **[14 · Fluxo de atendimento do chamado](./14-fluxo-atendimento-chamado.md)** |

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
| 30 | Consulta — bloco de avaliação depois do chamado resolvido | [`30-avaliacao-formulario.png`](./screenshots/30-avaliacao-formulario.png) |
| 31 | Consulta — agradecimento depois de enviar a avaliação | [`31-avaliacao-enviada.png`](./screenshots/31-avaliacao-enviada.png) |
| 32 | Elogios e avaliações — tabela de avaliações com comentário (matriz) | [`32-feedback-avaliacoes.png`](./screenshots/32-feedback-avaliacoes.png) |
| 33 | Painel de chamados — avaliação no detalhe (perfil Gestor) | [`33-avaliacao-painel.png`](./screenshots/33-avaliacao-painel.png) |
| 34 | Painel de chamados — agradecimento depois de avaliar | [`34-avaliacao-painel-enviada.png`](./screenshots/34-avaliacao-painel-enviada.png) |

### Escola MÃE × escola FILHA no parque de equipamentos

| # | Tela | Arquivo |
|---|---|---|
| 35 | Equipamentos — **escola FILHA**: banner de compartilhamento, sem "Adicionar equipamento" e sem Editar/Remover | [`35-equipamentos-escola-filha-somente-leitura.png`](./screenshots/35-equipamentos-escola-filha-somente-leitura.png) |
| 36 | Equipamentos — **escola MÃE** do mesmo grupo: sem banner, com "Adicionar equipamento" e Editar/Remover | [`36-equipamentos-escola-mae-com-edicao.png`](./screenshots/36-equipamentos-escola-mae-com-edicao.png) |
| 37 | Login usado no teste dos perfis MÃE/FILHA | [`37-login-teste.png`](./screenshots/37-login-teste.png) |

### Aceite e conclusão pelo técnico

| # | Tela | Arquivo |
|---|---|---|
| 38 | Chamados — botão **Aceitar** na linha do chamado encaminhado | [`38-chamados-aceitar-lista.png`](./screenshots/38-chamados-aceitar-lista.png) |
| 39 | Detalhe — botão grande **Aceitar chamado** no topo do modal | [`39-chamado-aceitar-modal.png`](./screenshots/39-chamado-aceitar-modal.png) |
| 40 | Detalhe — após o aceite: horário assumido + botão **Concluir chamado** | [`40-chamado-concluir-modal.png`](./screenshots/40-chamado-concluir-modal.png) |
| 41 | Detalhe concluído — carimbos **Aceito em** / **Concluído em** e linha do tempo | [`41-chamado-carimbos.png`](./screenshots/41-chamado-carimbos.png) |

### Usuários geridos pelo Gestor

| # | Tela | Arquivo |
|---|---|---|
| 42 | Usuários — **perfil Gestor**: só a própria unidade e o aviso de cota ("1 de 2") | [`42-usuarios-gestor-unidade.png`](./screenshots/42-usuarios-gestor-unidade.png) |
| 43 | Modal *Novo usuário* como Gestor — **Perfil** e **Unidade** travados | [`43-usuarios-gestor-modal-perfil-travado.png`](./screenshots/43-usuarios-gestor-modal-perfil-travado.png) |
| 44 | Usuários — **cota esgotada**: aviso vermelho e botão *Novo usuário* travado | [`44-usuarios-gestor-limite-atingido.png`](./screenshots/44-usuarios-gestor-limite-atingido.png) |

> **Sobre os prints 42 a 44.** Capturados com o portal local e o usuário de
> teste **`teste.mae@local.com`** (perfil **GESTOR**, unidade
> `E.E. CESAR DONATO CALABREZ`). São dados reais — a outra linha da tabela é o
> técnico da mesma escola, `teste.tecnico@local.com`.
>
> O print 44 exigia a unidade com a cota cheia. O usuário
> `teste.cota.gestor@local.com` foi **criado pela própria tela** para chegar
> lá (2 de 2), fotografado e **desativado em seguida** — que é o que a tela
> avisa fazer. Ele continua no banco como `INATIVO`, sem efeito em nada.
>
> Também foi conferido, chamando a API direto com o token do Gestor, que
> `POST /usuarios` com a unidade cheia responde **400** *"Limite de 2 usuários
> por unidade atingido"* e que `GET /usuarios?filial=<outra escola>` continua
> devolvendo **só** a própria unidade.

> **Sobre os prints 38 a 41.** Capturados com o usuário de teste
> `teste.tecnico@local.com` (perfil TÉCNICO) e chamados sintéticos `CH-TESTE-*`
> encaminhados para ele — ver [Aceite e conclusão pelo técnico](./14-aceite-e-conclusao-pelo-tecnico.md).

> **Sobre os prints 35 e 36.** Capturados com o portal local e **dois usuários
> de teste do mesmo grupo de escolas irmãs** (`E.E. CESAR DONATO CALABREZ /
> LEILA DINIZ`), ambos com perfil Gestor: um cadastrado na **MÃE** e outro na
> **FILHA**. Os 365 equipamentos são reais e são o mesmo conjunto nas duas
> telas — o que muda é apenas o que cada perfil pode fazer com eles.
>
> - A **FILHA** é somente leitura: o aviso azul informa com quem o parque é
>   compartilhado, o botão "Adicionar equipamento" não existe e o menu da
>   linha traz apenas "Ver detalhes e histórico".
> - A **MÃE** administra o painel: os mesmos equipamentos, com "Adicionar
>   equipamento", "Editar" e "Remover".
>
> A regra é aplicada em duas camadas — o portal esconde os botões e o SCE recusa
> a escrita na API — descrita em
> [Autenticação e permissões](./04-autenticacao-e-permissoes.md).
>
> Ressalva: por serem telas de página inteira, os prints mostram a coluna
> **Ações fechada**. A diferença entre os itens do menu (só "Ver detalhes" na
> FILHA; "Editar" e "Remover" na MÃE) foi conferida no DOM, mas não aparece
> nas imagens.

> **Sobre os prints.** Todos foram capturados do portal rodando localmente
> (`localhost:5173`) contra o banco de desenvolvimento, com um usuário
> **Administrador** — exceto os 35 a 37 e os 42 a 44, capturados com usuários de
> teste de perfil **Gestor** (cada bloco de prints traz o seu próprio recado).
> Três ressalvas:
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
> - **30 a 34 — Avaliação:** capturados com uma **API de mentira** servindo um
>   chamado `RESOLVIDO` e cinco avaliações montadas para a demonstração.
>   Unidade, solicitante, técnico, conversa e notas são **fictícios**, e
>   **nada foi gravado em nenhum banco** — o banco de produção tem 0 avaliações
>   até o momento. Ver
>   [Avaliação de atendimento](./13-avaliacao-de-atendimento.md).
>
> Todos os prints de avaliação são de **página inteira** (não da dobra da
> janela), para nenhum bloco ficar cortado pela altura da tela.
>
> Os prints 01–06 e 07 usam o chamado **`CH-20260929-0006`**, criado durante a
> captura para demonstrar o fluxo completo de ponta a ponta.

### Fluxo de atendimento do chamado (63 a 87)

O caminho completo de um chamado, do formulário público até a conferência da
escola. Ver **[14 — Fluxo de atendimento do chamado](./14-fluxo-atendimento-chamado.md)**.

| # | Tela | Arquivo |
|---|---|---|
| 38 | Abertura de chamado — escolha de categoria | [`63-fluxo-01-abrir-chamado.png`](./screenshots/63-fluxo-01-abrir-chamado.png) |
| 39 | Abertura — categoria *Equipamento* escolhida | [`64-fluxo-02-abrir-chamado-equipamento.png`](./screenshots/64-fluxo-02-abrir-chamado-equipamento.png) |
| 40 | Abertura — perguntas dinâmicas com alerta e cascata de equipamento | [`65-fluxo-03-abrir-chamado-perguntas.png`](./screenshots/65-fluxo-03-abrir-chamado-perguntas.png) |
| 41 | Abertura — etapa de identificação | [`66-fluxo-04-abrir-chamado-identificacao.png`](./screenshots/66-fluxo-04-abrir-chamado-identificacao.png) |
| 42 | Consulta por protocolo — registros de atendimento visíveis ao solicitante | [`67-fluxo-05-consulta-protocolo.png`](./screenshots/67-fluxo-05-consulta-protocolo.png) |
| 43 | Consulta — chamado reaberto, com a contestação da escola | [`68-fluxo-06-consulta-protocolo-reaberto.png`](./screenshots/68-fluxo-06-consulta-protocolo-reaberto.png) |
| 44 | Painel geral público — os 6 status do fluxo | [`69-fluxo-07-painel-publico-matriz.png`](./screenshots/69-fluxo-07-painel-publico-matriz.png) |
| 45 | Painel do dirigente — nota média e ranking de unidades | [`70-fluxo-08-painel-dirigente.png`](./screenshots/70-fluxo-08-painel-dirigente.png) |
| 46 | Login | [`71-fluxo-09-login.png`](./screenshots/71-fluxo-09-login.png) |
| 47 | Painel da escola (GESTOR) | [`72-fluxo-10-painel-escola.png`](./screenshots/72-fluxo-10-painel-escola.png) |
| 48 | Chamados da escola — só a unidade dela | [`73-fluxo-11-chamados-escola.png`](./screenshots/73-fluxo-11-chamados-escola.png) |
| 49 | Painel da matriz (ADMIN) | [`74-fluxo-12-painel-matriz.png`](./screenshots/74-fluxo-12-painel-matriz.png) |
| 50 | Chamados da matriz — os chips são as etapas do fluxo | [`75-fluxo-13-chamados-matriz.png`](./screenshots/75-fluxo-13-chamados-matriz.png) |
| 51 | Filtro por *Aguardando conferência* | [`76-fluxo-14-chamados-filtro-conferencia.png`](./screenshots/76-fluxo-14-chamados-filtro-conferencia.png) |
| 52 | Detalhe ENCAMINHADO — botão **Aceitar chamado** | [`77-fluxo-15-detalhe-encaminhado-aceitar.png`](./screenshots/77-fluxo-15-detalhe-encaminhado-aceitar.png) |
| 53 | Detalhe ANDAMENTO — registros datados, marcos e trilha de passos | [`78-fluxo-16-detalhe-andamento.png`](./screenshots/78-fluxo-16-detalhe-andamento.png) |
| 54 | Registro do que foi feito (repetível, com foto) | [`79-fluxo-17-detalhe-registro-aberto.png`](./screenshots/79-fluxo-17-detalhe-registro-aberto.png) |
| 55 | Conclusão do atendimento — exige descrever | [`80-fluxo-18-detalhe-conclusao.png`](./screenshots/80-fluxo-18-detalhe-conclusao.png) |
| 56 | AGUARDANDO_CONFERÊNCIA visto pela escola | [`81-fluxo-19-detalhe-conferencia-escola.png`](./screenshots/81-fluxo-19-detalhe-conferencia-escola.png) |
| 57 | Contestação — texto obrigatório, foto opcional | [`82-fluxo-20-detalhe-contestacao.png`](./screenshots/82-fluxo-20-detalhe-contestacao.png) |
| 58 | RESOLVIDO com a conferência da escola registrada | [`83-fluxo-21-detalhe-resolvido.png`](./screenshots/83-fluxo-21-detalhe-resolvido.png) |
| 59 | Chamado reaberto — registro anterior preservado, etiqueta "reaberto 1x" | [`84-fluxo-22-detalhe-reaberto.png`](./screenshots/84-fluxo-22-detalhe-reaberto.png) |
| 60 | Sino com o aviso de reabertura para admin e técnico | [`85-fluxo-23-sino-notificacao-reabertura.png`](./screenshots/85-fluxo-23-sino-notificacao-reabertura.png) |
| 61 | COMUNICADO — pergunta da matriz para a escola | [`86-fluxo-24-detalhe-comunicado.png`](./screenshots/86-fluxo-24-detalhe-comunicado.png) |
| 62 | Avaliação — só aparece depois que a escola conferiu | [`87-fluxo-25-avaliacao-painel.png`](./screenshots/87-fluxo-25-avaliacao-painel.png) |

> **Sobre os prints 63 a 87.** Capturados do frontend real rodando
> (`localhost:5173`) contra um **mock do backend**, sem banco de dados — o portal
> foi percorrido de verdade, clicando nos botões do fluxo (aceitar, registrar,
> concluir, conferir, contestar). As telas, os estados, as mensagens de erro e as
> regras de visibilidade são os do código de produção; **os dados são fictícios**
> e nada foi gravado em nenhum banco.
>
> Ressalva de ambiente: a CSP do `index.html` fixa `connect-src` em
> `localhost:10000` e `localhost:3000`, então o mock teve de rodar nessas
> portas. Um backend de desenvolvimento em outra porta é bloqueado em silêncio.


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
