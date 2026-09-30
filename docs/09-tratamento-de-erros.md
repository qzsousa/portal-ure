# 09 · Tratamento de erros

> **Este é o arquivo único de tratamento de erros do sistema.** Ele reúne (1) a
> estratégia adotada, (2) o catálogo de todos os erros possíveis com sintomas,
> causa e solução, e (3) os procedimentos de diagnóstico. Se você está
> investigando "algo não está funcionando", comece pela
> [Parte 3 — Diagnóstico](#parte-3--diagnóstico).

---

## Índice

- [Parte 1 — Estratégia](#parte-1--estratégia)
  - [As 6 camadas](#as-6-camadas)
  - [Regras de ouro](#regras-de-ouro)
  - [Flosso de um erro](#flosso-de-um-erro)
- [Parte 2 — Catálogo de erros](#parte-2--catálogo-de-erros)
  - [A · Backend fora do ar / rede](#a--backend-fora-do-ar--rede)
  - [B · Sessão e autenticação](#b--sessão-e-autenticação)
  - [C · Permissões](#c--permissões)
  - [D · Formulário público e protocolo](#d--formulário-público-e-protocolo)
  - [E · Equipamentos / SCE](#e--equipamentos--sce)
  - [F · Anexos](#f--anexos)
  - [G · Formulário configurável e configurações](#g--formulário-configurável-e-configurações)
  - [H · Notificações, tutoriais e polling](#h--notificações-tutoriais-e-polling)
  - [I · Frontend (build, tipos, runtime)](#i--frontend-build-tipos-runtime)
- [Parte 3 — Diagnóstico](#parte-3--diagnóstico)
  - [Checklist de 60 segundos](#checklist-de-60-segundos)
  - [Comandos de diagnóstico](#comandos-de-diagnóstico)
  - [Falsos positivos no log](#falsos-positivos-no-log)
  - [Problemas recorrentes conhecidos](#problemas-recorrentes-conhecidos)
- [Parte 4 — Como melhorar](#parte-4--como-melhorar)

---

# Parte 1 — Estratégia

## As 6 camadas

O portal trata erro em seis camadas distintas. Cada uma tem um escopo e um
meio de exibição próprios — **e é importantíssimo não misturá-las**.

```
   ┌──────────────────────────────────────────────────────────────┐
6  │  TELA          banner no corpo · estado vazio · campo errado│
5  │  TOAST         useUiStore().error(...)  → some em 6 s       │
4  │  MENSAGEM      apiError(e, fallback) → texto do backend      │
3  │  INTERCEPTOR   extrai status + mensagem do AxiosError        │
2  │  LOG           useErrorLogStore().registrar(...) → persistido│
1  │  BACKEND       Envelope { success, data, error }            │
   └──────────────────────────────────────────────────────────────┘
```

| # | Camada | Onde | Alcance | Persiste |
|---|---|---|---|---|
| 1 | Backend | `sce.ts` › `unwrap()` | Traduz `{success:false}` em `throw` | — |
| 2 | Log de erros | `api/http.ts` › `createBackendErrorInterceptor` | Só 5xx / sem resposta | ✅ localStorage |
| 3 | Interceptor | `api/http.ts` | Refresh de token + extração de mensagem | — |
| 4 | Mensagem | `utils/apiError.ts` | Zod `details`, `message`, `fallback` | — |
| 5 | Toast | `stores/ui.ts` | Ação pontual (6 s) | — |
| 6 | Tela | view | Página inteira / campo / estado vazio | — |

### Regra mais importante de todas

**Erro do servidor é evento; erro que impede o uso é estado.**

> - O servidor recusou **salvar** um chamado → **toast**. A tela continua
>   utilizável.
> - A **página** não carregou (lista vazia, gráfico quebrado) → **banner no
>   corpo** com botão "Tentar novamente". Um toast de 6 s não serve: a pessoa
>   fica olhando uma tela vazia sem saber o que fazer.

## Regras de ouro

1. **Toast para ação, banner para estado da tela.**
2. **Falha de polling é sempre silenciosa.** Nunca piscar, nunca limpar os dados.
3. **Erro de 4xx não vai para o log de backend.** Um 404 é uma resposta normal.
4. **Toda mensagem tem caminho de recuperação.** "Confira…" ou "Tente
   novamente", nunca só "Erro".
5. **A tela pública nunca mostra stack, status HTTP ou `error.message` cru.**
6. **Falha de rede nunca apaga o que já estava na tela.**
7. **O log de erros não é o lugar para mensagens de negócio.** Ele é para
   diagnóstico técnico do ADMIN.

---

## Flosso de um erro

### 5xx ou sem resposta (erro de infraestrutura)

```
Requisição falha
   │
   ├─► interceptor de refresh (não age: não é 401)
   │
   └─► createBackendErrorInterceptor('Chamados' | 'SCE')
          ├─ status === null  (rede/CORS/timeout)  ─┐
          ├─ status >= 500                          ├─► é erro de backend
          └─ status < 500                          ─┘
                    │
                    ├─► assinatura = "backend|método|rota|status"
                    │     ├─ igual à entrada mais recente → repeticoes++
                    │     └─ diferente → nova entrada no topo
                    │
                    ├─► persiste em localStorage (máx. 100)
                    │
                    └─► toast, com cooldown de 60 s por assinatura
                          "Erro no backend Chamados: GET /chamados (HTTP 500)"
   │
   └─► a tela que chamou decide o que exibir
          ├─ toast próprio     → ação mutacional
          ├─ banner no corpo   → falha de carga
          └─ catch vazio       → polling
```

### 401 (token expirado)

```
401 em qualquer requisição autenticada
   │
   ├─ URL é /auth/login ou /auth/refresh?  → rejeita direto (não faz loop)
   │
   ├─ já está renovando?  → coloca na fila, espera o token novo
   │
   └─ primeira requisição:
         POST /auth/refresh
           ├─ sucesso → aplica o token novo, repete a requisição original,
           │            e reanuda todas as da fila
           └─ falha (401/403) → onUnauthorized() → clearSession()
                                → o guard leva para /login
```

### 422 / 409 / 400 (regra de negócio)

```
Não é erro de infraestrutura.
   ├─ NÃO entra no log de backend
   ├─ NÃO gera toast automático
   └─ a tela formata e mostra:
        422 encaminhar sem técnico → toast com a mensagem do backend
        409 categoria já avaliada → "Este chamado já recebeu uma avaliação."
        400 senha fraca           → mensagem abaixo do campo
```

### Falha do SCE

```
Requisição ao SCE
   ├─ HTTP 200 + { success: false, error: "..." }
   │     └─ unwrap() lança Error comum (NÃO é AxiosError)
   │           ├─ o interceptor de log NÃO dispara (status é 200)
   │           └─ a tela trata como erro de aplicação
   │
   ├─ HTTP 5xx
   │     └─ mesmo caminho do backend de chamados (log + toast)
   │
   └─ sessão expirada no SCE também é 500
         └─ aparece no log como falha de servidor (falso positivo)
```

---

# Parte 2 — Catálogo de erros

## A · Backend fora do ar / rede

### A1. Tela mostra "Não foi possível carregar…" e há toast de backend

| | |
|---|---|
| **Sintoma** | Lista/gráfico vazio, banner vermelho, toast `Erro no backend SCE: GET /equipamentos-da-filial (HTTP 500)`, entrada na aba Logs |
| **Causa** | Backend no ar mas com erro interno (banco fora, exceção não tratada) |
| **Diagnóstico** | 1. Aba Configurações → **Logs do sistema**: veja a mensagem.<br>2. **Integrações** → "Testar agora": o cartão diz se responde.<br>3. `/health` do backend (Chamados) ou `/api/testar-planilha` (SCE, público). |
| **Solução** | Ver o log do serviço. Se a mensagem mencionar coluna inexistente ou violação de `not-null`, é **schema do banco** desatualizado → rode as migrations. |

### A2. Toast `… (sem resposta)`

| | |
|---|---|
| **Sintoma** | Toast `Erro no backend Chamados: GET /chamados (sem resposta)` |
| **Causa (a)** | Backend realmente desligado / porta errada na `.env`.<br>**(b)** Backend no ar, mas **CORS bloqueia** a origem.<br>**(c)** Timeout de 30 s.<br>**(d)** URL errada (typo, porta trocada). |
| **Diagnóstico** | No navegador, aba **Network**: a requisição aparece como `(failed)`.<br>Abra a URL da API direto numa aba — responde?<br>Compare `VITE_API_CHAMADOS_URL` / `VITE_API_SCE_URL` com o que está rodando.<br>Confira o console: erro de CORS vem prefixado por *blocked by CORS policy*. |
| **Solução** | Subir o backend. Se for CORS, incluir a origem do portal na configuração do backend. |

> ⚠️ **O caso mais enganoso:** CORS e "servidor desligado" produzem **exatamente**
> o mesmo `ERR_NETWORK`. Antes de culpar o servidor, verifique a URL.

### A3. Só o SCE falha, o resto funciona

| | |
|---|---|
| **Sintoma** | Painel mostra "—" nos KPIs de equipamento; `/equipamentos`, `/manutencao` e `/unidades` com banner de erro; **chamados funcionam normalmente** |
| **Diagnóstico** | Configurações → **Integrações** → "Testar agora": o cartão do SCE fica vermelho.<br>Curva: `/equipamentos-da-filial` direto na aba. |
| **Solução** | Subir o SCE. **Consequência colateral:** o painel de escola também mostra a tabela de *Chamados* normalmente — a degradação é por módulo, não por tela. |

### A4. Tudo funciona, mas o botão Exportar falha

| | |
|---|---|
| **Sintoma** | `Não foi possível exportar o CSV.` |
| **Causa provável** | O SCE gera o CSV percorrendo a lista inteira em memória. Com o parque grande, pode estourar tempo/memória. |
| **Diagnóstico** | A mensagem no log mostra o erro real do SCE. |
| **Solução** | Exportar por unidade, ou gerar o CSV no navegador (o portal **já faz isso** para 4 dos 6 relatórios). |

---

## B · Sessão e autenticação

### B1. "Credenciais inválidas"

| | |
|---|---|
| **Sintoma** | Tela de login com `Credenciais inválidas` |
| **Causa** | E-mail ou senha errados; **ou** usuário com `status = INATIVO`; **ou** e-mail digitado com acento/espaço diferente |
| **Diagnóstico** | O frontend faz `trim()` e `toLowerCase()` no e-mail — se o problema persiste, é senha ou status.<br>Pedir ao ADMIN: "Usuários → busque o usuário → veja se está **Ativo**". |
| **Solução** | Conferir status; sePrecisar, gerar senha temporária ("Nova senha temporária"). |

### B2. Volta para o login sozinho, do nada

| | |
|---|---|
| **Sintoma** | O usuário está usando e, do nada, cai no `/login` (às vezes ao navegar). |
| **Causa** | O `accessToken` expira em **15 minutos** e o refresh também falhou. Motivos: refresh token revogado (troca de senha, desativação, logout em outro dispositivo), ou cookie `httpOnly` bloqueado/expurgado pelo navegador. |
| **Diagnóstico** | No console: `document.cookie` **não** mostra o refresh token — ele é `httpOnly`, isso é o esperado.<br>No banco: a tabela `RefreshToken` tem linha para o usuário?<br>Repare se o problema acontece sempre depois de um tempo fixo (expiração) ou aleatoriamente (cookie descartado). |
| **Solução** | Se o usuário foi desativado ou trocou a senha, é o comportamento correto.<br>Caso contrário, verificar cookies bloqueados no navegador e se o backend reinicia (se o pool de refresh tokens for em memória, reiniciar derruba todas as sessões). |

> **Nada disso é debugável pelo `localStorage`.** O token não está lá. Para
> inspecionar a sessão, use `/auth/me` no console com o cookie, ou o banco.

### B2b. Recarregou a página e deslogou sozinho

| | |
|---|---|
| **Sintoma** | F5 derruba a sessão |
| **Causa** | O `accessToken` é só em memória (por segurança) e a reconstrução depende do cookie `httpOnly`. Se o cookie não foi enviado, `initialize()` recebe 401 e o usuário segue deslogado. |
| **Causas comuns** | `SameSite=None` exige `Secure` — em `http://localhost` o navegador pode recusar o cookie.<br>Cookie de terceiro bloqueado nas configurações.<br>O backend estava fora do ar no momento do F5 (o refresh falhou por rede). |
| **Diagnóstico** | Aba **Application → Cookies** do navegador: o `refreshToken` está presente?<br>Application → Local Storage: **não deve haver** `accessToken` nem `refreshToken` — se houver, é resíduo de uma versão anterior; pode apagar. |
| **Solução** | Conferir o domínio/origem; em produção, garantir HTTPS (o cookie `Secure` não trafega em HTTP). |

### B3. Loop de requisições / tela piscando

| | |
|---|---|
| **Sintoma** | A tela recarrega ou fica "piscando", muitas requisições no Network |
| **Causa** | O interceptor de refresh entrou em loop — tipicamente quando `doRefresh()` resolve `null` sem rejeitar. |
| **Diagnóstico** | Network:Many `POST /auth/refresh` seguidos de `GET` repetidos. |
| **Solução** | Verificar se `refreshTokens()` está retornando o token. As guardas já existentes: `_retry` na requisição original, e exclusão explícita de `/auth/login` e `/auth/refresh` do interceptor. |

### B4. Fica preso em "Defina sua senha"

| | |
|---|---|
| **Sintoma** | Qualquer rota redireciona para `/trocar-senha`, mesmo as públicas |
| **Causa** | `user.primeiroLogin === true` |
| **Diagnóstico** | `GET /auth/me` → campo `primeiroLogin`. |
| **Solução** | Concluir a troca. Se for indevido (senha já definida), o ADMIN gera senha temporária — isso redefine o usuário para primeiro acesso. |

### B5. Falha ao trocar a senha

| | |
|---|---|
| **Mensagens possíveis** | `Mínimo de 8 caracteres.` · `Inclua pelo menos uma letra maiúscula.` · `… minúscula.` · `… um número.` · `… um caractere especial.` · `A confirmação não confere com a nova senha.` · `Informe a senha temporária recebida.` |
| **Causa** | Política não cumprida (avaliada **no cliente**, na ordem — a primeira falha vence). |
| **Solução** | Corrigir a senha. Se o erro vier do backend (não aparece na lista), ver `apiError()` no console. |

> Detalhe: no **primeiro acesso** o campo "senha temporária" continua
> obrigatório no formulário, mas o backend **não confere** o valor. É
> proposital: evita que uma senha temporária já expirada trave o primeiro acesso.

---

## C · Permissões

### C1. Volta para o painel ao tentar acessar uma tela restrita

| | |
|---|---|
| **Sintoma** | `/configuracoes`, `/usuarios`, `/unidades` ou `/feedback` redireciona para `/painel`, sem mensagem |
| **Causa** | `meta.roles` da rota não inclui o nível do usuário |
| **Diagnóstico** | `router/index.ts` › `meta.roles` da rota vs `auth.user.nivel`. |
| **Solução** | Não é bug. Para *testar* a tela, use Configurações → **Testes de acesso** (só muda a interface). Para *usar*, o ADMIN precisa conceder o perfil. |

### C2. Botão aparece, mas a ação falha (403)

| | |
|---|---|
| **Sintoma** | Sob **simulação de perfil**, um botão aparece mas a operação volta erro |
| **Causa** | A simulação só troca `user.nivel` **na interface**. O backend continua autorizando pelo perfil real. |
| **Diagnóstico** | Banner amarelo de simulação no topo da tela. |
| **Solução** | É o comportamento desejado — mostra exatamente onde a UI é mais permissiva que a API. Encerrar a simulação. |

### C3. Escola FILHA não consegue salvar equipamento

| | |
|---|---|
| **Sintoma** | Botões escondidos **e**, se chamar a API direto, mensagem de somente-leitura |
| **Causa** | `user.papelUnidade === 'FILHA'` |
| **Diagnóstico** | `GET /auth/me` → campo `papelUnidade`. |
| **Solução** | Comportamento correto. O Usuário precisa agir pela escola MÃE do grupo. |

### C4. "Seu perfil não tem permissão para gerar este relatório"

| | |
|---|---|
| **Sintoma** | Toast ao clicar em *Inventário de Equipamentos* ou *Equipamentos por Status* com perfil não-ADMIN |
| **Causa** | A rota `/relatorios` não tem `meta.roles` (todos entram), mas o SCE exige Matriz para exportar. |
| **Solução** | Comportamento atual. Alternativas para o futuro: (a) esconder os dois cartões para não-ADMIN, (b) migrar a exportação para o navegador (como os outros 4 relatórios). |

### C5. GESTOR não consegue criar usuário de perfil choice

| | |
|---|---|
| **Sintoma** | O select de perfil está desabilitado mostrando só *Visualizador* |
| **Causa** | Regra de negócio: GESTOR só cria Visualizador da própria escola. |
| **Detalhe** | O backend também limita a **2 usuários ativos por unidade** e ignora qualquer `nivel`/`filial` enviados pelo Gestor. |

---

## D · Formulário público e protocolo

### D1. "Nenhuma categoria disponível no momento."

| | |
|---|---|
| **Sintoma** | A tela `/chamado/novo` abre sem cartões de categoria |
| **Causa** | Nenhuma categoria ativa no formulário |
| **Diagnóstico** | `GET /formulario/publico` → `data: []`.<br>No banco: `FormularioCategoria` com `ativa = false` em todas. |
| **Solução** | Configurações → Formulário de chamados → ativar ao menos uma categoria. |

### D2. "Não foi possível carregar o formulário. Tente novamente."

| | |
|---|---|
| **Sintoma** | Banner com botão **Tentar novamente** na etapa 0 |
| **Causa** | `GET /formulario/publico` falhou |
| **Diagnóstico** | Botão Logs → entrada `GET /formulario/publico`. |
| **Solução** | Corrigir o backend e clicar em "Tentar novamente". Enquanto isso, o portal **não tem fallback** — não há categorias embutidas no código. |

### D3. O botão "Continuar" some

| | |
|---|---|
| **Sintoma** | Depois de responder as perguntas, o botão *Continuar* não aparece |
| **Causa** | Alguma regra de `podeAvancarPerguntas` não foi satisfeita |
| **Lista de verificação** | 1. Todas as perguntas **obrigatórias** respondidas?<br>2. Se escolheu "Outro (descrever)", o texto tem **≥ 2 caracteres**?<br>3. Na categoria *Equipamento*: categoria + marca + modelo preenchidos?<br>4. Alguma opção escolhida tem alerta com **`encerra: true`**? → bloqueia de propósito.<br>5. Se escolheu categoria + marca + modelo, mas o catálogo estava vazio ao carregar → recarregue a página. |
| **Solução** | Corrigir os campos. Para o caso 4, o Admin precisa remover o `encerra` da opção em Configurações → Formulário. |

### D4. Pergunta condicional não aparece

| | |
|---|---|
| **Sintoma** | A pergunta que deveria aparecer depois de escolher uma opção continua oculta |
| **Causa (a)** | O **rótulo** da opção foi editado depois que a dependência foi criada.<br>**(b)** A opção escolhida é "Outro (descrever)" — o valor interno é um sentinela e nunca casa.<br>**(c)** A pergunta está inativa ou a dependência aponta para pergunta de outra categoria. |
| **Diagnóstico** | Configurações → Formulário → ver a linha da pergunta: `Exibida se «<rótulo base>» = «<opção>»`. Compare **caractere a caractere** com o rótulo atual da opção. |
| **Solução** | Corrigir o `dependeDeOpcao` para o rótulo atual, ou renomear a opção de volta. |

### D5. "Escolha a escola/unidade" — select vazio

| | |
|---|---|
| **Sintoma** | O select fica em "Carregando..." ou sem opções |
| **Causa** | `GET /escolas/nomes` falhou |
| **Diagnóstico** | No formulário público a falha é **silenciosa** (`.catch(() => {})`) — sem toast. Procure a entrada `GET /escolas/nomes` no log, ou abra a rota direto. |
| **Solução** | O backend precisa ter escolas cadastradas. Em `UsuariosView` a falha **aparece** com a mensagem "Não foi possível carregar a lista de unidades" — mais fácil de diagnosticar por lá. |

### D6. "Arquivo muito grande. O tamanho máximo é 10 MB."

| | |
|---|---|
| **Sintoma** | Validação no navegador, arquivo nem é enviado |
| **Causa** | Arquivo acima de 10 MB (formulário público) ou 5 MB (conversa de chamado) |
| **Solução** | Comprimir ou enviar mais de um arquivo menor. |

### D7. "O anexo é muito grande para ser enviado."

| | |
|---|---|
| **Sintoma** | Toast após o envio |
| **Causa** | Resposta HTTP **413** — o corpo passou do limite do servidor |
| **Diagnóstico** | Inspecionar a requisição no Network: `Payload Too Large`. |
| **Solução** | Reduzir o arquivo. Nota: o limite do frontend (10 MB) é **maior** que o do servidor (25 MB de body, mas a requisição base64 cresce ~33% — 10 MB de arquivo vira ~13 MB de JSON, e com outros campos se aproxima do limite). |

### D8. "Chamado não encontrado. Confira o número do protocolo e o e-mail usados na abertura."

| | |
|---|---|
| **Sintoma** | Consulta pública devolve HTTP 404 |
| ![](screenshots/08-consulta-erro-404.png) | |
| **Causa (a)** | Protocolo não existe.<br>**(b)** O e-mail não é o da abertura.<br>**(c)** O chamado foi excluído (`excluido = true`).<br>**(d)** Chamado antigo, aberto antes de o e-mail ser obrigatório — não tem e-mail gravado. |
| **⚠️ Importante** | A mensagem é **propositalmente ambígua** e é a mesma nos quatro casos. Isso impede que alguém enumere protocolos válidos. **Não "conserte" isso** mostrando qual campo falhou. |
| **Diagnóstico** | Só o ADMIN, pelo banco, distingue os casos. |
| **Solução** | Conferir o e-mail digitado com o do comprovante/email de envio. |

### D9. "Este chamado já recebeu uma avaliação."

| | |
|---|---|
| **Sintoma** | HTTP **409** ao enviar nota |
| **Causa** | Já existe avaliação para esse chamado (unicidade `Avaliacao.chamadoId`) |
| **Solução** | Comportamento correto. O sistema mostra a nota já registrada em modo somente-leitura. |

### D10. "Este chamado ainda não está disponível para avaliação."

| | |
|---|---|
| **Sintoma** | HTTP **400** ao enviar nota |
| **Causa** | O chamado não está `RESOLVIDO` |
| **Solução** | Concluir o chamado primeiro. |

### D11. Consulta pública devolve 400

| | |
|---|---|
| **Sintoma** | `Informe o protocolo e o e-mail para consultar o chamado.` |
| **Causa** | Protocolo vazio ou e-mail em formato inválido (falha de validação no backend) |
| **Solução** | Preencher os dois com e-mail válido. |

### D12. Muitos bloqueios em sequência na consulta

| | |
|---|---|
| **Sintoma** | HTTP 429 após várias tentativas |
| **Causa** | Rate limit de **20 req/min** nas rotas `/chamados/protocolo` |
| **Solução** | Aguardar um minuto. Não criar retry automático em loop. |

---

## E · Equipamentos / SCE

### E1. `Sessão inválida ou expirada. Faça login novamente.` (do SCE)

| | |
|---|---|
| **Sintoma** | Tela de equipamento mostra banner de erro; `unwrap()` lança; **pode ou não** aparecer no log |
| **Causa** | O SCE não reconheceu o token JWT |
| **Causas raiz (em ordem de frequência)** | 1. **`SSO_SECRET` do SCE é diferente do `JWT_SECRET` do backend de chamados.** Os segredos precisam ser **idênticos**.<br>2. `SSO_SECRET` ausente → o SSO é **desativado silenciosamente** e o SCE cai para sessão nativa.<br>3. O usuário não existe na tabela `usuarios` do SCE.<br>4. O usuário existe mas com `status ≠ 'Ativo'` no SCE.<br>5. Token expirado (15 min) **e** o refresh não rodou — o SCE não tem interceptor de sessão própria.<br>6. Token não é do tipo `access`, ou não tem `email`. |
| **Diagnóstico** | 1. Comparar `SSO_SECRET` (SCE) com `JWT_SECRET` (Chamados). **Esta é a causa nº 1 na prática.**<br>2. `GET /auth/me` no portal — o token é válido?<br>3. Conferir o e-mail na tabela `usuarios` do SCE. |
| **Solução** | Sincronizar os segredos e reiniciar os dois serviços.<br>Se o usuário não existir no SCE, o ADMIN precisa **recriar o usuário** — isso dispara o sync. |

> ⚠️ **Erro nº 1 da lista deserves destaque:** trocar o `JWT_SECRET` no backend de
> chamados **invalida silenciosamente todos os tokens já emitidos**. Se as telas
> de equipamento pararam de funcionar depois de mexer em segredo, é isso.

### E2. HTTP 500 no SCE sem mensagem útil

| | |
|---|---|
| **Sintoma** | Log mostra `POST /create-equipamento (HTTP 500)` com uma mensagem de banco |
| **Causa** | Exceção não tratada no SCE. As mensagens mais comuns: |
| | • `null value in column "categoria" violates not-null constraint` — o frontend enviou equipamento sem os três campos do catálogo.<br>• `duplicate key value violates unique constraint` — patrimônio ou série já cadastrados (o backend deveria barrar antes, mas…).<br>• `column ... does not exist` — **schema do banco desatualizado**. |
| **Diagnóstico** | Ler a mensagem completa no log (clicar para expandir). |
| **Solução** | Schema → rodar migrations. Duplicidade → conferir o equipamento existente. |

> O SCE usa Express 4 com um único error handler: **toda exceção vira HTTP 500
> com o `err.message` cru no corpo.** Não espere 400/401/403 do SCE — ele
> praticamente só devolve 200 e 500.

### E3. Equipamento novo não aparece na tela

| | |
|---|---|
| **Sintoma** | Cadastrou no SCE mas a lista do portal não mostra |
| **Causa** | No perfil não-matriz, a lista é **cacheada em memória**. O polling força recarga, mas leva até 30 s. |
| **Diagnóstico** | Esperar 30 s e atualizar a página. Se ainda assim, comparar o nome da unidade entre os dois sistemas. |
| **Solução** | Forçar recarga. Se a unidade não casar, ver `utils/escola.ts` — nomes diferentes impedem o cruzamento em *Unidades Escolares*. |

### E4. "Nenhum equipamento encontrado" em uma unidade que tem

| | |
|---|---|
| **Causa (a)** | O técnico não tem essa unidade na `filial` (lista separada por vírgula).<br>**(b)** `sessaoTemAcessoAUnidade` não casou o nome por diferença de acentuação/pontuação. |
| **Diagnóstico** | Comparar o nome no SCE com o nome no cadastro de escola.<br>O backend faz tolerância a acento e pontuação, mas **não** a diferenças de escrita. |
| **Solução** | Corrigir o cadastro no SCE para o mesmo nome da escola. |

### E5. Equipamento fica em branco no gráfico de categorias

| | |
|---|---|
| **Sintoma** | Gráfico não renderiza / "Sem dados para exibir" |
| **Causa** | Nenhum equipamento no escopo atual, ou todos filtrados fora |
| **Solução** | Limpar os filtros. |

### E6. Total de equipamentos não bate com a soma das categorias

| | |
|---|---|
| **Causa** | É o comportamento esperado. A tela **Unidades Escolares** conta **prédios**; o painel conta **nomes de unidade**. Os dois totais divergem legitimamente. |
| **⚠️ Nota** | Já houve um bug que inflava o total em ~66% (contaba a mesma escola duas vezes quando mãe e filha compartilham o nome do grupo). Foi corrigido com deduplicação por `Set`. Se o número **cresceu de repente**, confira se a correção está no código. |

### E7. Não consigo excluir equipamento — "Você não tem permissão"

| | |
|---|---|
| **Causa** | O botão só aparece para ADMIN/GESTOR **não-FILHA**; no SCE, escrita exige Matriz ou AdminFilial da própria unidade |
| **Solução** | Se for Técnico, a ação **não existe** por design (técnico não gerencia o parque, atende chamados). |

---

## F · Anexos

### F1. Anexo do chamado sumiu depois de alguns dias

| | |
|---|---|
| **Sintoma** | Link abre 404 |
| **Causa** | **Comportamento intencional.** Anexos de pergunta/resposta expiram em **7 dias**; o backend apaga do banco e do storage. Anexos da **abertura** do chamado são permanentes. |
| **Solução** | Nenhuma — é política. Se for necessário preservar, o anexo precisa ser baixado antes. |

### F2. Boletim de ocorrência não anexa

| | |
|---|---|
| **Sintoma** | Falha ao salvar equipamento com status **Extraviado** |
| **Causa** | Com `status = 'Extraviado'` o boletim é **obrigatório** no SCE |
| **Solução** | Anexar o boletim. Limite: 8 MB. |

### F3. Arquivo rejeitado por `mimeType`

| | |
|---|---|
| **Sintoma** | Upload falha sem mensagem clara |
| **Causa** | O frontend só aceita `image/*` e `.pdf`; o storage valida o tipo |
| **Solução** | Converter para PDF ou imagem. |

---

## G · Formulário configurável e configurações

### G1. Pergunta não aparece no formulário público depois de criada

| | |
|---|---|
| **Causa (a)** | `ativa = false`.<br>**(b)** `ordem` muito alta, ficou no fim.<br>**(c)** Depende de outra pergunta e a condição não foi satisfeita.<br>**(d)** A **categoria** está inativa. |
| **Diagnóstico** | Configurações → Formulário: os badges *Inativa* e *Condicional* dizem qual é o caso. |
| **Solução** | Ativar a pergunta e a categoria. |

### G2. "Categoria salva" mas não aparece

| | |
|---|---|
| **Causa** | Erro de **cópia**: a mensagem de sucesso aparece **antes** de confirmar com o backend? Não — verifique se a categoria está **ativa** e se a tela foi recarregada (o componente recarrega via `@salvo`). |
| **Diagnóstico** | Comparar com a resposta de `GET /formulario/publico` (o que o público realmente vê). |

### G3. "Falha ao excluir a categoria"

| | |
|---|---|
| **Sintoma** | A exclusão falha |
| **Causa** | Não deveria — a exclusão de categoria **é em cascata** e apaga as perguntas. Se falhar, é erro de banco ou pergunta referenciada por outra dependência. |
| **Solução** | Verificar o log. As perguntas continuam existindo e o formulário público fica como estava. |

### G4. Reordenar perguntas não muda a ordem no público

| | |
|---|---|
| **Causa (a)** | Duas perguntas com o **mesmo `ordem`** — o `↑`/`↓` trocam ordens e nada muda.<br>**(b)** O cache do navegador. |
| **Solução** | Definir ordens distintas no modal (o campo "Ordem de exibição"). |

### G5. Regras de encaminhamento não disparam

| | |
|---|---|
| **Sintoma** | O chamado nasce sem responsável |
| **Causa (a)** | A regra está **desligada** (regras nascem com `ativa = false`).<br>**(b)** A `categoriaChave` do chamado é `null` — isso acontece em **chamados antigos**.<br>**(c)** A regra vale só para chamados **novos**. |
| **Solução** | Para os já abertos, usar **"Aplicar agora aos abertos"**, que só afeta chamados sem responsável. |

### G6. "Aplicar agora" retorna `X ficaram sem técnico cadastrado`

| | |
|---|---|
| **Causa** | Não há técnico ativo atendendo a unidade |
| **Diagnóstico** | Usuários → filtrar perfil Técnico; conferir a `filial` (lista de unidades). |
| **Solução** | Corrigir a `filial` do técnico ou criar um técnico para a unidade. Também dá para **encaminhar manualmente** pelo modal do chamado. |

### G7. "Aplicar agora" retorna zero encaminhados

| | |
|---|---|
| **Causas** | Nenhum chamado aberto sem responsável **nas categorias com regra ativa**. |
| **Solução** | Comportamento correto. A mensagem é explícita: `0 de N chamados abertos encaminhados.` |

### G8. Botão do card "Integrações" não muda de cor

| | |
|---|---|
| **Causa** | O teste usa `GET /dashboard/stats` (Chamados) e `GET /unidades-resumo` (SCE). Se ambos falharem com **404**, o problema é **URL errada**, não indisponibilidade — 404 é rota inexistente. |
| **Diagnóstico** | Abrir as duas rotas direto na aba. |
| **Solução** | Conferir `VITE_API_*_URL` (incluindo o `/api` no fim) e reiniciar o dev server. |

### G9. "Erro no backend" aparece mesmo com tudo funcionando

Veja [Falsos positivos no log](#falsos-positivos-no-log).

---

## H · Notificações, tutoriais e polling

### H1. O sino nunca mostra notificações

| | |
|---|---|
| **Sintoma** | "Nenhuma notificação por aqui." mesmo com chamado novo |
| **Causas (a)** | Falha de polling é **silenciosa por decisão** — se o backend estava fora do ar 30 s atrás, a lista antiga persiste.<br>**(b)** A notificação foi criada para outra filial.<br>**(c)** O filtro do backend: usuário específico **ou** filial **ou** broadcast para ADMIN. |
| **Diagnóstico** | Abrir o sino (dispara uma busca imediata). Se continuar vazio, `GET /notificacoes` direto. |
| **Solução** | Conferir a `filial` do usuário. |

### H2. Notificação com link não abre o chamado

| | |
|---|---|
| **Sintoma** | Clicar na notificação não abre o modal |
| **Causa** | O backend manda `link` no formato `/chamados/{id}`. O frontend só converte se o padrão casar; senão navega para a string crua. |
| **Diagnóstico** | Toast `Chamado não encontrado.` na tela de chamados → o id do link não existe mais (chamado excluído). |
| **Solução** | Backend deve gerar o link a partir do id real. |

### H3. Tutorial não aparece no formulário público

| | |
|---|---|
| **Sintoma** | `Tutorial não encontrado.` |
| **Causa** | Id inválido no link, ou tutorial inexistente (o endpoint público pode não filtrar por `ativa`). |
| **Diagnóstico** | `/tutorial/abc` direto. |
| **Solução** | Gerar o link de novo pelo botão "Link público". |

### H4. Excluir categoria de tutorial falha com 409

| | |
|---|---|
| **Sintoma** | Falha ao excluir |
| **Causa** | A categoria ainda tem tutoriais (FK com `Restrict`) |
| **Solução** | Mover ou excluir os tutoriais primeiro. A mensagem do backend é exibida. |

### H5. Contador de visualizações não sobe

| | |
|---|---|
| **Causa** | O incremento acontece em `GET /tutoriais/:id`, não no público. Visitar pelo link público **não** conta. |
| **Nota** | É intencional: mede uso interno. |

### H6. Polling derruba a tela

| | |
|---|---|
| **Sintoma** | A lista some a cada 30 s |
| **Causa** | O callback de polling **não está sendo silencioso** |
| **Diagnóstico** | Verificar se a função passada para `useAutoRefresh` chama `carregar(true)`. |
| **Solução** | Passar o parâmetro `silencioso = true`. |

---

## I · Frontend (build, tipos, runtime)

### I1. `npm run build` falha com erro de tipo

| | |
|---|---|
| **Sintoma** | `vue-tsc -b` falha |
| **Causa mais comum** | Regra `noUnusedLocals` / `noUnusedParameters`: variável, import ou parâmetro não usado. |
| **Solução** | Remover o que não é usado, ou prefixar com `_`. |

### I2. `Cannot find module '@/…'`

| | |
|---|---|
| **Causa** | O alias `@` está definido em **três lugares** e precisam concordar: `vite.config.ts`, `tsconfig.app.json` e o IDE. |
| **Solução** | Se o build passa mas o IDE reclama → reiniciar o servidor de linguagem do TypeScript. |

### I3. `.env` alterado não tem efeito

| | |
|---|---|
| **Causa** | Variáveis `VITE_*` são embutidas no build |
| **Solução** | Reiniciar `npm run dev`; em produção, reconstruir. |

### I4. Tela branca após o deploy

| | |
|---|---|
| **Causa (a)** | Rota não encontrada no servidor → precisa do rewrite SPA.<br>**(b)** Erro de JS no console (checa o console primeiro). |
| **Solução** | Confirmar o rewrite no `vercel.json`: tudo → `index.html`. |

### I5. Estilos quebrados depois de uma mudança de token

| | |
|---|---|
| **Causa** | Cor literal em um componente sobrepõe o token, ou `.spin` foi redeclarado |
| **Solução** | Usar o token. Se precisar de uma cor nova, **adicionar em `tokens.css`**, não no componente. |

### I6. Menu de ações "⋮" abre atrás da tabela / cortado

| | |
|---|---|
| **Causa** | Ancestral com `overflow: hidden` ou `z-index` baixo |
| **Solução** | O menu já usa `Teleport to body`. Se ainda falha, o problema é o ancestral. Em `EquipamentosView` existe um comentário explícito sobre `.table-card { overflow: visible }` para isso. |

### I7. Requisição bloqueada pelo navegador depois de um deploy

| | |
|---|---|
| **Sintoma** | No console: *"Refused to connect … violates Content Security Policy"*. Uma API, fonte ou recurso não carrega. |
| **Causa** | O `connect-src` do CSP não lista a origem da API; ou `style-src`/`font-src` não permitem a fonte; ou um `ws://` do HMR ficou de fora. |
| **Diagnóstico** | Ler o erro completo no console: ele diz **qual** diretiva e **qual** URL foi bloqueada. |
| **Solução** | Acrescentar a origem em `vercel.json` › `headers` › `Content-Security-Policy` **e** no `<meta http-equiv="Content-Security-Policy">` do `index.html`. |

> Os dois lugares precisam ficar em sincronia: o `vercel.json` vale para
> produção, e o `<meta>` cobre o dev server — que não aplica os headers da
> plataforma. Por isso o CSP está duplicado.

#### ⚠️ O caso grave: login quebrado sem mensagem na tela

| | |
|---|---|
| **Sintoma** | Clicar em "Entrar" não faz nada. Na tela, o toast *"Erro no backend Chamados: POST /auth/login (**sem resposta**)"*. O backend está no ar, o `/health` responde 200, e o login com senha errada devolve 401 normalmente quando testado direto. |
| **Causa** | O `<meta>` do `index.html` tinha `connect-src` **só com `http://localhost:*`**, enquanto o header do `vercel.json` permitia `https:`. Com duas políticas CSP, o navegador aplica **a mais restritiva** — então o `<meta>` bloqueava a API de produção. |
| **Por que é confuso** | O navegador cancela a requisição **antes de ela sair**, então não existe status nem resposta. O "sem resposta" do log de erros é a única pista na interface. |
| **Diagnóstico** | Abrir o console: `violates … connect-src` com a URL da API. Conferir se ela está no `connect-src` do **`<meta>`**, não só do `vercel.json`. |
| **Solução** | Manter `https:` no `connect-src` do `<meta>` (além dos `localhost` do dev). O `script-src 'self'` é o que realmente estreita a política. |

> **Regra:** quando o `<meta>` e o header divergirem, vale a **mais restritiva**.
> O `<meta>` é fácil de esquecer porque só se vê o header do `vercel.json` ao
> revisar a configuração de produção.

---

# Parte 3 — Diagnóstico

## Checklist de 60 segundos

Sempre comece por aqui, **na ordem**:

```
1.  O navegador dá erro de CORS?
    → Se sim, é configuração de origem. Backend não é o problema.

2.  A URL da API está correta?
    → Abrir VITE_API_CHAMADOS_URL/api/escolas/nomes  (rota pública)
    → Abrir http://localhost:3000/health               (SCE)
    → Responderam? Backend está no ar.

3.  A sessão está válida?
    → Recarregar a página: o portal se reautentica sozinho pelo cookie.
      Se voltar ao login, o cookie httpOnly não chegou ao /auth/refresh.
    → Application → Cookies: o refreshToken está presente?

4.  Configurações → Integrações → "Testar agora"
    → Diz exatamente qual dos dois backends falhou.

5.  Configurações → Logs do sistema
    → A mensagem completa do erro está aqui (clique para expandir).

6.  Só um módulo falha?
    → Equipamentos/manutenção/unidades = SCE
    → Chamados/notificações/tutoriais/usuários = backend de chamados
    → Os dois = sessão ou rede

7.  O log está vazando credencial?
    → As mensagens são **sanitizadas**: `?token=`, `access_token=`,
      `refreshToken=` e `Bearer …` viram `[redigido]`, e o texto é cortado
      em 300 caracteres. Se a credencial aparecer inteira, a sanitização
      não está rodando → clique "Limpar" no log e recarregue a página.

8.  Começou de repente?
    → Mudou algum .env? Reiniciou o backend? Girou o JWT_SECRET?
    → Alguém criou/alterou usuário? Desativou?
    → Deploy novo? O CSP pode estar bloqueando uma API ou uma fonte
      (ver [10 · deploy](./10-build-deploy-ambientes.md)).
```

## Comandos de diagnóstico

### Rede (funcionam com o backend parado)

```powershell
# Backend de chamados está no ar?
curl.exe -i http://localhost:10000/health

# Rota pública do backend de chamados
curl.exe -i http://localhost:10000/api/escolas/nomes

# SCE está no ar?
curl.exe -i http://localhost:3000/health

# Rota pública do SCE (prova acesso ao banco)
curl.exe -i http://localhost:3000/api/testar-planilha

# Rota autenticada do SCE sem token — resposta ESPERADA: 500 com
# "Sessão inválida ou expirada. Faça login novamente."
curl.exe -i http://localhost:3000/api/listas-cadastro
```

> ⚠️ O SCE **não devolve 401**. Ele devolve **500** para sessão inválida. Não
> espere 401 dele.

### Frontend

```js
// No console do navegador
document.cookie                       // NÃO mostra o refreshToken (é httpOnly) — correto
localStorage.getItem('accessToken')   // deve ser null: o token vive só em memória
localStorage.getItem('refreshToken')  // deve ser null: idem
JSON.parse(localStorage.getItem('portal.backendErrors') || '[]')   // log de erros
```

> Se `accessToken` ou `refreshToken` aparecerem no `localStorage`, é **resíduo de
> uma versão anterior à correção de segurança**. Pode apagar à vontade — o
> portal não vai mais ler esses valores.

Para inspecionar a sessão de verdade, use a aba **Application → Cookies** do
DevTools (lá o `refreshToken` aparece, porque essa visão ignora `httpOnly`) ou
consulte a tabela `RefreshToken` no banco.

### Banco (Chamados — Prisma/Postgres)

```sql
-- Existe usuário com esse e-mail e status ATIVO?
SELECT id, email, nome, nivel, filial, status, primeiroLogin
FROM "Usuario" WHERE email ILIKE '%fulano%';

-- Existe refresh token válido?
SELECT "usuarioId", "expiraEm" FROM "RefreshToken"
WHERE "usuarioId" = '<id>' AND "expiraEm" > NOW();

-- Chamados sem responsável e sem categoria (impedem encaminhamento automático)
SELECT COUNT(*) FROM "Chamado"
WHERE "responsavel" IS NULL AND status <> 'RESOLVIDO' AND "excluido" = false;

-- Chamados antigos sem e-mail (não podem ser consultados publicamente)
SELECT COUNT(*) FROM "Chamado" WHERE email IS NULL;
```

### Banco (SCE — Supabase)

```sql
-- O usuário existe lá?
SELECT email, nome, nivel, filial, status, papel_unidade
FROM usuarios WHERE email ILIKE '%fulano%';

-- Equipamentos de uma unidade
SELECT count(*) FROM equipamentos
WHERE unidade ILIKE '%adhemar%' AND status <> 'Removido';
```

### Verificar o segredo compartilhado

```powershell
# O SSO só funciona se forem IDÊNTICOS.
# Compare apenas o TAMANHO e os 4 primeiros caracteres — não imprima o segredo.
$sce = (Select-String -Path C:\Users\Pablo\Desktop\sce\.env -Pattern '^SSO_SECRET=').Line
$cha = (Select-String -Path C:\Users\Pablo\Desktop\chamados\backend\.env -Pattern '^JWT_SECRET=').Line
Write-Output "SCE  -> $($sce.Split('=')[1].Length) chars, inicio $($sce.Split('=')[1].Substring(0,4))"
Write-Output "CHAM -> $($cha.Split('=')[1].Length) chars, inicio $($cha.Split('=')[1].Substring(0,4))"
# Se o tamanho ou o início diferem → SSO quebrado.
```

## Falsos positivos no log

O log de erros registra **tudo que for 5xx ou sem resposta**. Alguns desses não
são queda de servidor:

| Entrada no log | O que realmente é |
|---|---|
| `SCE · qualquer rota · 500` com *"Sessão inválida ou expirada"* | **Sessão expirada.** O SCE não devolve 401, então vira 500. Não é queda. |
| `Chamados · POST /auth/refresh · 500` | Refresh estourando o rate limit ou erro no backend. Ver B2. |
| `SCE · POST /exportar-pdf · 500` | Escopo grande demais. Ver A4. |
| `SCE · GET /x · sem resposta` | CORS ou URL errada. Ver A2. |
| `Chamados · POST /chamados · 413` | Anexo grande. Ver D7. |
| Qualquer `· sem resposta` | CORS **ou** rede. Verificar `Network` antes de culpar o servidor. |

> **Regra:** antes de tratar uma entrada do log como "servidor caiu", leia a
> **mensagem** (clique para expandir). O status sozinho não conta a história.

## Problemas recorrentes conhecidos

Documentados aqui para não se perder tempo redescobrindo:

| # | Problema | Frequência | Onde |
|---|---|---|---|
| 1 | **JWT_SECRET e SSO_SECRET divergentes** — chamado funciona, equipamento não | Alta | E1 |
| 2 | **CORS** producing the same symptom as "server down" | Alta | A2 |
| 3 | Pergunta condicional some porque o **rótulo da opção foi renomeado** | Média | D4 |
| 4 | Regras de encaminhamento **nascem desligadas** | Média | G5 |
| 5 | SCE devolve **HTTP 200 com `success: false`** — status não indica sucesso | Alta | [06 · contratos](./06-backends-e-endpoints.md) |
| 6 | SESSÃO do SCE expira em 500, vira falso positivo no log | Média | E1 |
| 7 | Lista de equipamentos cacheada em perfil não-matriz — demora a refletir | Média | E3 |
| 8 | `.env` alterado sem reiniciar o dev server | Média | I3 |
| 9 | Dev server não sobe e trava o shell (usar `dev-restart`) | — | [10 · deploy](./10-build-deploy-ambientes.md) |
| 10 | Contagem dupla de equipamentos em unidades compartilhadas (corrigido) | Baixa | E6 |

---

# Parte 4 — Como melhorar

### Já resolvido no frontend

| Item | Onde | Efeito |
|---|---|---|
| **Access token só em memória** | `stores/auth.ts` | `localStorage` legível por script não guarda mais credencial |
| **Refresh token em cookie `httpOnly`** | `stores/auth.ts` | Credencial de 7 dias fora do alcance do JavaScript |
| **CSP + headers de segurança** | `vercel.json` + `index.html` | Bloqueia injeção de script, clickjacking e sniffing |
| **Mensagens do log sanitizadas** | `stores/errorLog.ts` | Tokens e `Bearer` redigidos; mensagem truncada em 300 chars |
| **Simulação de perfil só em dev** | `stores/auth.ts`, `ConfiguracoesView` | Não confunde autorização real com troca de interface |

### Correções de segurança que faltam (nos backends)

| Item | Onde | Impacto |
|---|---|---|
| SCE devolve **401/403** em vez de 500 para sessão/permissão | `sce/server.js` | Elimina o falso positivo nº 6 e permite o interceptor de refresh funcionar |
| SCE deve **validar propriedade do anexo** em `/anexo-url` | `sce/server.js` | Hoje qualquer usuário logado que tenha o `path` acessa o arquivo |
| CORS do SCE está aberto a qualquer origem | `sce/server.js` | Qualquer site poderia chamar a API |
| `POST /api/logout` inexistente no SCE; sessões de 24 h nunca são limpas | `sce/server.js` | Sessões órfãs acumulam |
| `GET /dashboard/matriz` é público e devolve **todos** os chamados | `chamados/backend` | Volume e privacidade |
| Token de sessão nativo do SCE aceita em `?token=` | `sce/server.js` | Vaza em log de acesso e `Referer` (a sanitização do log já redige, mas o leak continua na origem) |

### Melhorias de robustez no frontend

| Item | Onde | Ganho |
|---|---|---|
| **Categorias padrão embutidas** no `NovoChamadoView` | `views/publico/` | O formulário público continua funcionando mesmo se o backend cair |
| `?chamado=` inválido mantém o card de resultado antigo na tela | `ConsultaProtocoloView` | Confusão (veja print 08) |
| Padronizar `formatarData` local → `utils/format.ts` | 4 telas | Datas idênticas em todo o sistema |
| Tela de 403 explícita em vez de redirecionar ao painel | `router/index.ts` | Diagnóstico mais claro |
| Exportar CSV por unidade em *Relatórios* em vez de depender do SCE | `views/RelatoriosView.vue` | Remove a dependência de uma operação que falha |
| `api/usuarios.ts` — corrigir o comentário "somente ADMIN" | `api/usuarios.ts` | Não engana quem lê |

### Melhorias nos backends

| Item | Onde | Ganho |
|---|---|---|
| Detectar a ausência de `SSO_SECRET` no boot e logar aviso | `sce/server.js` | Hoje falha em silêncio |
| `clone-equipamento` sempre retorna 500 | `sce/server.js` | Endpoint morto; remover ou corrigir |
| `exportar-pdf` ignora os filtros do corpo | `sce/server.js` | Exporta o escopo inteiro |
| `listas-adicionar` quebra com item só de categoria | `sce/server.js` | Violação de `not-null` |
| Falhas parciais em empréstimo/devolução são **engolidas** e retornam sucesso | `sce/server.js` | Relatório falso de sucesso |
| `requireFilialAccess` definido e nunca usado | `chamados/backend` | Rotas sem filtro de filial |
| Protocolo usa data **UTC**, enquanto o histórico usa **America/Sao_Paulo** | `chamados/backend` | Perto da meia-noite o protocolo pode "voltar" um dia |

## O que **não** deve ser "corrigido"

| Item | Por quê |
|---|---|
| Mensagem ambígua da consulta pública (D8) | É proteção contra enumeração de protocolos. Manter. |
| Redirect silencioso em rota sem permissão (C1) | O menu já escondeu o caminho. Manter. |
| Erro de polling silencioso (H6) | Evita que uma falha momentânea apague o que o usuário está lendo. |
| Anexos de conversa expiram em 7 dias | Política de privacidade e economia de storage. |
| Toast de erro dura 6 s (não 4,5 s) | Mensagem de erro precisa de mais tempo de leitura. |

---

Ver também: [Backends e endpoints](./06-backends-e-endpoints.md) ·
[Estado, stores e composables](./07-estado-stores-composables.md) ·
[Build, deploy e ambientes](./10-build-deploy-ambientes.md)
