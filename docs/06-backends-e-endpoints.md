# 06 · Backends e endpoints

Este capítulo documenta **do ponto de vista do frontend** os dois backends e
todos os endpoints consumidos. Para o detalhe interno dos backends (schema,
middleware, deploy), veja os repositórios `chamados/` e `sce/`.

---

## Configuração

```bash
# .env  (use .env.example como modelo)
VITE_API_CHAMADOS_URL=http://localhost:10000/api
VITE_API_SCE_URL=http://localhost:3000/api
```

Cada variável tem um fallback embutido em `api/http.ts`, então o `.env` só é
obrigatório para apontar para outros ambientes:

```ts
export const CHAMADOS_BASE = import.meta.env.VITE_API_CHAMADOS_URL || 'http://localhost:10000/api'
export const SCE_BASE       = import.meta.env.VITE_API_SCE_URL       || 'http://localhost:3000/api'
```

> ⚠️ **Variáveis do Vite só são lidas no build.** Mudar o `.env` exige reiniciar
> `npm run dev`; em produção, reconstruir. Não há troca em runtime.

---

## Os três clientes HTTP

### `chamadosApi` — autenticado, com identidade

```ts
axios.create({
  baseURL: CHAMADOS_BASE,
  withCredentials: true,                          // cookie de refresh
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})
```

Interceptors, **nesta ordem**:

1. `request` → anexa `Authorization: Bearer {accessToken}` quando houver token
2. `response` → **refresh** (401 → renova o token e repete a requisição)
3. `response` → **log de erro de backend** (5xx ou sem resposta)

### `sceApi` — autenticado, mesmo token, contrato diferente

```ts
axios.create({
  baseURL: SCE_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})
```

Sem `withCredentials` (o SCE não usa cookie). **Mesmos três interceptors**, com o
mesmo token.

### `publicoHttp` — sem token, para endpoints abertos

```ts
axios.create({ baseURL: CHAMADOS_BASE, headers: {...}, timeout: 30000 })
```

Existe separado **de propósito**: sem token e **sem** o interceptor de refresh.
As rotas públicas não devem disparar refresh de sessão — se uma delas tomasse
401, o certo é mostrar o erro, não tentar renovar o token. Tem apenas o
interceptor de log de erro, então falhas de backend em página pública também
aparecem no log do ADMIN.

---

## Os dois contratos de resposta

Esta é a diferença mais importante entre os backends e a principal fonte de
confusão ao escrever uma função de API nova.

### Backend de chamados — códigos HTTP reais

```jsonc
// sucesso
{ "protocolo": "CH-20260929-0006", "status": "ABERTO", … }

// erro de validação
{ "error": "VALIDATION_ERROR", "message": "Dados inválidos",
  "details": { "email": ["Informe um e-mail válido"] } }
```

Códigos usados: `400` (validação), `401` (não autenticado / token expirado),
`403` (sem permissão), `404` (não encontrado), `409` (conflito — já avaliado,
categoria duplicada), `422` (regras de negócio — não há técnico atendendo a
unidade).

### SCE — HTTP 200 com `success: false`

```jsonc
{ "success": true,  "data": …,   "error": null }
{ "success": false, "data": null, "error": "Sessão inválida ou expirada. Faça login novamente." }
```

> ⚠️ **Consequência prática:** no SCE, **HTTP 200 não significa sucesso**. É
> obrigatório checar `success`. O frontend faz isso num único lugar:

```ts
// src/api/sce.ts
async function unwrap<T>(promise: Promise<AxiosResponse<SceResponse<T>>>): Promise<T> {
  const { data } = await promise
  if (!data.success) throw new Error(data.error || 'Erro na API do SCE')
  return data.data
}
```

Duas consequências que afetam o tratamento de erro:

1. **Erro do SCE chega como `Error` comum**, não como `AxiosError`. Por isso
   `apiError()` do backend de chamados não funciona bem com ele.
2. **Falha de sessão do SCE também é HTTP 500** (não 401). Isso significa que
   uma sessão expirada no SCE aparece no *log de erros de backend* como se fosse
   uma queda do servidor — falso positivo. Ver
   [Tratamento de erros](./09-tratamento-de-erros.md#falsos-positivos-no-log).

---

## Endpoint por endpoint (o que o portal consome)

### 🔵 Backend de chamados — `chamadosApi`

#### Autenticação

| Método | Rota | Uso na tela |
|---|---|---|
| POST | `/auth/login` | `stores/auth.ts` › `login()` |
| POST | `/auth/refresh` | `stores/auth.ts` › `refreshTokens()` |
| POST | `/auth/logout` | menu do usuário › "Sair" |
| GET | `/auth/me` | `initialize()` ao recarregar a página |
| POST | `/auth/change-password` | `TrocarSenhaView` |
| POST | `/auth/admin/gerar-senha-temporaria` | `UsuariosView` (só ADMIN) |

#### Chamados

| Método | Rota | Quem chama |
|---|---|---|
| GET | `/chamados` | `ChamadosView`, `PainelView`, `RelatoriosView` |
| GET | `/chamados/:id` | modal de detalhe, deep link `?chamado=` |
| PATCH | `/chamados/:id/status` | "Alterar status" |
| POST | `/chamados/:id/resposta` | "Responder chamado" (escola) |
| PATCH | `/chamados/batch` | "Aplicar em lote" (matriz) |
| DELETE | `/chamados/:id` | "Excluir" (só ADMIN no backend) |
| GET | `/chamados/encaminhar/tecnicos` | select de destino |
| GET | `/chamados/encaminhar/tecnicos/:id` | opções que atendem a unidade |
| POST | `/chamados/:id/encaminhar` | "Encaminhar para técnico" |
| GET | `/dashboard/stats` | KPIs de `ChamadosView` e aba Integrações |

> `/chamados` aceita `page`, `limit`, `unidade`, `categoria`, `status` e
> `urgencia`. **Filtros vazios são removidos antes do envio** — o backend rejeita
> `''` em enums.

#### Usuários, escolas, inventário

| Método | Rota | Quem chama |
|---|---|---|
| GET | `/usuarios` | `UsuariosView` |
| POST | `/usuarios` | "Novo usuário" |
| PATCH | `/usuarios/:id` | "Editar" |
| DELETE | `/usuarios/:id` | "Desativar" (soft delete) |
| GET | `/escolas/nomes` | selects de escola (com 2 fallbacks) |
| GET | `/escolas/painel` | `UnidadesView` |
| GET | `/inventario` · PATCH `/inventario/:escolaId` | (não consumido hoje) |

> **Fallback de lista de escolas.** `listarEscolas()` tenta, nesta ordem:
> `/escolas/nomes` → `/escolas/nomes-padronizados` → `/escolas`. Aceita tanto
> `["E.E. X"]` quanto `[{ nome: "E.E. X" }]`. Se todas falharem, devolve `[]` —
> e a tela mostra "Não foi possível carregar a lista de unidades" em vez de um
> select silenciosamente vazio.

#### Notificações

| Método | Rota | Quem chama |
|---|---|---|
| GET | `/notificacoes` | sino da topbar (a cada 30 s) |
| POST | `/notificacoes/:id/lida` | clicar numa notificação |
| POST | `/notificacoes/ler-todas` | "Marcar todas como lidas" |

A notificação traz um `link` no formato `/chamados/{id}`. O frontend converte
para rota da SPA (`{ name: 'chamados', query: { chamado: id } }`) e abre o modal
direto.

#### Formulário de chamados

| Método | Rota | Quem chama |
|---|---|---|
| GET | `/formulario/categorias` | aba "Formulário de chamados" |
| POST/PATCH/DELETE | `/formulario/categorias[/:id]` | editar/excluir categoria |
| POST/PATCH/DELETE | `/formulario/perguntas[/:id]` | editar/excluir pergunta |

#### Tutoriais

| Método | Rota | Quem chama |
|---|---|---|
| GET | `/tutoriais` | grade de tutoriais (paginado, busca, categoria) |
| GET | `/tutoriais/:id` | detalhe (incrementa visualizações) |
| POST/PATCH/DELETE | `/tutoriais[/:id]` | CRUD (ADMIN) |
| GET | `/tutoriais/categorias` | chips de filtro + "Gerenciar categorias" |
| POST/PATCH/DELETE | `/tutoriais/categorias[/:id]` | CRUD de categorias (ADMIN) |

#### Encaminhamento automático *(ADMIN)*

| Método | Rota | Quem chama |
|---|---|---|
| GET | `/encaminhamentos` | aba "Encaminhamento" (regras + categorias + técnicos) |
| PUT | `/encaminhamentos` | "Salvar" destino (upsert por categoria) |
| PATCH | `/encaminhamentos/:id` | switch Ativo/Inativo |
| DELETE | `/encaminhamentos/:id` | "Remover regra" |
| POST | `/encaminhamentos/aplicar` | "Aplicar agora aos abertos" |

#### Feedback autenticado

| Método | Rota | Quem chama |
|---|---|---|
| GET | `/feedback` | `FeedbackView` (ADMIN/TÉCNICO) |
| GET | `/feedback/stats` | `FeedbackView` + card do `PainelView` |
| GET | `/feedback/avaliacoes` | `FeedbackView` — notas **com comentário** |

---

### 🟢 SCE — `sceApi`

| Método | Rota | Quem chama | Observação |
|---|---|---|---|
| GET | `/equipamentos-global` | `useEquipamentos` (ADMIN) | Pagina e agrega no servidor |
| GET | `/equipamentos-da-filial` | `useEquipamentos` (outros) | Devolve o escopo inteiro; filtro é local |
| GET | `/unidades-resumo` | `UnidadesView`, modal de equipamento, aba Integrações | Falha aqui **não** quebra a tela — cai para zeros |
| GET | `/listas-cadastro` | "Modelos cadastrados" no painel, aba Catálogo | — |
| GET | `/catalogo-equipamentos` | `EquipamentoFormModal` | Lista maior (listas + o que existe em campo) |
| GET | `/historico-equipamento?equipamentoId=` | modal de detalhe | — |
| GET | `/exportar-csv` | botão "CSV" | Retorna `{ csv, fileName }` em **JSON** |
| POST | `/exportar-pdf` | botão "PDF" | Retorna **PDF bruto** (`responseType: 'blob'`) |
| POST | `/create-equipamento` | modal de cadastro | — |
| POST | `/update-equipamento` | modal de edição | — |
| POST | `/remover-equipamento` | "Remover" | Soft delete (`status = 'Removido'`) |
| GET | `/filiais-para-emprestimo` | selects de unidade | — |
| POST | `/listas-adicionar` | aba Catálogo | — |
| POST | `/listas-remover` | aba Catálogo | — |
| GET | `/auditoria?limite=` | aba "Logs do sistema" | — |

**Endpoints do SCE que o portal ainda não consome** (disponíveis se precisar):
`/registros-manutencao`, `/registrar-manutencao`, `/atualizar-status-manutencao`,
`registrar-emprestimo`, `/registrar-devolucao`, `/anexo-url`,
`/especificacoes-modelo`, `/tecnico-unidades`, `/listar-usuarios`.

---

### 🟡 Rotas públicas — `publicoHttp` (sem token)

| Método | Rota | Quem chama |
|---|---|---|
| GET | `/formulario/publico` | `NovoChamadoView` (boot) |
| GET | `/escolas/nomes` | selects de escola do formulário e dos elogios |
| GET | `/equipamentos/categorias` | cascata de equipamento |
| GET | `/equipamentos/marcas?categoria=` | cascata de equipamento |
| GET | `/equipamentos/modelos?categoria=&marca=` | cascata de equipamento |
| POST | `/chamados` | envio do chamado |
| GET | `/chamados/protocolo/:protocolo?email=` | consulta |
| POST | `/chamados/protocolo/:protocolo/avaliar?email=` | avaliação 1–5 |
| GET | `/dashboard/matriz` | `/matriz` e `/dirigente` |
| GET | `/tutoriais/publico/:id` | tutorial público |
| POST | `/feedback` | `/elogios` |

> `/dashboard/matriz` **não exige autenticação** no backend. Ele devolve a lista
> de todos os chamados não excluídos. As telas públicas mostram apenas os 10
> mais recentes, mas a resposta completa trafega. Se um dia isso for um problema
> (volume, privacidade), o caminho é criar um `/dashboard/publico` com resumo
> agregado e sem a lista — o frontend precisaria de uma função nova em
> `api/publico.ts` e nada mais.

---

## Anexos

| Sistema | Limite | Onde fica | Validade |
|---|---|---|---|
| Chamados — abertura de chamado | 25 MB (body) | Supabase Storage, bucket `anexos` | Permanente |
| Chamados — pergunta/resposta | 5 MB por arquivo, 5 arquivos | mesmo bucket | **7 dias** |
| SCE — boletim de ocorrência | 8 MB (limite do servidor), 10 MB (body) | mesmo bucket | Permanente |

O frontend converte o arquivo com `FileReader.readAsDataURL` e envia **só a parte
base64** (sem o prefixo `data:…;base64,`):

```ts
const base64 = String(reader.result).split(',')[1]
```

A validação de tamanho acontece **no cliente** antes do envio, com mensagens
próprias — inclusive no caso do anexo ser obrigatório:

| Onde | Limite | Mensagem |
|---|---|---|
| `NovoChamadoView` | 10 MB | `Arquivo muito grande. O tamanho máximo é 10 MB.` |
| `ChamadosView` | 5 MB / arquivo | `"<nome>" é muito grande. O tamanho máximo é 5 MB.` |
| `ChamadosView` | 5 arquivos | `Máximo de 5 anexos por mensagem.` |

---

## Sincronização de usuário entre os backends

Um usuário do portal precisa existir **nos dois** sistemas. Quando o backend de
chamados cria, altera ou desativa um usuário, ele chama
`POST /api/internal/sync-usuario` no SCE com o segredo compartilhado
(`x-sync-key`), que:

- cria/atualiza o registro na tabela `usuarios` do SCE;
- grava `nivel`, `filial`, `status` e **`papelUnidade`** (`MAE`/`FILHA`).

Se o SCE estiver fora do ar, o `sync` falha e a **criação do usuário no portal
continua funcionando** — mas o usuário não conseguirá ver equipamentos até o SCE
voltar. Esse é um dos cenários que os [logs de integração](./09-tratamento-de-erros.md)
ajudam a diagnosticar.

---

## Timeouts e o que significam

Ambos os clientes usam **30 segundos**. Na prática:

| Situação | O que o usuário vê |
|---|---|
| Backend lento mas respondendo em < 30 s | Nada — apenas demora |
| Backend travado | `ECONNABORTED` após 30 s → erro de backend no log + toast |
| Backend fora do ar | `ERR_NETWORK` imediato → erro de backend no log + toast |
| CORS bloqueado | `ERR_NETWORK` imediato → **erro de backend no log**, mesmo com o backend no ar |

> ⚠️ **O caso do CORS é o mais enganoso.** O navegador reporta erro de rede,
> idêntico a "servidor desligado", mas o servidor está saudável. Antes de culpar
> o backend, verifique se a URL da `.env` está correta e se o backend aceita a
> origem do portal.

---

Ver também: [Arquitetura](./02-arquitetura.md) ·
[Tratamento de erros](./09-tratamento-de-erros.md) ·
[Build, deploy e ambientes](./10-build-deploy-ambientes.md)
