# 11 · Manutenção e checklists

Procedimentos prontos para as tarefas que mais aparecem. Cada um lista **onde
mexer**, **o que conferir** e **como reverter**.

---

## Adicionar uma pergunta ao formulário público

Não precisa de código — é configuração.

1. **Configurações → Formulário de chamados** (só ADMIN)
2. Escolha a categoria, clique para expandir
3. **Nova pergunta**
4. Preencha:
   - **Rótulo** — é o que o usuário lê
   - **Texto de ajuda** (opcional) — dica abaixo do rótulo
   - **Tipo de resposta** — *Opções (escolha única)*, *Texto* ou *Texto longo*
   - **Resposta obrigatória** — ligue se for critical
   - **Ordem de exibição** — números distintos (ver armadilha abaixo)
5. Se for do tipo **Opções**, cadastre os rótulos no editor de opções

### ⚠️ Armadilha: ordem repetida

Duas perguntas com o **mesmo `ordem`** não trocam de lugar quando você usa as
setas ↑ ↓ — a troca não produz efeito. Defina ordens distintas.

### ⚠️ Armadilha: renomear uma opção que outra pergunta depende

A condição de exibição casa pelo **texto exato do rótulo**. Se você renomear
*"Queda de Wi-Fi em salas"* para *"Queda de Wi-Fi em salas e laboratórios"*, a
pergunta que dependia do texto antigo **some silenciosamente**.

**Antes de renomear uma opção:** abra as perguntas da categoria e procure
alguém com o badge *Condicional* que aponte para ela.

---

## Fazer uma pergunta aparecer só sob uma condição

1. Em **Nova/Editar pergunta**, no bloco **Exibição**, escolha **Exibir quando…**
2. Selecione a pergunta de origem (só perguntas de **Opções** da **mesma
   categoria** aparecem na lista)
3. Selecione a opção que libera a exibição
4. Salve

A dependência é **exata**: se a pessoa escolher "Outro (descrever)", a pergunta
dependente **não** aparece (o valor interno do "Outro" é um sentinela, não um
rótulo da lista).

---

## Fazer uma opção avisar / bloquear / exigir anexo

No editor de opções, clique no botão de **alerta** da opção:

| Campo | Efeito |
|---|---|
| **Texto** | Mensagem exibida abaixo da pergunta |
| **Tipo** | *Informação* (azul) ou *Aviso* (laranja) |
| **Botão de ação** | Rótulo + URL, abre em nova aba |
| **Encerra o atendimento** | ⚠️ **Bloqueia o avanço** do formulário. Só use para redirecionar a pessoa (ex.: "este problema é do condomínio") |
| **Exige anexo** | Torna o anexo obrigatório na etapa final |

> **Cuidado com "Encerra".** A pessoa fica presa na tela e precisa clicar em
> "Voltar ao início". Use só quando realmente não há o que a equipe fazer.

---

## Encaminhar chamados automaticamente para técnicos

1. **Configurações → Encaminhamento**
2. Cada linha é uma **categoria** do formulário
3. Escolha o destino:
   - **Técnico da unidade** — o backend escolhe quem atende aquela escola
   - **Um técnico fixo** — selecione na lista
4. **Salvar**
5. Ligue o switch **Automático** → *Ativo*

### Regra importante

A regra vale para os chamados **novos**. Para os que já estão abertos **sem
responsável**:

1. Clique em **Aplicar agora aos abertos**
2. Confirme o aviso
3. A tela informa quantos foram encaminhados e quantos ficaram sem técnico

### Quando "Aplicar agora" retorna 0

Comportamento correto: nenhum chamado aberto sem responsável **nas categorias
com regra ativa**. Verifique se a categoria do chamado tem regra **ligada**.

### Quando fica "sem técnico cadastrado"

Nenhum técnico ativo atende aquela unidade. Verifique em **Usuários** se há
técnico e se a `filial` dele inclui a escola (é uma lista separada por vírgula).
Alternativa: **encaminhar manualmente** pelo botão no detalhe do chamado.

---

## Adicionar um técnico a mais uma unidade

**Usuários → editar o técnico → Units escolares**.

Cada unidade é uma linha com um `select`. Clique em **Adicionar mais uma
unidade**. O botão fica desabilitado quando não há mais opções livres.

A lista é salva como texto separado por vírgula:

```
"unidade 1, unidade 2, unidade 3"
```

> O técnico vê chamados **e** equipamentos de todas as unidades marcadas.

---

## Criar um usuário

**Usuários → Novo usuário**

| Campo | Nota |
|---|---|
| Nome | Obrigatório |
| E-mail | Obrigatório **só na criação** — não pode ser alterado depois |
| Perfil | Se **Técnico**, aparece a lista de unidades |
| Unidade | Para os demais perfis |
| Status | Só aparece na edição |

Ao salvar, aparece um modal com a **senha temporária** e o botão "Copiar
senha". Comunique esse valor ao usuário — ele será obrigado a definir uma senha
definitiva no primeiro acesso.

**Limites:** um Gestor pode ter no máximo **2 usuários ativos** na própria
escola, e só pode criar Visualizadores. A tela mostra a cota no topo de
`/usuarios` ("Em uso: 1 de 2") e **trava o botão *Novo usuário*** quando as 2
vagas acabam — ver [Rotas e telas](./05-rotas-e-telas.md#a-cota-do-gestor-na-tela).
A trava do portal é aviso: quem recusa é o backend, com **400** *"Limite de 2
usuários por unidade atingido"*.

> A contagem é de **usuários ativos** da filial, não de Visualizadores: um
> Técnico já cadastrado na escola também ocupa uma das vagas.

### Desativar ≠ excluir

O botão **Desativar** marca `status = INATIVO` e **derruba todas as sessões**.
O registro continua no banco (preserva o histórico de chamados). Não há
exclusão definitiva pela interface.

Um usuário não pode se desativar a si mesmo.

---

## Perdi a senha de um usuário

1. **Usuários → busque o e-mail**
2. **⋮ → Nova senha temporária** (só ADMIN)
3. Copie e comunique ao usuário
4. O usuário entra e **tem que** definir uma senha nova

> Isso também **derruba as sessões** do usuário.

---

## Verificar se o sistema inteiro está saudável

**Configurações → Integrações → "Testar agora"**

| Resultado | Significado |
|---|---|
| 🟢 Backend — Chamados | `GET /dashboard/stats` respondeu |
| 🟢 Backend — Equipamentos (SCE) | `GET /unidades-resumo` respondeu |
| 🟢 Login único (SSO) | Derivado: os dois acima OK |
| 🔴 qualquer um | Ver [Tratamento de erros · A3/E1](./09-tratamento-de-erros.md) |

É a **primeira coisa a checar** sempre que alguém disser "os equipamentos não
carregam".

Depois, veja **Configurações → Logs do sistema** para saber o que falhou e desde
quando.

---

## Descobrir por que uma tela está vazia ou quebrada

1. **Logs do sistema** — clique na linha para expandir a mensagem completa
2. `Network` no navegador → filtre por `fetch/xhr` → veja o que falhou
3. **Console** — erro de CORS aparece aqui
4. Confirme se é **só um módulo** que falhou:
   - Equipamentos, Manutenção, Unidades → **SCE**
   - Chamados, Notificações, Tutoriais, Usuários → **Chamados**
   - Os dois → sessão ou rede

O procedimento completo está em
[Tratamento de erros · Parte 3](./09-tratamento-de-erros.md#parte-3--diagnóstico).

---

## Testar como outro perfil

> ⚠️ **Só funciona em desenvolvimento** (`npm run dev`). A aba "Testes de
> acesso" não é montada no build de produção.

**Configurações → Testes de acesso** → escolher Gestor / Técnico / Visualizador.

- Só a **interface** muda. O backend continua autorizando pelo perfil real.
- Um banner amarelo aparece no topo de tudo.
- Desaparece ao recarregar a página.
- A escola (MÃE/FILHA) **não** é simulada.

Serve para conferir se os menus e botões estão certainos — não substitui um
usuário real.

---

## Adicionar um item ao catálogo de equipamentos

**Configurações → Catálogo de equipamentos** → Categoria / Marca / Modelo →
**Adicionar**.

Esse catálogo alimenta a cascata do formulário público de chamado
(categoria → marca → modelo).

---

## Trocar uma tela inteira

| Tela | Arquivo |
|---|---|
| Painel | `src/views/PainelView.vue` |
| Chamados | `src/views/ChamadosView.vue` |
| Equipamentos | `src/views/EquipamentosView.vue` |
| Manutenção | `src/views/ManutencaoView.vue` |
| Unidades | `src/views/UnidadesView.vue` |
| Tutoriais | `src/views/TutoriaisView.vue` + `TutorialDetalheView.vue` |
| Relatórios | `src/views/RelatoriosView.vue` |
| Usuários | `src/views/UsuariosView.vue` |
| Configurações | `src/views/ConfiguracoesView.vue` |
| Elogios (ADMIN) | `src/views/FeedbackView.vue` |
| Formulário público | `src/views/publico/NovoChamadoView.vue` |
| Consulta pública | `src/views/publico/ConsultaProtocoloView.vue` |
| Layout interno | `src/components/layout/AppShell.vue`, `AppSidebar.vue`, `AppTopbar.vue` |
| Layout público | `src/components/publico/PublicoLayout.vue` |

Depois da troca, atualize o índice em `docs/README.md` se o print mudou.

---

## Antes de abrir um pull request / publicar

```bash
npm run build        # a checagem de tipos é a única automação do projeto
```

- [ ] `npm run build` sem erro
- [ ] Se mudou rota: atualize `router/index.ts` **e** o menu em `AppSidebar.vue`
- [ ] Se mudou perfil: confira `meta.roles` **e** os `v-if` do menu **e** os
  botões da tela
- [ ] Se mudou a API: ajuste `api/<recurso>.ts` **e** o tipo em `types/index.ts`
- [ ] Se mudou cor: use o token, não uma cor literal
- [ ] Se mudou erro: ver [Parte 4 do capítulo de erros](./09-tratamento-de-erros.md)
- [ ] Se mudou o **CSP**: atualize os **dois** lugares — `vercel.json` › `headers`
  e o `<meta http-equiv>` do `index.html`
- [ ] Se mudou sessão: lembre que o `accessToken` é **só em memória** e o
  refresh token viaja em cookie `httpOnly` — nada disso vai para o
  `localStorage`
- [ ] Se mudou fluxo público: atualize o print em `docs/screenshots/`

---

## Onde documentar uma mudança

| Tipo de mudança | Arquivo de doc a atualizar |
|---|---|
| Rota nova ou tela nova | `05-rotas-e-telas.md` |
| Perfil/regra de permissão | `04-autenticacao-e-permissoes.md` |
| Endpoint novo | `06-backends-e-endpoints.md` |
| Store/composable novo | `07-estado-stores-composables.md` |
| Componente ou token novo | `08-componentes-e-design-system.md` |
| Modo de falha novo | `09-tratamento-de-erros.md` (Parte 2) |
| Variável de ambiente / deploy | `10-build-deploy-ambientes.md` |
| Sigla nova | `12-glossario.md` |

---

Ver também: [Tratamento de erros](./09-tratamento-de-erros.md) ·
[Estrutura do projeto](./03-estrutura-do-projeto.md) ·
[Glossário](./12-glossario.md)
