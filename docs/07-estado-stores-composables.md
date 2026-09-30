# 07 · Estado, stores e composables

## Visão geral

| Camada | Arquivo | Escopo | Persiste? |
|---|---|---|---|
| Store | `stores/auth.ts` | `accessToken` + usuário (memória) | ❌ — reconstruída pelo cookie a cada F5 |
| Store | `stores/ui.ts` | Toasts | não |
| Store | `stores/errorLog.ts` | Log de erros de backend | ✅ `localStorage` (com sanitização) |
| Composable | `useAutoRefresh` | Polling | — |
| Composable | `useSidebar` | Drawer mobile | não |
| Composable | `useEquipamentos` | Lista/filtros/gráficos de equipamento | não |

> **Único dado de sessão que sobrevive ao F5 é o cookie `httpOnly` do
> refresh token** — e o JavaScript não tem acesso a ele. Tudo o mais que
> precisa ser lembrado entre navegações está em memória.

**Não existe store "de tela".** Filtros, paginação, modais e campos de
formulário vivem como `ref`/`reactive` dentro da própria view. Isso vale mesmo
para telas parecidas: `/equipamentos` e `/manutencao` repetem parte do código por
`useEquipamentos` em vez de criar uma store compartilhada.

---

## `stores/auth.ts` — sessão

### Estado

```ts
user: Ref<User | null>
accessToken: Ref<string | null>        // ⚠️ SÓ EM MEMÓRIA
isLoading, isInitialized: Ref<boolean>

// computeds
isAuthenticated              = !!accessToken
isAdmin                      = user.nivel === 'ADMIN'
mustChangePassword           = user.primeiroLogin === true
somenteLeituraEquipamentos   = user.papelUnidade === 'FILHA'
simulacaoAtivavel            = import.meta.env.DEV
```

> **Por que o `accessToken` não vai para o `localStorage`.** Ele ficava lá
> antes. O `localStorage` é legível por qualquer script da página: uma única
> dependência comprometida — ou um XSS — dava acesso direto à sessão. Agora ele
> vive só na memória, e o `refreshToken` de 7 dias viaja num cookie `httpOnly`
> que o JavaScript não alcança. O preço é que um F5 descarta o token; a sessão é
> reconstruída na sequência por `/auth/refresh`.

### Ações

| Ação | Efeito |
|---|---|
| `initialize()` | Registra os hooks no `api/http.ts` e chama `refreshTokens()` para reconstruir a sessão a partir do cookie. Só depois chama `/auth/me` para revalidar. Marca `isInitialized` (roda uma vez). |
| `login(credenciais)` | `POST /auth/login` → guarda o `accessToken` e o usuário em memória. O refresh token vem no `Set-Cookie`. |
| `refreshTokens()` | `POST /auth/refresh` com **corpo vazio** → renova o token, atualiza o usuário **mantendo a simulação ativa**. Qualquer falha chama `clearSession()`. |
| `fetchMe()` | `GET /auth/me` |
| `changePassword(payload)` | Muda a senha e **limpa a sessão** (todas as sessões caem no backend) |
| `logout()` | `POST /auth/logout` (o servidor limpa o cookie) e depois `clearSession()`. Falha de rede é ignorada de propósito. |
| `simularComo(nivel)` | Troca só `user.nivel` em memória. **No-op em produção.** |
| `pararSimulacao()` | Devolve o nível real |

### `clearSession()`

Limpa `accessToken`, `user`, `simulacao` e `nivelOriginal` da memória. **Não
toca em `localStorage`** — não há mais nada de sessão lá. Chamada em quatro
situações: refresh recusado, falha no refresh (401/403), `/auth/me` recusado no
boot, e logout/troca de senha bem-sucedidos.

### Simulação de perfil

```ts
const simulacaoAtivavel = import.meta.env.DEV   // ← bloqueia em produção

function simularComo(nivel: Nivel) {
  if (!user.value || !simulacaoAtivavel) return   // no-op se não for dev
  if (nivelOriginal.value === null) nivelOriginal.value = user.value.nivel
  simulacao.value = nivel
  // só o nível muda — a escola (MÃE/FILHA) continua real
  user.value = { ...user.value, nivel }
}
```

A mesma flag controla a aba em `ConfiguracoesView`: a lista de abas é montada
condicionalmente, então **"Testes de acesso" não aparece no build de produção**.

Ao passar por um refresh de token, a simulação é reaplicada e o `nivelOriginal`
é atualizado com o nível real que veio do backend — caso contrário a simulação
"voltaria" sozinha no meio de uma sessão longa.

### Ligação com `api/http.ts`

`auth` e `http` precisam um do outro, mas não podem se importar. A store registra
os hooks no `initialize()`:

```ts
configureAuthHooks({
  getToken:       () => accessToken.value,
  refresh:        refreshTokens,
  onUnauthorized: () => clearSession(),
})
```

É por isso que `http.ts` funciona mesmo antes da store ser usada: o padrão
devolve `null` — **não há token para ler de disco**.

---

## `stores/ui.ts` — toasts

```ts
success(mensagem)   // 4,5 s
error(mensagem)     // 6 s  ← mais tempo, porque mensagens de erro precisam ser lidas
info(mensagem)      // 4,5 s
push(kind, msg, ms) // controle fino
dismiss(id)         // fechar manualmente (botão ✕)
```

Os toasts saem no canto **superior direito**, empilhados, com `TransitionGroup`.
`error` tem borda esquerda vermelha e ícone `XCircle`; `success` verde com
`CheckCircle2`; `info` azul com `Info`.

`nextId` é um contador de módulo (não um ref), então dois `push` no mesmo tick
não colidem.

**Quando usar toast e quando não:**

| Situação | Escolha |
|---|---|
| Ação pontual que deu certo | ✅ toast |
| Erro de uma ação (salvar, excluir, exportar) | ✅ toast |
| Falha ao carregar **a página inteira** | ❌ banner no corpo (`p.erro.card`) |
| Erro de um campo de formulário | ❌ mensagem abaixo do campo |
| Erro de polling | ❌ silencioso |

A regra: **toast para ação, banner para estado da tela**. Se a tela inteira
falhou ao carregar, um toast que some depois de 6 s deixa o usuário sem saber
o que fazer.

---

## `stores/errorLog.ts` — log de erros de backend

O único estado do sistema que existe **para ser inspecionado depois**.

### O que entra

Só entram **erros de backend**: HTTP 5xx ou ausência de resposta. Um 404 ou 422
— que são respostas normais de uma API bem funcionando — **não** entram.

### Estrutura de uma entrada

```ts
interface ErroBackend {
  id: number
  data: string        // ISO
  backend: string     // 'Chamados' | 'SCE'
  metodo: string      // 'GET', 'POST', …
  rota: string        // '/chamados'
  status: number | null   // null = sem resposta (rede/timeout)
  mensagem: string
  repeticoes: number      // ocorrências seguidas da mesma assinatura
}
```

### Agrupamento por assinatura

A assinatura é `backend | método | rota | status`. Se a **entrada mais
recente** tem a mesma assinatura, o sistema **incrementa o contador** em vez de
criar uma linha nova, e atualiza a data e a mensagem.

Por que só a mais recente? Porque se o erro A vem, depois B, depois A de novo,
a terceira é um problema diferente da primeira. Agrupar sempre produziria uma
linha "escrita por cima" sem sentido.

### Cooldown de toast

Uma falha que se repete a cada 30 s (o polling do sino, por exemplo) geraria um
toast a cada 30 s — o que é incômodo. O sistema guarda o último toast por
assinatura e **só repete depois de 60 segundos**.

```
Erro no backend Chamados: GET /notificacoes (HTTP 500)
```

### Persistência, limite e sanitização

- Chave: `localStorage['portal.backendErrors']`
- Máximo: **100 entradas** (as mais recentes)
- Falha ao escrever (storage cheio, modo privado) é **ignorada** — o log em
  memória continua funcionando

**A mensagem é sanitizada antes de qualquer coisa.** O log vive no
`localStorage`, que é legível por qualquer script da página, e a mensagem vem do
corpo da resposta do backend — pode carregar id de chamado, nome de arquivo,
trecho de e-mail e, historicamente, credenciais que o SCE ecoava na URL. Então:

```ts
const MAX_MENSAGEM = 300

function sanitizarMensagem(mensagem: string): string {
  return String(mensagem || '')
    .replace(/([?&](?:token|access_token|refreshToken)=)[^&\s"']+/gi, '$1[redigido]')
    .replace(/Bearer\s+[\w.-]+/gi, 'Bearer [redigido]')
    .slice(0, MAX_MENSAGEM)
}
```

- Tokens na query string viram `?token=[redigido]`
- Cabeçalhos `Bearer …` viram `Bearer [redigido]`
- A mensagem é cortada em 300 caracteres

**E o que já estava gravado também é limpo:** `carregarPersistidos()` re-roda a
sanitização sobre as entradas vindas do `localStorage`, porque podem ter sido
escritas por uma versão anterior, sem truncagem nem redação.

### API

```ts
registrar({ backend, metodo, rota, status, mensagem })  // chamada pelo interceptor
limpar()                                                 // botão "Limpar"
total                                                    // badge da aba
erros                                                    // lista
```

Onde o ADMIN vê isso: **Configurações → Logs do sistema**.

---

## `composables/useAutoRefresh.ts` — polling

```ts
export const AUTO_REFRESH_MS = {
  rapido: 30_000,   // chamados, equipamentos, consulta, painel geral
  normal: 60_000,   // painel, manutenção, feedback, dirigente
} as const

useAutoRefresh(atualizar, intervaloMs)
```

### Garantias

| Garantia | Implementação |
|---|---|
| Pausa com a aba oculta | `if (document.hidden) return` no início do tick |
| Atualiza ao voltar para a aba | listener de `visibilitychange` dispara um tick imediato |
| Não sobrepõe execuções | flag local `executando` |
| Limpa ao sair da tela | `clearInterval` + `removeEventListener` no `onUnmounted` |

### O contrato do callback

O callback **precisa ser silencioso**. Na prática:

```ts
async function carregar(silencioso = false) {
  if (!silencioso) { loading.value = true; erro.value = '' }
  try {
    await listarChamados(filtros)
  } catch (e) {
    if (silencioso) return          // ← mantém os dados anteriores na tela
    estado.erro = 'Não foi possível carregar os chamados.'
  } finally {
    loading.value = false
  }
}

useAutoRefresh(() => carregar(true), AUTO_REFRESH_MS.rapido)  // true = silencioso
```

Sem isso, uma falha momentânea de rede piscaria a tela e apagaria a lista que o
usuário estava lendo — a cada 30 segundos.

### Os dois timers que não usam o composable

| Timer | Onde | Por quê |
|---|---|---|
| Sino de notificações | `AppTopbar` | 30 s, mas a falha é **totalmente silenciosa** — "a topbar não pode quebrar por causa do sino" |
| Relógio | `AppTopbar` | `setTimeout` realinhado na virada do minuto, não `setInterval` de 1 s |

---

## `composables/useSidebar.ts` — drawer mobile

Singleton em escopo de módulo (não é store Pinia):

```ts
const menuAberto = ref(false)   // compartilhado por todos os consumidores
```

`iniciarScrollGuard()` é **idempotente** (flag de módulo): trava o scroll do
body enquanto o drawer está aberto e destrava ao fechar. `liberarScroll()` é
chamado no `onUnmounted` do `AppShell` como rede de segurança.

---

## `composables/useEquipamentos.ts` — fonte de dados

O composable mais especial. Ele tem **duas estratégias** conforme o perfil:

```ts
const isGlobal = computed(() => auth.user?.nivel === 'ADMIN')
```

| | ADMIN (Matriz) | TECNICO / GESTOR / VISUALIZADOR |
|---|---|---|
| Endpoint | `/equipamentos-global` | `/equipamentos-da-filial` |
| Paginação | **no servidor** | **no navegador** |
| Filtros | **no servidor** | **no navegador** |
| Agregados | **no servidor** (`stats`, inclui `porModelo`) | recalculados a cada filtro (`agregar()`) |
| Requisições | uma por página/filtro | uma só, cacheada |

```ts
state: { loading, erro, page, items, total, porStatus, porCategoria, porUnidade,
         porModelo, todosCache, cacheCarregado }
filtros: { busca, unidade, categoria, status }
```

### Cache no modo filial

`carregarLocal()` baixa **todo** o escopo uma vez (`todosCache`) e filtra local.
Com o `silencioso = true` do polling, ele **força a recarga do cache** — senão um
equipamento cadastrado diretamente no SCE nunca apareceria na tela.

### Drilldown por categoria

O clique numa barra do gráfico **não faz requisição**: os modelos saem de
`state.porModelo`, que já veio na mesma resposta da tela (`stats.porModelo` na
Matriz, `agregar()` nos demais perfis). É exato por construção — a soma dos
modelos sempre fecha com o total da categoria — e não existe corrida entre
cliques, porque é um retrato só do estado (clicar Notebook e depois Tablet não
deixa a resposta antiga aparecer sob o título novo).

NÃO voltar a contar modelo no cliente sobre a página do `/equipamentos-global`:
o SCE corta `limite` em 500 e pagina por `modelo`, coluna que se repete milhares
de vezes, então o mesmo equipamento volta em duas páginas e outros nunca
aparecem (Notebook com 2.847 itens viravam 2.554 linhas — o gráfico mostrava só
"Chromebook 500").

### Agregados

`agregar()` recalcula `porStatus`, `porCategoria`, `porUnidade` e `porModelo` a
partir da lista filtrada — e `resumirStatus()` (em `api/sce.ts`) transforma o mapa
de status nos cinco números que o painel mostra, classificando por substring:

```ts
if (s === 'disponível')        → disponiveis
else if (s.includes('manuten')) → emManutencao
else if (s.includes('quebrad')) → quebrados
else if (s.includes('extrav'))  → extraviados
```

> A classificação é por **substring** em minúsculas, justamente porque os dois
> backends nem sempre grafam igual (`"Disponível"` vs `"Disponivel"` vs
> `"disponível"`). Quem **cria** um status novo precisa lembrar que a palavra-chave
> (`manuten`, `quebrad`, `extrav`, `dispon`) é o que faz o painel contar
> corretamente.

---

## `utils/`

### `format.ts`

```ts
formatDate(iso)       // dd/mm/aaaa
formatDateTime(iso)   // dd/mm/aaaa hh:mm
```

Ambos fixam `timeZone: 'America/Sao_Paulo'` — **sem isso**, um usuário fora do
fuso veria datas deslocadas. Retornam `'—'` para entrada vazia ou inválida, e
**nunca lançam**.

> ⚠️ Algumas telas públicas (`ConsultaProtocoloView`, `FeedbackView`,
> `DashboardPublicoView`) definem um `formatarData` **local** com
> `toLocaleString` sem `timeZone`. Isso é uma inconsistência real: as duas
> funções mostram a mesma data de formas diferentes se o navegador estiver em
> outro fuso. Ao padronizar, use sempre `utils/format.ts`.

### `apiError.ts`

```ts
apiError(e, fallback?) → string
```

Traduz um `AxiosError` em uma frase utilizável:

| Corpo da resposta | Resultado |
|---|---|
| `{ message }` | a mensagem |
| `{ message, details: { email: [...] } }` | `"msg — email: erro1, erro2"` |
| sem resposta (rede) | `e.message` do axios (`Network Error`) |
| nada | o `fallback` informado |

É usado pelas telas que querem mostrar o erro do backend **em vez** de uma
mensagem genérica — principalmente em mutações (salvar, excluir, criar).

### `escola.ts`

Casamento de nomes de escola entre os dois sistemas, que escreveram diferente:

```
SCE:      "Adhemar Antonio Prado Prof"
Chamados: "E.E. ADHEMAR ANTONIO PRADO"
```

Estratégia em três passes:

1. **Chave exata** — caixa alta, sem acento, sem prefixo `E.E.`
2. **Chave sem honoríficos** — remove `PROF`, `PROFA`, `DR`, `DRA`, `DEPUTADO`,
   `DEPUTADA`, `PRESIDENTE`, `MAESTRO` do final
3. **Prefixo em qualquer direção** — um nome começa com o outro

Se nenhum passe casa, devolve `null` e a tela usa o nome original.

> **Onde isso importa:** `UnidadesView` cruza as duas listas para juntar dados de
> escola (Chamados) com o resumo de equipamentos (SCE). Escolas não
> catalogadas são **descartadas** — é por isso que unidades sem equivalente no
> SCE aparecem com zeros.

---

Ver também: [Arquitetura](./02-arquitetura.md) ·
[Componentes e design system](./08-componentes-e-design-system.md) ·
[Tratamento de erros](./09-tratamento-de-erros.md)
