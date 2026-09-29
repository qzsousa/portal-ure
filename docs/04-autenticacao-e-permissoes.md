# 04 · Autenticação e permissões

## Modelo de identidade

Quem emite a identidade é o **backend de chamados**. O SCE aceita o mesmo token
por SSO, mas **nunca confia no nível que vem no JWT** — ele resolve o usuário
no banco dele e lê o nível de lá. Isso evita que um token adulterado elevate
privilégio no inventário.

```
POST /api/auth/login
{
  "email": "usuario@educacao.sp.gov.br",
  "senha": "..."
}
→ 200
Set-Cookie: refreshToken=<jwt>; HttpOnly; Secure; SameSite=None; Max-Age=604800

{
  "accessToken": "eyJhbGciOiJIUzI1NiIs…",   // expira em 15 min · só em memória
  "user": {
    "id": "…", "email": "…", "nome": "…",
    "nivel": "ADMIN",                        // ADMIN | TECNICO | GESTOR | VISUALIZADOR
    "filial": "URE Leste 3",
    "grupo": "E.E. A / E.E. B",              // nome composto do prédio
    "papelUnidade": "MAE",                   // MAE | FILHA
    "status": "ATIVO",
    "primeiroLogin": false
  },
  "primeiroLogin": false
}
```

> ⚠️ **O `refreshToken` não vem no corpo.** Ele viaja apenas no cookie
> `httpOnly` — o JavaScript não consegue lê-lo, e é por isso que o campo não
> existe mais no tipo `LoginResponse`. Quem renova a sessão é
> `POST /auth/refresh` com **corpo vazio**; o navegador anexa o cookie sozinho.

### Como a sessão sobrevive a um F5

Não sobrevive — ela é **reconstruída**. Não há token em disco:

```
F5 → initialize() → POST /auth/refresh (cookie) → 200? novo accessToken + user
                                                     → 401? deslogado (esperado)
```

O guard espera `initialize()` terminar antes de decidir qualquer redirecionamento,
então não existe "flash" de tela protegida para quem não tem sessão.

> **Consequência do `primeiroLogin`:** quando vem `true`, o usuário é
> **obrigado** a criar uma senha definitiva antes de qualquer outra tela. Não
> é um aviso — o guard do router bloqueia a navegação.

---

## Os quatro níveis

| Nível | Rótulo na interface | Alcance | O que pode fazer |
|---|---|---|---|
| `ADMIN` | Administrador | URE Leste 3 (matriz) | Tudo: configurações, usuários de qualquer perfil, equ exclução de chamado, encaminhamento, logs |
| `TECNICO` | Técnico | Lista de escolas da sua `filial` | Chamados (encaminhar, status, histórico, lote), equipamentos, manutenção, unidades |
| `GESTOR` | Gestor | Uma escola | Gerir chamados e equipamentos da unidade, gerir usuários da escola (até 2, sempre Visualizador), concluir chamados |
| `VISUALIZADOR` | Visualizador | Uma escola | Igual ao Gestor, **sem** apagar usuários nem equipamentos |

### Detalhe do Técnico

A `filial` do Técnico guarda uma **lista separada por vírgula**:

```
filial = "E.E. HUMBERTO DANTAS, E.E. HUMBERTO BAPTISTELLI"
```

O backend usa isso para filtrar chamados e equipamentos: o técnico vê os dois
setores. No *Cadastro de usuários*, cada unidade é uma linha com um `select`, e
o botão "Adicionar mais uma unidade" cria a próxima linha.

---

## Papel de unidade: MÃE e FILHA

Independente do nível, uma escola tem um papel dentro do grupo que divide o
prédio:

```
"grupo": "E.E. CESAR DONATO CALABREZ / E.E. ISAAC SCHRAIBER FILHO"
papelUnidade: "MAE"     ← administra o painel de equipamentos compartilhado
papelUnidade: "FILHA"   ← só visualiza
```

O papel é **calculado pelo backend** no login e no `/auth/me`, a partir do
catálogo de escolas. Não vem do banco como coluna.

### O que a FILHA perde

| Operação | MÃE | FILHA |
|---|---|---|
| Ver equipamentos do grupo | ✅ | ✅ |
| Filtrar, buscar, exportar CSV/PDF | ✅ | ✅ |
| Cadastrar equipamento | ✅ | ❌ |
| Editar equipamento | ✅ | ❌ |
| Remover equipamento | ✅ | ❌ |

No portal isso aparece de três formas:

1. **Botão "Adicionar equipamento" some.**
2. **"Editar" e "Remover" somem** do menu de ações da linha.
3. **Banner amarelo na tela** (`EquipamentosView`):

   > Equipamentos compartilhados com **{irma}** — sua unidade tem acesso
   > **somente de visualização**. Para cadastrar, alterar ou remover, fale com a
   > escola principal.

O bloqueio é **duplo**: a interface esconde o botão **e** o SCE rejeita a
escrita (devolvendo `success: false` com a mensagem de somente-leitura). Se
alguém chamar a API direto, não consegue escrever.

> ⚠️ **Importante:** a regra de FILHA vale **só para equipamentos**. Em
> *Chamados*, Gestor e Visualizador têm exatamente o mesmo comportamento
> (responder + concluir).

---

## Guarda de rota

`router/index.ts` roda um `beforeEach` global com quatro regras, nesta ordem:

```ts
1. auth ainda não inicializada?  → await auth.initialize()

2. rota NÃO é pública e não estou autenticado
      → { name: 'login', query: { redirect: to.fullPath } }
      (depois de entrar, o usuário volta exatamente para onde tentava ir)

3. estou em /login e já estou autenticado
      → { name: 'painel' }

4. auth.mustChangePassword e a rota não é /trocar-senha
      → { name: 'trocar-senha' }
      (vale inclusive para rotas públicas!)

5. rota tem meta.roles e meu nível não está na lista
      → { name: 'painel' }        ← sem mensagem de erro

6. document.title = `${meta.title} · PORTAL URE LESTE 3`
```

Três decisões importantes:

- **Não existe tela de "403".** Quem tenta acessar algo fora do perfil é
  redirecionado ao painel, silenciosamente. O menu já escondeu o caminho, então
  a situação não deveria acontecer — e se acontecer, o redirecionamento é
  mais limpo que uma tela de erro.
- **A troca de senha obrigatória vence até as rotas públicas.** Um usuário de
  primeiro acesso não consegue nem abrir o formulário de chamado até definir a
  senha. É intencional: garante que todo mundo no sistema tem senha definitiva.
- **Rota desconhecida → painel.** O catch-all `/:pathMatch(.*)*` redireciona
  para `/painel`. Não existe página 404.

---

## Tabela de rotas e quem acessa

| Rota | Tela | Público | Perfis |
|---|---|---|---|
| `/login` | Login | ✅ | todos |
| `/trocar-senha` | Trocar senha | — | todos os autenticados |
| `/chamado/novo` | Novo chamado | ✅ | qualquer pessoa |
| `/consulta` | Consultar chamado | ✅ | qualquer pessoa |
| `/elogios` | Elogios e sugestões | ✅ | qualquer pessoa |
| `/tutorial/:id` | Tutorial público | ✅ | qualquer pessoa |
| `/matriz` | Painel geral | ✅ | qualquer pessoa |
| `/dirigente` | Painel do dirigente | ✅ | qualquer pessoa |
| `/painel` | Painel | — | todos os autenticados |
| `/equipamentos` | Equipamentos | — | todos os autenticados |
| `/manutencao` | Manutenção | — | todos os autenticados |
| `/chamados` | Chamados | — | todos os autenticados |
| `/tutoriais` | Tutoriais | — | todos os autenticados |
| `/tutoriais/:id` | Detalhe do tutorial | — | leitura: todos · escrita: ADMIN |
| `/feedback` | Elogios e avaliações | — | **ADMIN** |
| `/unidades` | Unidades escolares | — | **ADMIN, TECNICO** |
| `/relatorios` | Relatórios | — | todos os autenticados |
| `/usuarios` | Usuários | — | **ADMIN, GESTOR** |
| `/configuracoes` | Configurações | — | **ADMIN** |

> **Sobre `/relatorios`:** a rota não tem `meta.roles`, então aparece no menu
> para todo mundo. Mas dois dos seis relatórios exigem ADMIN no backend. Para
> quem não é, a tela mostra um aviso no topo e o botão responde com
> "Seu perfil não tem permissão para gerar este relatório (disponível apenas
> para ADMIN)."

---

## O menu lateral

`AppSidebar.vue` filtra os itens no `computed visibleItems`:

```ts
adminOnly:    só nivel === 'ADMIN'              → Configurações
gestorTambem: ['ADMIN','GESTOR']                → Usuários
matrizOnly:   ['ADMIN','TECNICO']               → Unidades Escolares
(sem flag):   todos os autenticados             → o resto
```

O filtro é **cosmético** — quem digitar a URL ainda é barrado pelo guard. Mas o
guard não serve para tudo: ele verifica **nível**, não **papel de unidade**. Por
isso o botão "Remover equipamento" usa `podeGerenciar` (nível + papel) e não
apenas `meta.roles`.

---

## Troca de senha

Duas funções numa tela só (`TrocarSenhaView`), com rótulos que se adaptam:

| Situação | Título | Dica |
|---|---|---|
| Primeiro acesso | **Defina sua senha** | "Este é seu primeiro acesso. Crie uma senha definitiva para continuar." |
| Troca voluntária | **Trocar senha** | "Após trocar a senha, você precisará entrar novamente." |

Política de senha, avaliada **na ordem**, primeira falha vence:

1. Mínimo de 8 caracteres
2. Pelo menos uma letra maiúscula
3. Pelo menos uma letra minúscula
4. Pelo menos um número
5. Pelo menos um caractere especial

Ao salvar, o backend **derruba todas as sessões** do usuário e o portal limpa o
estado em memória e volta para `/login`. É por isso que o botão diz
"Salvar nova senha" e não "Salvar" — você vai precisar entrar de novo.

> Curiosidade do formulário: no primeiro acesso o campo de senha atual é
> obrigatório no frontend, mas o backend **não confere** a senha temporária
> (só exige o campo preenchido). Isso evita que uma senha temporária expirada
> trave o primeiro acesso.

---

## Simulação de perfil (apenas em desenvolvimento)

> ⚠️ **A aba "Testes de acesso" só existe em desenvolvimento.** A flag
> `auth.simulacaoAtivavel` vem de `import.meta.env.DEV`; em produção o botão
> some e `simularComo()` é um no-op. O motivo está no próprio código: o
> simulador troca o `nivel` apenas na memória, então em produção levava o
> usuário a crer que trocar perfil era uma função real de autorização — e
> escondia bugs de menu/guard, em que o item sumia para o perfil errado sem o
> backend recusar a requisição.

Em *Configurações → Testes de acesso* (só em `npm run dev`), o ADMIN pode
"abrir o portal como" outro perfil. O que acontece:

- Troca **apenas** `user.nivel` na memória.
- Menus, guards de rota e botões passam a se comportar como aquele perfil.
- O JWT e a sessão continuam sendo os reais — **o backend segue autorizando pelo
  perfil verdadeiro**, então um botão que aparece na simulação pode falhar com
  403 ao ser clicado. Isso é proposital: mostra onde a UI e o backend divergem.
- Um **banner amarelo** aparece no topo de toda página autenticada:

  > Simulando perfil **Técnico** — apenas a interface muda; suas credenciais
  > continuam as mesmas.  `[ Encerrar simulação ]`

- **Some ao recarregar a página** (não é persistido).
- A **escola continua real**: se você é FILHA e simula ADMIN, continua somente
  leitura em equipamentos. O papel de unidade não é simulado.
- Mesmo após um refresh de token automático, a simulação continua ativa.

---

## A consulta pública por protocolo

Esta é a parte mais sensível do sistema, porque é **público**.

### O problema

O protocolo é `CH-AAAAMMDD-NNNN` — sequencial por dia. Significa que os
protocolos do dia são **previsíveis**: `CH-20260929-0001`, `-0002`… Dá para
chutar e abrir o chamado de qualquer pessoa.

### A solução

A consulta exige o **par protocolo + e-mail**, e o e-mail precisa ser
**exatamente** o informado na abertura (comparação sem diferenciar maiúsculas,
ignorando espaços):

```
GET /api/chamados/protocolo/CH-20260929-0006?email=paula.ribeiro@educacao.sp.gov.br
```

Por isso o e-mail became **obrigatório já na abertura** do chamado — não é um
campo decorativo, é a segunda credencial.

### As três defesas

| Defesa | Como funciona |
|---|---|
| **Par obrigatório** | Sem os dois, nada abre. O backend exige e-mail válido por schema. |
| **Resposta ambígua** | Protocolo inexistente, chamado excluído, chamado sem e-mail gravado e e-mail errado **todos** devolvem exatamente a mesma resposta: `404` com *"Chamado não encontrado. Confira o protocolo e o e-mail informados."* Não dá para enumerar. |
| **Rate limit** | 20 requisições por minuto nas rotas `/chamados/protocolo`. |

A tela de consulta reproduz a ambiguidade do lado do cliente também:

![Erro de consulta — par não confere](screenshots/08-consulta-erro-404.png)

> Note que a mensagem **não diz qual dos dois campos estava errado** — é
> proposital. Dizer "e-mail incorreto" já confirmaria que o protocolo existe.

### A avaliação usa o mesmo par

Para avaliar um chamado (nota 1 a 5), a pessoa precisa informar **protocolo +
e-mail de novo**. Sem isso, qualquer um com o protocolo poderia avaliar o
chamado dos outros. Regras:

- Só chamado com status `RESOLVIDO`.
- Uma avaliação por chamado — a segunda tentativa devolve `409`.
- Comentário opcional, limitado a 1000 caracteres.

### Deep link seguro

O botão "Acompanhar chamado" da tela de sucesso já leva o par:

```
/consulta?protocolo=CH-20260929-0006&email=paula.ribeiro@educacao.sp.gov.br
```

O e-mail validado é guardado em memória e reaproveitado no polling e no envio da
avaliação — a pessoa não precisa redigitar.

---

Ver também: [Backends e endpoints](./06-backends-e-endpoints.md) ·
[Rotas e telas](./05-rotas-e-telas.md) ·
[Tratamento de erros](./09-tratamento-de-erros.md)
