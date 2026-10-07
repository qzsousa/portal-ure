# 14 — Fluxo de atendimento do chamado

Este documento acompanha **um chamado do início ao fim**, passando por quem age em
cada etapa e o que cada perfil vê na tela. É o mapa do processo: o capítulo
`13-avaliacao-de-atendimento.md` entra em detalhe só na nota final.

O fluxo é o mesmo para qualquer tipo de chamado (equipamento, rede, sistemas).
O que muda é o **técnico** que a regra de encaminhamento escolhe.

---

## O caminho, de uma vez

```
                    ┌──────────────────────────────────────────┐
                    │              solicitante                  │
                    │   (público: /chamado/novo — sem login)    │
                    └───────────────────┬──────────────────────┘
                                        │ POST /chamados
                                        ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │ ① ABERTO        novo ou reaberto. falta encaminhar               │
   │                regra de encaminhamento automático por categoria  │
   └──────────────────────────────┬──────────────────────────────────┘
                                  │ POST /chamados/:id/encaminhar
                                  ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │ ② ENCAMINHADO  já está com um técnico, aguardando o aceite dele  │
   │                🔔 técnico notificado no sino                     │
   └──────────────────────────────┬──────────────────────────────────┘
                                  │ POST /chamados/:id/aceitar
                                  ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │ ③ ANDAMENTO     o técnico assumiu e registra o serviço           │
   │                POST /:id/atividades — REPETÍVEL, com data/hora   │
   │                🔔 administradores notificados a cada registro    │
   └──────────────────────────────┬──────────────────────────────────┘
                                  │ POST /chamados/:id/concluir
                                  │ (exige descrever o que foi feito)
                                  ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │ ④ AGUARDANDO_CONFERENCIA                                          │
   │                serviço entregue, bola com a ESCOLA                │
   │                🔔 escola notificada (sino + e-mail)               │
   └──────────────────────────────┬──────────────────────────────────┘
                         POST /chamados/:id/conferir
                    ┌────────────┴────────────┐
            aprovado│                         │aprovado: false
                    ▼                         ▼
   ┌──────────────────────────┐   ┌──────────────────────────────────┐
   │ ⑤ RESOLVIDO              │   │  volta para ① ABERTO             │
   │    🔔 técnico notificado │   │    reaberturas + 1                │
   │    📝 escola avalia (1x) │   │    🔔 ADMIN + TÉCNICO notificados │
   └──────────────────────────┘   └──────────────────────────────────┘
```

`COMUNICADO` é uma **via paralela** que já existia e continua valendo: a matriz
muda o status para `COMUNICADO` fazendo uma pergunta à escola, e a resposta da
escola devolve o chamado para `ANDAMENTO`. Não faz parte do caminho principal,
mas usa o mesmo painel.

---

## Quem age em cada etapa

| # | Etapa | Quem age | Quem é avisado (sino) | E-mail |
|---|---|---|---|---|
| ① | Aberto | qualquer pessoa, sem login | administradores | schools + solicitante |
| ② | Encaminhado | regra automática, ou a matriz | técnico responsável | — |
| ③ | Aceite | técnico responsável (ou ADMIN) | administradores | — |
| ④ | Registro | técnico responsável (ou ADMIN) | administradores | — |
| ⑤ | Conclusão | técnico responsável (ou ADMIN) | escola | escola + solicitante |
| ⑥ | Conferência | GESTOR/VISUALIZADOR da unidade | técnico responsável | escola + solicitante |
| ⑦ | Contestação | GESTOR/VISUALIZADOR da unidade | **admin + técnico** | escola + solicitante |

> A distinção entre **responsável** e **quem atende a unidade** importa:
> qualquer técnico da escola vê o chamado, mas só quem ficou como `responsavel`
> pode aceitar, registrar e concluir. Aceitar o serviço de alguém é assumir a
> responsabilidade por ele.

---

## As cinco telas do caminho

### 1. Abertura — sem login, página pública

O solicitante não precisa de conta. Preenche um assistente por categoria; as
perguntas são configuráveis pela matriz em *Configurações → Formulário*, e cada
opção pode disparar um alerta (inclusive mandando para a categoria certa).

![Abertura de chamado](screenshots/38-fluxo-01-abrir-chamado.png)

Ao escolher **Equipamento**, aparecem as perguntas dinâmicas. A opção escolhida
pode mostrar um aviso — aqui, "Roteador / Switch" sugere a categoria Rede:

![Perguntas dinâmicas de equipamento](screenshots/40-fluxo-03-abrir-chamado-perguntas.png)

A última etapa pede identificação e devolve o **protocolo** (`CH-AAAAMMDD-NNNN`).
Esse número é a credencial de acompanhamento, junto com o e-mail informado.

O que o backend faz ao criar:

1. Gera o protocolo (sequencial por dia, com retry em caso de colisão).
2. Grava `historico = "Chamado criado em <data/hora>"`.
3. Aplica a **regra de encaminhamento** da categoria: se houver técnico da
   unidade ativo, grava `responsavel` + `responsavelId` e **muda o status para
   `ENCAMINHADO`**.
4. Notifica os administradores no sino e manda e-mail de confirmação.

Se não houver técnico cadastrado para a unidade, nada quebra: o chamado segue
`ABERTO`, sem responsável, e a matriz o encaminha à mão.

---

### 2. A fila do técnico — `ENCAMINHADO`

O técnico abre o chamado e vê o botão **Aceitar chamado**. O caminho de aceite
é o único que libera os próximos passos.

![Chamado encaminhado aguardando aceite](screenshots/52-fluxo-15-detalhe-encaminhado-aceitar.png)

Repare nos três cartões de marco no rodapé do modal: *Aceito*, *Concluído pelo
técnico* e *Conferido pela escola* — todos vazios. Eles vão se preenchendo
conforme o chamado avança, e é a resposta direta para as perguntas que sempre
aparecem ("aceito quando?", "quem confirmou que terminou?").

---

### 3. O serviço — `ANDAMENTO`

Aqui é onde mora a maior parte do trabalho. O técnico registra **cada etapa do
serviço**, quantas vezes precisar. Cada envio vira uma linha com a data e a hora
do servidor.

![Chamado em atendimento com registros](screenshots/53-fluxo-16-detalhe-andamento.png)

A trilha no topo da caixa *Atendimento* mostra onde o chamado está:

```
✓ Aceito  →  ▌Registro▐  →  Concluído  →  Conferência
  (verde)     (azul)       (cinza)        (cinza)
```

Passo cumprido fica **verde**; o passo da vez fica **azul** e tem o botão em
destaque embaixo.

Os anexos destes registros **não expiram** — ao contrário dos anexos da conversa
(7 dias). Eles são a prova do serviço: a escola precisa conseguir conferir meses
depois.

O formulário de registro, aberto:

![Registrando o que foi feito](screenshots/54-fluxo-17-detalhe-registro-aberto.png)

E a conclusão, que exige o mesmo texto (é o que a escola vai ler):

![Concluindo o atendimento](screenshots/55-fluxo-18-detalhe-conclusao.png)

---

### 4. A conferência da escola — `AGUARDANDO_CONFERENCIA`

Esta é a etapa que **não existia** antes do fluxo novo. O técnico não encerra o
chamado: ele entrega o serviço, e quem confirma é a unidade que abriu.

![Conferência do atendimento pela escola](screenshots/56-fluxo-19-detalhe-conferencia-escola.png)

A escola tem dois botões, e a escolha é irreversível no caminho feliz:

| Botão | Efeito |
|---|---|
| **Ficou tudo certo** | → `RESOLVIDO`, grava quem e quando conferiu, avisa o técnico |
| **Ficou faltando** | → volta para `ABERTO`, conta 1 reabertura, avisa admin + técnico |

A contestação exige o texto do que faltou (é ele que orienta o retrabalho); a
foto é opcional:

![Contestação reabrindo o chamado](screenshots/57-fluxo-20-detalhe-contestacao.png)

---

### 5. Conclusão e reabertura

Depois de aprovada, o chamado fica `RESOLVIDO` com a linha de aprovação na
timeline e o cartão "Conferido pela escola" preenchido:

![Chamado concluído e conferido](screenshots/58-fluxo-21-detalhe-resolvido.png)

Quando a escola contesta, o chamado volta para `ABERTO` **preservando tudo**: o
registro da tentativa anterior continua na timeline, marcado como "reaberto Nx",
e o técnico precisa **aceitar de novo** para registrar e concluir outra vez.

![Chamado reaberto após contestação](screenshots/59-fluxo-22-detalhe-reaberto.png)

O administrador e o técnico responsável recebem o aviso no sino:

![Notificação de reabertura](screenshots/60-fluxo-23-sino-notificacao-reabertura.png)

---

## Acompanhamento pelo solicitante

Quem abriu o chamado acompanha tudo pela tela pública de consulta, com
**protocolo + e-mail** (o protocolo sozinho é sequencial e adivinhável).

![Consulta de protocolo com registros de atendimento](screenshots/42-fluxo-05-consulta-protocolo.png)

O bloco **Atendimento** mostra os mesmos registros datados que a matriz vê, com
os anexos. É o que responde "já vieram? o que trocaram?" sem precisar ligar na
escola.

Depois de reaberto, o solicitante vê a contestação na mesma tela:

![Consulta de protocolo de chamado reaberto](screenshots/43-fluxo-06-consulta-protocolo-reaberto.png)

---

## As visões por perfil

O mesmo chamado aparece diferente conforme quem abre.

### Painel público (sem login)

Visão agregada de toda a URE. Serve para transparência e é o único lugar que
mostra os **6 status** lado a lado:

![Painel geral de chamados](screenshots/44-fluxo-07-painel-publico-matriz.png)

O painel do dirigente é a versão com nota média de atendimento e ranking de
unidades:

![Painel do dirigente](screenshots/45-fluxo-08-painel-dirigente.png)

### Escola (GESTOR / VISUALIZADOR)

O painel da escola é o do próprio equipamento e dos próprios chamados — sem
número da URE, sem outros técnicos:

![Painel da escola](screenshots/47-fluxo-10-painel-escola.png)

Na listagem, a escola vê **só os chamados da sua unidade**:

![Chamados da escola](screenshots/48-fluxo-11-chamados-escola.png)

### Matriz (ADMIN / TÉCNICO)

O painel da matriz tem o inventário de toda a rede e as notas de atendimento:

![Painel da matriz](screenshots/49-fluxo-12-painel-matriz.png)

A listagem tem todos os chamados da URE, com checkbox para ação em lote. Os chips
no topo são as **etapas do fluxo**, na ordem em que o chamado passa por elas:

![Chamados da matriz](screenshots/50-fluxo-13-chamados-matriz.png)

Filtro por uma etapa específica — a fila que mais some no dia a dia é a de
conferência, porque ninguém está "trabalhando" nela:

![Filtro por aguardando conferência](screenshots/51-fluxo-14-chamados-filtro-conferencia.png)

---

## As perguntas de cada papel

### Técnico

1. **Chegou chamado novo?** — sino, e o filtro "Encaminhados" na listagem.
2. **Posso aceitar?** — sim, se o status for `ABERTO`/`ENCAMINHADO` e eu sou o
   responsável. Se sou colega de plantão, o botão não aparece (e o backend
   recusa com 403).
3. **Já registrei tudo?** — o "Registro" da trilha fica azul até haver um registro
   de atendimento.
4. **Terminei?** — "Concluir atendimento". O status vai para
   `AGUARDANDO_CONFERENCIA` e a escola recebe o aviso.

### Escola

1. **O que a equipe fez?** — a linha do tempo *Atendimento*, com foto.
2. **Está tudo certo?** — "Ficou tudo certo" encerra; "Ficou faltando" reabre.
   Antes de escrever o que faltou, vale olhar a foto do técnico.
3. **Está resolvido?** — depois de `RESOLVIDO` **e conferido**, aparece o
   formulário de avaliação (1 a 5 estrelas).

### Administrador

1. **Onde está travado?** — os 6 KPIs, com *Aguardando conferência* separado.
2. **A escola reclamou?** — sino, filtro "Abertos" (reabertos voltam para lá) e a
   etiqueta "reaberto Nx" no modal.
3. **A regra de encaminhamento está certa?** — *Configurações → Encaminhamento*,
   por categoria.

---

## Regras que o backend impõe

O que a tela esconde é o que o servidor recusa. Estas são as travas que existem
no `chamados.ts`:

| Regra | Resposta quando violada |
|---|---|
| Só o responsável aceita | `403` "Só quem é o responsável pelo chamado pode aceitá-lo" |
| Não registrar sem aceite no ciclo atual | `409` "Aceite o chamado antes de registrar" |
| Concluir exige descrever | `400` "Registre o que foi feito..." |
| Escola não altera status direto | `403` — encerrar é pela conferência |
| Conferir só em `AGUARDANDO_CONFERENCIA` | `409` "Só é possível conferir chamado que o técnico concluiu" |
| Contestação exige texto | `400` "Registre o que ficou faltando" |
| Escola de outra unidade | `403` "Sem acesso a este chamado" |
| Reencaminhar em atendimento não volta o status | o técnico pode estar no meio do serviço |

O ponto que mais mudou: **a escola não encerra mais chamado por conta própria.**
Antes, `PATCH /chamados/:id/status` permitia que qualquer GESTOR colocasse
`RESOLVIDO` em qualquer chamado — inclusive num em que o técnico nunca tinha
ido. Não havia conferência nenhuma nesse caminho.

---

## Onde cada coisa vive

| Conceito | Onde |
|---|---|
| Enum dos 6 status | `shared/types/api.ts` → `StatusChamadoSchema` |
| Texto de cada status | `shared/types/api.ts` → `ROTULO_STATUS_CHAMADO` (fonte única; o frontend espelha) |
| Rotas do fluxo | `backend/src/routes/chamados.ts` |
| Validação de cada passo | `shared/types/api.ts` → `RegistrarAtividadeSchema`, `ConcluirChamadoSchema`, `ConferirChamadoSchema` |
| Tabela dos registros | `ChamadoAtividade` + `ChamadoAtividadeAnexo` |
| Marcos de horário | `Chamado.aceitoEm/Por`, `concluidoEm`, `conferidoEm/Por` |
| Contador de reabertura | `Chamado.reaberturas` |
| Notificações | `backend/src/services/notificacoes.ts` |
| Trilha na tela | `src/views/ChamadosView.vue` |
| Rótulos e tipos do frontend | `src/api/chamados.ts`, `src/types/index.ts` |

> `Chamado.historico` continua sendo **texto** e serve como rastro legível. A
> linha do tempo que importa para o atendimento vem de `atividades`, porque ali
> o horário é o do servidor e não um número extraído por regex de uma frase.

---

## Cobertura de teste

`backend/src/routes/chamados.fluxo.test.ts` — 22 casos sobre o que travamos
acima: aceite indevido, registro antes do aceite, conclusão sem texto,
contestação sem texto, conferência em chamado não concluído, técnico tentando
fazer a conferência, e o destino de cada notificação.

```bash
cd chamados/backend && npx vitest run src/routes/chamados.fluxo.test.ts
```

---

## Sobre estas imagens

As capturas foram feitas contra o **frontend real** rodando com um mock do
backend (sem banco), percorrendo o app de verdade — inclusive clicando nos
botões do fluxo. Os dados são fictícios, mas as telas, os estados e as
mensagens são os do código de produção.

Detalhe que só aparece quem tenta: a CSP do `index.html` fixa as portas de
`connect-src` em `localhost:10000` e `localhost:3000`. Qualquer backend de
desenvolvimento em outra porta é bloqueado **em silêncio** — a tela mostra
"Não foi possível carregar" e o navegador cancela a requisição antes dela sair.
Vale saber disso antes de procurar bug em outro lugar.
