# 10 · Build, deploy e ambientes

## Scripts

```bash
npm install      # instala dependências
npm run dev      # vite  → http://localhost:5173
npm run build    # vue-tsc -b && vite build  → dist/
npm run preview  # serve o dist/ localmente
```

| Script | O que faz | Quando usar |
|---|---|---|
| `dev` | Servidor Vite com HMR | Desenvolvimento |
| `build` | **Checagem de tipos** (`vue-tsc`) **e** build de produção | Antes de publicar — o `vue-tsc` é a única "conferência" automática do projeto |
| `preview` | Serve o `dist/` | Testar o build antes de publicar |

> ⚠️ **Não existe `test`, `lint` nem `format`.** A qualidade é garantida pelo
> `vue-tsc` no build e por revisão manual. Se você adicionar uma dependência de
> teste, inclua o script no `package.json` **e** um comando de CI.

---

## Requisitos

| Item | Versão |
|---|---|
| Node.js | 18+ (o backend de chamados usa 22.x em produção) |
| npm | 9+ |
| Browsers | Navegadores modernos (o sistema usa `color-mix`, `dvh`, `Teleport`) |

---

## Configuração

### `.env` (local, não versionado)

```bash
# API do sistema de chamados (autenticação / chamados / usuários)
VITE_API_CHAMADOS_URL=http://localhost:10000/api

# API do SCE (equipamentos / manutenção / empréstimos)
VITE_API_SCE_URL=http://localhost:3000/api
```

```bash
cp .env.example .env     # no Windows: Copy-Item .env.example .env
```

Os dois valores **têm fallback** em `api/http.ts`, então o `.env` só é
obrigatório para apontar para outros ambientes:

```ts
import.meta.env.VITE_API_CHAMADOS_URL || 'http://localhost:10000/api'
import.meta.env.VITE_API_SCE_URL       || 'http://localhost:3000/api'
```

### ⚠️ Regras do Vite que causam confusão

| Regra | Consequência |
|---|---|
| Variáveis `VITE_*` são **embutidas no bundle em tempo de build** | Mudar o `.env` não tem efeito sem **reiniciar** `npm run dev`, e em produção exige **rebuild** |
| Tudo que começa com `VITE_` fica **público** no JavaScript do navegador | **Nunca** coloque senha, chave de API ou segredo em variável `VITE_*` |
| `import.meta.env.MODE` | `'development'` no `dev`, `'production'` no build |

---

## Desarrollo local

Você precisa dos **três** processos rodando para o sistema funcionar inteiro:

```
1. Backend de chamados   →  http://localhost:10000   (C:\Users\Pablo\Desktop\chamados\backend)
2. Backend SCE           →  http://localhost:3000    (C:\Users\Pablo\Desktop\sce)
3. Portal (este repo)    →  http://localhost:5173
```

### Subindo os backends com segurança (Windows)

⚠️ **Nunca** monte na mão um comando que deixe um processo de longa duração
"segurando" o shell do agente. `Start-Process cmd.exe -ArgumentList "/c",
"node server.js"` prende os handles e **trava a execução** mesmo depois do script
terminar.

Use sempre o script `dev-restart`, que mata o processo da porta, sobe o node
**desanexado** com stdout/stderr em arquivo, e faz health-check com timeout:

```powershell
dev-restart -Port 10000 -Dir "C:\Users\Pablo\Desktop\chamados\backend"
dev-restart -Port 3000  -Dir "C:\Users\Pablo\Desktop\sce"
dev-restart -Port 5173  -Dir "C:\Users\Pablo\Desktop\portal" -Script "npm" -Args "run","dev"
```

| Exit code | Significado |
|---|---|
| `0` | Servidor pronto — pode seguir |
| `1` | Script não encontrado — confira `-Dir`/`-Script` |
| `2` | Servidor não respondeu no timeout — **leia o tail do log**, não insista |

Regras gerais para qualquer processo em background no Windows:

- **Não** use `cmd.exe /c` como wrapper sem redirect para NUL/arquivo
- Redirecione **stdout e stderr** para arquivo
- `Start-Process <exe> -WindowStyle Hidden`
- **Nunca** espere EOF de um processo que não termina (servidor, watcher, daemon)

---

## Build de produção

```bash
npm run build
```

Gera `dist/`:

```
dist/
├── index.html
├── assets/
│   ├── index-<hash>.js       # bundle principal
│   ├── <view>-<hash>.js      # um chunk por tela (import dinâmico)
│   └── index-<hash>.css
├── logo-ure.png
└── …
```

Pontos sobre o bundle:

- **Code splitting por rota.** Cada tela é um `import()` dinâmico, então o
  primeiro carregamento baixa só o shell + a tela pedida.
- **Chart.js é registrado por componente**, não com `import 'chart.js/auto'` —
  só entram as partes usadas (`ArcElement`, `CategoryScale`, `LinearScale`,
  `Tooltip`, `Legend`).
- **Os tokens CSS vão no bundle** — o servidor não precisa de nada além dos
  arquivos estáticos.

### Verificar o build localmente

```bash
npm run build
npm run preview     # http://localhost:4173
```

---

## Deploy

### Frontend — Vercel

#### `vercel.json` — rewrite SPA

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

Esse rewrite é **obrigatório**: sem ele, abrir `/painel` direto (recarregar a
página, colar link de notificação) devolve 404 do servidor, porque o servidor
não conhece as rotas do SPA.

#### `vercel.json` — headers de segurança

O mesmo arquivo define uma política de segurança para todas as respostas:

| Header | Valor | O que previne |
|---|---|---|
| `Content-Security-Policy` | `script-src 'self'` (sem `unsafe-inline`) | Injeção de script |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing |
| `X-Frame-Options` | `DENY` | Clickjacking |
| `Referrer-Policy` | `no-referrer` | Vazamento de URL para terceiros |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Downgrade para HTTP |
| `Permissions-Policy` | câmera, microfone, geo, pagamento e USB desligados | Permissões desnecessárias |
| `Cross-Origin-Opener-Policy` | `same-origin` | Isolamento de contexto |

E as regras de cache:

| Caminho | `Cache-Control` |
|---|---|
| `/assets/(.*)` | `public, max-age=31536000, immutable` (o hash no nome já invalida) |
| `/index.html` | `no-store` (sempre pega o bundle novo) |

> ⚠️ **O CSP está duplicado de propósito.** O `vercel.json` vale para produção;
> o dev server do Vite não lê esse arquivo, então o `index.html` traz um
> `<meta http-equiv="Content-Security-Policy">` equivalente. **Ao mudar um, mude
> o outro** — ver [Erros · I7](./09-tratamento-de-erros.md).

#### Configuração da plataforma

| Configuração | Valor |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Variáveis de ambiente | `VITE_API_CHAMADOS_URL`, `VITE_API_SCE_URL` (produção) |

### Backends

| Serviço | Deploy | Health check |
|---|---|---|
| Chamados | Render (`render.yaml`) ou Cloud Run | `GET /health` |
| SCE | Render ou Cloud Run | `GET /health` |

Detalhes de cada backend estão nos repositórios `chamados/` e `sce/`
(`render.yaml`, `Dockerfile`, pastas `deploy/`).

### Ordem de deploy recomendada

```
1. Backend de chamados   (é quem emite o token — se ele cai, tudo cai)
2. SCE                   (aceita o token; pode ficar para depois)
3. Frontend              (precisa das URLs novas já no ambiente)
```

> ⚠️ **Cuidado ao rotacionar segredos.** Trocar o `JWT_SECRET` do backend de
> chamados **invalida todos os tokens já emitidos** e, se o `SSO_SECRET` do SCE
> não for trocado junto, **quebra o SSO silenciosamente** (todo o módulo de
> equipamentos começa a falhar). Ver [Tratamento de erros · E1](./09-tratamento-de-erros.md).

---

## Ambientes

| | Local | Produção |
|---|---|---|
| Frontend | `localhost:5173` | Vercel |
| Chamados | `localhost:10000` | Render / Cloud Run |
| SCE | `localhost:3000` | Render / Cloud Run |
| Banco (Chamados) | Postgres local / Supabase | Supabase |
| Banco (SCE) | Supabase | Supabase |

O portal **não sabe em qual ambiente está** — ele só lê as duas URLs. Isso
significa que "funciona em dev" e "funciona em produção" dependem inteiramente
das variáveis estarem corretas na plataforma de deploy.

---

## Checklist de publicação

```bash
npm run build          # 1. build (inclui vue-tsc) sem erros?
```

- [ ] `npm run build` passou sem erro de tipo
- [ ] `npm run preview` — navegou pelas telas principais
- [ ] Login funciona e o menu muda conforme o perfil
- [ ] Equipamentos carregam (prova que o **SSO** está funcionando)
- [ ] `/chamado/novo` abre e lista as categorias (prova a rota pública)
- [ ] `/matriz` mostra os KPIs (prova o dashboard público)
- [ ] Configurações → **Integrações → "Testar agora"** mostra os 3 cartões verdes
- [ ] Configurações → **Logs do sistema** está vazio (nenhum erro novo)
- [ ] Abriu uma rota interna direto pela URL (prova o rewrite SPA)
- [ ] `VITE_API_*_URL` de produção está no painel da plataforma
- [ ] Se mexeu em segredo: `SSO_SECRET` e `JWT_SECRET` continuam **idênticos**

---

## Onde ficam os logs

| Serviço | Onde |
|---|---|
| Portal (dev) | Terminal do `npm run dev` |
| Portal (produção) | Console do navegador; o `errorLog` local fica em `localStorage` |
| Backend de chamados | `render.yaml` → web service; ou o arquivo de log do `dev-restart` |
| SCE | Idem — `dev-restart` grava em arquivo |

**Erros do frontend nunca vão para um servidor.** Eles ficam em
`localStorage['portal.backendErrors']`, visíveis em Configurações → Logs. As
mensagens são **sanitizadas** antes de gravar (tokens e `Bearer …` redigidos,
texto cortado em 300 caracteres). Para coletar de vários usuários seria preciso
enviar para algum lugar — hoje não existe esse envio (ver
[Tratamento de erros · Parte 4](./09-tratamento-de-erros.md)).

> **Cuidado com o CSP ao abrir chamado técnico.** Se alguém relata que "algo não
> carrega depois do deploy", o primeiro suspeito é o `Content-Security-Policy` —
> ele pode estar bloqueando a API ou uma fonte. O console do navegador diz
> exatamente qual diretiva e qual URL.

---

Ver também: [Arquitetura](./02-arquitetura.md) ·
[Tratamento de erros](./09-tratamento-de-erros.md) ·
[Manutenção e checklists](./11-manutencao-e-checklists.md)
