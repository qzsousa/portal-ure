# 15 — Primeiro acesso: código no lugar da senha

> **Status: verificado em execução (10/10/2026).** O fluxo foi testado de ponta a
> ponta com os três serviços no ar: backend de chamados (`:10000`), SCE (`:3000`)
> e portal (`:5173`). O que está escrito abaixo como "verificado" foi observado
> na tela ou na resposta da API — não é leitura de código.

## A pergunta que dá nome a este fluxo

> *No lugar da senha eu coloco o código de acesso?*

**Não.** O código não substitui a senha — ele **libera você criar a sua**. São
etapas separadas, e a pessoa nunca digita a senha de ninguém, nem alguém vê a
dela.

```
1. e-mail   →  o portal pergunta ao backend se a conta está em primeiro acesso
2. código   →  6 dígitos que o ADMIN gerou (expiram em 24 h, uso único)
3. senha    →  no primeiro acesso, a pessoa CRIA a própria senha
```

Nas sessões seguintes é login normal: e-mail + senha.

## Por que não "senha temporária"

Porque são coisas diferentes, com consequências diferentes:

| | Senha temporária | Código de primeiro acesso |
|---|---|---|
| Duração | até alguém trocar | 24 h, **uso único** |
| Vira senha? | sim | **não** |
| O ADMIN sabe a senha? | sim, porque ele gerou | o que ele gera é o **código**, que repassa |
| Reutilizável? | sim | não — e gerar outro **anula** o anterior |
| Esqueceu de novo? | precisa de novo pedido | idem, e o caminho é o mesmo |

O pedido de acesso mora no chamado; a senha nunca passa por lá.

## O caminho percorrido

**1. Quem pede.** Abre `/publico/novo-chamado` e escolhe a categoria de
acesso/senha. O formulário traz o aviso explícito de que a senha **não** deve
ser escrita ali.

**2. O ADMIN responde.** Em `Chamados`, abre o pedido e usa **"Responder com
código de primeiro acesso"** — botão que só aparece para ADMIN da Matriz, em
chamado de recuperação de senha que ainda não foi resolvido. O código é gerado,
**copiado para a resposta do chamado**, e exibido numa caixa para copiar.

**3. A escola lê.** Consulta o chamado pelo número de protocolo, sem precisar de
login, e encontra o código na resposta.

**4. A pessoa entra.** Na tela de acesso, digita o e-mail → o sistema detecta o
primeiro acesso → mostra a etapa do código → cria a senha.

## O que foi verificado em execução

| Verificação | Resultado |
|---|---|
| `POST /api/auth/verificar-email` para conta em primeiro acesso | `{"existe":true,"primeiroAcesso":true,"ativo":true}` |
| Digitando o e-mail, o portal entra sozinho na etapa do código | **sim**, sem clicar em nada |
| Tela do código renderiza com os 6 dígitos e as 2 etapas | **sim** |
| Código inválido (`000000`) | **rejeitado** — `400 CODIGO_INVALIDO` |
| Código válido (`717218`) | **aceito**, avança para "Criar sua senha" |
| Criar a senha | **entra no portal** como Administrador |
| Banco guarda só o hash do código | **sim** (`codigoHash`), nunca em claro |

Capturas:

![Etapa de criação da senha, com a trilha de 2 etapas e o botão "Criar senha e entrar"](./screenshots/88-primeiro-acesso-etapa-criar-senha.png)

O código de primeiro acesso já foi conferido: a etapa anterior liberou a criação
da senha.

![Painel depois do primeiro acesso, autenticado como Administrador](./screenshots/89-primeiro-acesso-pos-login-painel.png)

O acesso foi efetivado: menu completo, perfil **Administrador · URE Leste 3**.

## Proteção contra enumeração de contas

`/verificar-email` responde **o mesmo objeto** para e-mail inexistente e para
quem já tem senha — só difere quando a pessoa realmente está em primeiro acesso
e isso vaza porque é o que ela precisa saber para seguir o fluxo.

```
e-mail inexistente  → { existe: true, primeiroAcesso: false, ativo: true }
e-mail cadastrado   → { existe: true, primeiroAcesso: true,  ativo: true }
```

## Quando a verificação falha

Se o backend não responde, o portal **não trava** a pessoa: ela segue para a
etela de senha e tenta o login normal. Mas agora aparece um aviso dizendo que a
verificação não aconteceu, com o atalho **"Já tenho um código"** — que leva
direto à etapa do código.

O atalho funciona porque o código **não depende** dessa verificação: o backend
valida o código ao confirmar, não na etapa 1.

Ver [a correção em `09-tratamento-de-erros.md`](./09-tratamento-de-erros.md).

## Limite conhecido — e a senha provisória (atualizado em 12/10/2026)

A versão anterior deste capítulo dizia, neste mesmo ponto:

> Este fluxo cobre **primeiro acesso**. Para quem **já tem senha e a esqueceu**,
> o caminho é o de sempre (pedir redefinição) e **não foi construído aqui**. Se
> esse for o seu caso, é outra task.

Essa task foi feita. Quem já tem senha e esqueceu agora tem caminho próprio, e
**não passa pelo código de 6 dígitos** — ele é exclusive de quem nunca definiu
senha.

## Os dois caminhos, lado a lado

| | Primeiro acesso | Senha provisória |
|---|---|---|
| Quem é a pessoa | nunca definiu senha | já usa o sistema e esqueceu |
| O que a Matriz gera | código de 6 dígitos | senha provisória |
| Como entra | digita o código | digita a senha provisória |
| Vira senha definitiva | sim | sim, na troca |
| Rótulo na tela | "Primeiro acesso" | "Trocar a senha provisória" |

O sinal que o portal usa é o mesmo nos dois casos — `mustChangePassword` — mas
vem de **duas colunas diferentes**, porque são duas perguntas diferentes:

```
primeiroLogin     "esta pessoa NUNCA definiu senha?"
senhaProvisoria   "a senha ATUAL foi gerada pela Matriz?"
```

Mientras coubessem na mesma coluna, não haveria como representar senha
provisória para quem já tem senha. Foi o que fez o botão da Matriz recusar com
"este usuário já definiu a senha".

## O caminho de quem já tem senha

```
1. /login  →  e-mail  →  etapa de senha
2. "Esqueci minha senha"
3. /chamado/novo já em Sistemas → PortalNet → "Esqueci minha senha"
4. A escola escreve o que aconteceu e abre o chamado
5. A Matriz gera a senha provisória
   POST /api/auth/admin/gerar-senha-provisoria   (ADMIN)
6. A pessoa entra com a senha provisória
7. O portal manda direto para /trocar-senha
```

A senha provisória volta no corpo da resposta, porque a Matriz precisa repassar
à pessoa. Por isso a rota é ADMIN-only e nunca entra em log.

### Onde fica o botão (passo 5)

**`Usuários` → menu de ações da linha do usuário → "Gerar senha provisória".**
O mesmo menu onde fica "Novo código de acesso"; o modal é o mesmo, com outro
título e outro texto.

O item **só aparece para quem já tem senha** (`primeiroLogin = false`), porque
é esse o público da senha provisória. Quem nunca definiu senha continua vendo
apenas "Novo código de acesso" — que é o caminho certo para ela. Mostrar as duas
opções para todo mundo deixaria a Matriz escolher a errada.

Quando a senha é gerada, a antiga deixa de funcionar e as sessões abertas da
pessoa são encerradas.

**Nenhum campo do pedido de senha pede a senha antiga** — quem esqueceu não a
tem. O formulário é o registro de que ela pediu; a emissão continua sendo da
Matriz.

## O link do passo 3 é um deep-link

O botão do login leva para `/chamado/novo` com query:

```
?categoria=sistemas&respostaSeed=seed-perg-sist-1&resposta=PortalNet
```

Isso abre a categoria, marca PortalNet na 1ª pergunta e revela a pergunta de
senha — a pessoa não escolhe entre quatro categorias e três sistemas.

A pergunta é a `seed-perg-sist-senha`, criada por migration
(`20261012100000_add_pergunta_esqueci_senha`). Ela **só existe no banco por
migration**: o `SEED_FORMULARIO` só roda quando a tabela de categorias está
vazia, e produção já tinha 11 perguntas em Sistemas.

Se a pergunta for removida ou renomeada, o deep-link ainda abre a categoria e a
pessoa escolhe — não quebra.

## Duas regras que impedem a pessoa de ficar presa

**Trocar a senha limpa a marca.** `definirSenhaPrimeiroAcesso` e o
`PATCH /change-password` zeram `senhaProvisoria`. Sem isso a pessoa trocava a
senha e caía de volta na troca, em laço.

**A senha atual só é conferida quando existe.** O handler só compara a senha
antiga quando `primeiroLogin` **e** `senhaProvisoria` são falsos. Nos dois casos
em que a pessoa não tem senha antiga, a checagem é pulada:

```
primeiroLogin=true  ou senhaProvisoria=true  → não confere a senha atual
os dois false                                  → confere, 401 se errada
```

E o contrato precisa permitir `senhaAtual` vazio para isso funcionar — com
`min(1)` o corpo era recusado antes do handler e a pessoa ficava trancada
respondendo 400 numa tela que a mandava trocar a senha. Ver
[`04-autenticacao-e-permissoes.md`](./04-autenticacao-e-permissoes.md).

## Como testar de novo

```bash
cd chamados/backend && npm run dev     # :10000
cd portal && npm run dev               # :5173
```

Depois, com uma conta em primeiro acesso:

1. `POST /api/auth/admin/gerar-codigo-primeiro-acesso` (como ADMIN) — emite o código
2. Na tela de acesso, digite o e-mail da conta
3. A etapa do código deve aparecer sozinha
