# Monitor de rede

Serviço que faz **ping** (ICMP) nos endereços da rede privada e responde
**online / offline** para a aba *Monitoramento* do
[Portal URE Leste 3](../README.md).

O navegador não envia ICMP — só HTTP. Por isso existe esta máquina: ela está
**na mesma rede** dos endereços monitorados, faz o ping de verdade e publica o
resultado como API.

```
Portal (Vercel)  ──HTTPS──▶  Cloudflare Tunnel  ──▶  http://127.0.0.1:4000  ──ICMP/TCP──▶  10.20.x.x
   (navegador)                 (termina o TLS)          (este serviço)
```

Zero dependências (`npm install` não é necessário), zero custo, e o portal
continua consumindo tudo por API — sem `iframe`, como pedido.

---

## 1. O que ele faz

| Decisão | Motivo |
|---|---|
| **Concorrência** (48 pings ao mesmo tempo por padrão) | 500 endereços em sequência, com 1 s de timeout, levariam 8 min. Com pool, a rede inteira é varrida em poucos segundos. |
| **ICMP + porta TCP** | Rede corporativa costuma filtrar ICMP. Sem a sonda TCP, equipamento que bloqueia ping apareceria como "offline" — e o painel passaria a mentir. |
| **Cache com ciclo de 30 s** | A varredura roda sozinha; a API só lê o resultado pronto. Nenhum clique na tela dispara ping — senão 10 usuários viram 5.000 pings/minuto. |
| **Token do próprio portal** | Valida o mesmo JWT que o backend de chamados já emite, com o mesmo `SSO_SECRET`. Não há senha nova para lembrar nem expirar. |

---

## 2. Instalação na máquina

Requisitos: **Node.js 18+** e nada mais. O serviço não instala pacote nenhum.

```powershell
cd C:\monitor
Copy-Item config.example.json config.json     # ajuste as faixas
Copy-Item .env.example .env                   # preencha o SSO_SECRET
```

O `SSO_SECRET` tem de ser **idêntico** ao do backend de chamados. É ele que
permite ao serviço reconhecer o token de quem já está logado no portal.

```powershell
node server.mjs
```

### Subir sozinho com o Windows (Tarefa Agendada)

```powershell
# Ajusta o caminho do node se não estiver no PATH do sistema
$node = (Get-Command node).Source

schtasks /Create /TN "Monitor de Rede" /TR "`"$node`" `"C:\monitor\server.mjs`"" /SC ONSTART /RU SYSTEM /RL HIGHEST /F
```

> `/RU SYSTEM` faz o serviço voltar sozinho depois de reiniciar a máquina, que
> é a razão de ele ficar 24/7. Se a rede só abre para conta de usuário, troque
> por `/SC ONLOGON` e ajuste `/RU`.

---

## 3. Publicar para o portal (Cloudflare Tunnel — grátis)

O portal está na Vercel, na internet. A máquina está na rede privada, sem IP
público. O túnel resolve isso **sem abrir porta no roteador** e sem proxy
reverso: ele sai da máquina, termina o TLS e entrega o serviço num endereço
HTTPS público.

**a) Instalar o `cloudflared`** (baixe o `.exe` para Windows em
<https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/>)

**b) Criar o túnel e pegar o hostname**

```powershell
cloudflared tunnel login
cloudflared tunnel create monitor-rede

# aponta o hostname público para a porta local do serviço
cloudflared tunnel route dns monitor-rede monitor.seudominio.com
```

**c) Apontar o túnel para o serviço** — edite o `%USERPROFILE%\.cloudflared\config.yml`:

```yaml
tunnel: monitor-rede
credentials-file: C:\Users\SEU_USUARIO\.cloudflared\<TUNNEL-ID>.json

ingress:
  - hostname: monitor.seudominio.com
    service: http://127.0.0.1:4000
  - service: http_status:404
```

**d) Registrar como serviço do Windows**

```powershell
cloudflared service install
```

**e) Apontar o portal para ele** — no `.env` do portal:

```bash
VITE_API_MONITOR_URL=https://monitor.seudominio.com
```

O serviço já responde com os cabeçalhos de CORS, então a origem cruzada está
resolvida. Se quiser travar mais ainda, restrinja as origens com
`CORS_ORIGENS=https://seu-portal.vercel.app` no serviço.

---

## 4. Endpoints

| Rota | Auth | Para que serve |
|---|---|---|
| `GET /health` | não | Health check. Confere se o serviço está vivo. |
| `GET /api/resumo` | sim | Só os totais — payload pequeno para polling frequente. |
| `GET /api/hosts` | sim | Totais + a lista completa de endereços. |
| `GET /api/faixas` | sim | Os grupos configurados, com a contagem de cada um. |
| `POST /api/varredura` | sim | Força uma varredura agora (mínimo 15 s entre chamadas). |
| `POST /api/config/recarregar` | sim | Relê o `config.json` sem reiniciar o serviço. |

Exemplo:

```powershell
$h = @{ Authorization = "Bearer $token" }
Invoke-RestMethod https://monitor.seudominio.com/api/resumo -Headers $h
```

---

## 5. Configuração (`config.json`)

```json
{
  "intervaloSegundos": 30,
  "concorrencia": 48,
  "timeoutPingMs": 1000,
  "timeoutPortaMs": 800,
  "historico": 30,
  "portasPadrao": [445, 3389],
  "faixas": [
    { "id": "lab", "rotulo": "Laboratório de Informática", "cidr": "10.20.2.0/24" },
    { "id": "ped", "rotulo": "Pedagógica", "inicio": "10.20.1.10", "fim": "10.20.1.60" },
    { "id": "srv", "rotulo": "Servidores", "ips": ["10.20.9.10", "10.20.9.11"] }
  ]
}
```

Cada faixa aceita `cidr`, ou `inicio`+`fim`, ou `ips` — e vira um grupo na tela.
`portas` na faixa **substitui** `portasPadrao`.

Depois de editar: `POST /api/config/recarregar`. Se o JSON estiver errado, o
serviço **mantém a configuração anterior** e responde 400 com o erro — um erro
de digitação não pode derrubar o painel de quem está atendendo chamado.

---

## 6. Testes

```bash
npm test
```

44 testes com o runner nativo do Node, sem dependência: expansão de CIDR (inclui
os casos que escondem equipamento, como `/31` e `/0`), verificação de JWT
(rejeita `alg: none`, refresh token e token expirado), pool de concorrência,
transições de estado e as sondas reais contra loopback.

```bash
node --test "testes/*.test.mjs"
```

---

## 7. Diagnóstico

| Sintoma | Causa provável |
|---|---|
| Tela vazia, erro só no console | CORS bloqueando. Confira se o `cloudflared` está no ar e se a URL do `.env` do portal é a do túnel. |
| Tudo marcado "offline" | Firewall da rede bloqueando ICMP **e** as portas configuradas. Teste com `Test-NetConnection 10.20.x.x -Port 445`. |
| `503` nas rotas `/api/*` | `SSO_SECRET` ausente ou diferente do backend de chamados. |
| `401` com "Token expirado" | Token velho no navegador — recarregue a página. |
| As quotas não batem com a rede | `/31` e `/32` mantêm todos os endereços (não existe "rede" nesses prefixos). Se faltar algum, o endereço não está na configuração. |
| `429` ao pedir varredura | Minor de 15 s entre chamadas. O ciclo automático já cobre. |

Logs: o serviço escreve no console. Com a Tarefa Agendada, redirecione para
arquivo em `%USERPROFILE%\monitor.log`.

---

Ver também: [Portal URE Leste 3](../README.md) ·
[capítulo 14 da documentação](../docs/14-monitor-de-rede.md) ·
[Tratamento de erros](../docs/09-tratamento-de-erros.md)