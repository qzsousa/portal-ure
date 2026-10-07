# Monitor de DVRs

Serviço que verifica se os **gravadores de vídeo (DVRs) das câmeras de
segurança** das escolas estão ligados, e publica o resultado como API para a
aba *Câmeras DVR* do [Portal URE Leste 3](../README.md).

O navegador não envia ICMP — só HTTP. Por isso existe esta máquina: ela está
**dentro da rede das escolas**, faz o ping de verdade e devolve o resultado.

```
Portal (Vercel) ──HTTPS──▶ Cloudflare Tunnel ──▶ http://127.0.0.1:4000 ──ICMP/TCP──▶ DVR
  (navegador)                (termina o TLS)      (este serviço)                  10.109.x.x
```

Sem dependências (`npm install` não é necessário), sem custo, e o portal
consome tudo por API — sem `iframe`.

---

## O que é monitorado

432 DVRs em 72 escolas, cada um com identificação de **qual câmera é**:

| Campo | Exemplo | Para que serve |
|---|---|---|
| `hostname` | `VIDEO-DVR1` | qual gravador é (1, 2 ou 3) |
| `tipo` | `ADM` / `PED` | rede administrativa ou pedagógica |
| `escola` | `E.E. JARDIM WILMA FLOR` | a unidade, que agrupa tudo na tela |

Uma escola tem 6 DVRs: 3 na rede administrativa (`ADM`) e 3 na pedagógica
(`PED`). A tela mostra os dois grupos separados, porque "câmera da pedagógica
caiu" e "câmera da administrativa caiu" costumam ser chamadas diferentes.

---

## 1. Instalação na máquina

Requisito: **Node.js 18+**. Nada mais — o serviço não instala pacote nenhum.

```powershell
cd C:\monitor-dvr
Copy-Item config.example.json config.json    # preencha os DVRs (ver seção 3)
```

O `SSO_SECRET` (variável de ambiente, ver `.env.example`) tem de ser **igual ao
`JWT_SECRET` do backend de chamados** — é ele que permite reconhecer o token de
quem já está logado no portal.

```powershell
node server.mjs
```

### Subir sozinho com o Windows (Tarefa Agendada)

```powershell
$node = (Get-Command node).Source
schtasks /Create /TN "Monitor DVRs" /TR "`"$node`" `"C:\monitor-dvr\server.mjs`"" /SC ONSTART /RU SYSTEM /RL HIGHEST /F
```

`/RU SYSTEM` faz o serviço voltar sozinho depois de reiniciar a máquina — que
é a razão de ele ficar 24/7. Se a rede só abre para conta de usuário, troque
por `/SC ONLOGON`.

---

## 2. Publicar para o portal (Cloudflare Tunnel — grátis)

O portal está na Vercel (internet); a máquina está na rede privada, sem IP
público. O túnel resolve isso **sem abrir porta no roteador**: ele sai da
máquina, termina o TLS e entrega o serviço num endereço HTTPS público.

```powershell
# baixe o cloudflared para Windows
cloudflared tunnel login
cloudflared tunnel create monitor-dvr
cloudflared tunnel route dns monitor-dvr monitor.seudominio.com
```

Edite `%USERPROFILE%\.cloudflared\config.yml`:

```yaml
tunnel: monitor-dvr
credentials-file: C:\Users\SEU_USUARIO\.cloudflared\<TUNNEL-ID>.json

ingress:
  - hostname: monitor.seudominio.com
    service: http://127.0.0.1:4000
  - service: http_status:404
```

```powershell
cloudflared service install    # deixa o túnel como serviço do Windows
```

No portal (Vercel), defina `VITE_API_MONITOR_URL=https://monitor.seudominio.com`.
O serviço já responde com CORS liberado; para restringir as origens, use
`CORS_ORIGENS=https://seu-portal.vercel.app`.

---

## 3. Configurar os DVRs

Copie `dvr-raw.txt` para a pasta do serviço e rode o parser:

```powershell
npm run parse-dvr
```

Ele lê o **mesmo formato de texto que você já usa no pingInfoView**:

```
Group: E.E. ADHEMAR ANTONIO PRADO
10.109.121.194 VIDEO-DVR1 ADM
10.109.121.195 VIDEO-DVR2 ADM
...
```

e gera o `config.json`, uma faixa por escola:

```json
{
  "intervaloSegundos": 30,
  "portasPadrao": [80, 8000, 554, 443, 37777],
  "faixas": [
    {
      "id": "escola-1",
      "rotulo": "E.E. ADHEMAR ANTONIO PRADO",
      "ips": [
        { "ip": "10.109.121.194", "hostname": "VIDEO-DVR1", "tipo": "ADM" }
      ]
    }
  ]
}
```

Depois de editar: `POST /api/config/recarregar`. Se o JSON estiver errado, o
serviço **mantém a configuração anterior** e responde 400 com o erro — um erro
de digitação não pode derrubar o painel de quem está atendendo chamado.

**Endereço repetido entre escolas** é erro real de endereçamento: o log avisa
qual escola ficou com o conflito.

---

## 4. Endpoints

| Rota | Auth | Para que serve |
|---|---|---|
| `GET /health` | não | Health check: serviço no ar? quantas câmeras? |
| `GET /api/resumo` | sim | Só os totais. |
| `GET /api/hosts` | sim | Totais + lista de DVRs (o que a aba consome). |
| `GET /api/escolas` | sim | Escolas com a contagem de ligadas/desligadas. |
| `POST /api/varredura` | sim | Força verificação agora (mín. 15 s entre chamadas). |
| `POST /api/config/recarregar` | sim | Relê o `config.json` sem reiniciar. |

---

## 5. Como "ligada" é decidido

1. O DVR responde a **ping**? → ligada.
2. Se o ICMP for filtrado (comum em rede corporativa), tenta as **portas TCP**
   em `portasPadrao` — `80` (web do DVR), `8000` (SDK), `554` (RTSP), `443`,
   `37777` (protocolo NAT). Qualquer uma aberta → ligada.

Sem a etapa 2, uma câmera que bloqueia ping mas serve vídeo apareceria como
"desligada" — e o painel passaria a mentir, que é pior que não existir.

---

## 6. Testes

```bash
npm test
```

39 testes com o runner nativo do Node, sem dependência: validação do manifesto
(hostname, tipo, IP duplicado entre escolas, BOM do Bloco de Notas, teto de
endereços), verificação de JWT (rejeita `alg: none`, refresh token e token
expirado), pool de concorrência, transições de estado e as sondas reais contra
loopback.

---

## 7. Diagnóstico

| Sintoma | Causa provável |
|---|---|
| Tela vazia, erro só no console | CORS bloqueando. O `cloudflared` está no ar? A URL do `.env` do portal é a do túnel? |
| Todas as câmeras "desligadas" | A máquina não alcança a rede das escolas. Teste: `ping 10.109.121.194` na própria máquina. |
| `503` nas rotas `/api/*` | `SSO_SECRET` ausente ou diferente do `JWT_SECRET` do backend de chamados. |
| `401` "Token expirado" | Token velho no navegador — recarregue a página. |
| `429` ao pedir verificação | Menos de 15 s desde a última. O ciclo automático já cobre. |
| "câmeras desligadas" mas o vídeo funciona | ICMP e todas as portas configuradas filtradas. Ajuste `portasPadrao` ou o `timeoutPortaMs`. |

Logs: o serviço escreve no console. Com a Tarefa Agendada, redirecione para um
arquivo em `%USERPROFILE%\monitor-dvr.log`.

---

Ver também: [Portal URE Leste 3](../README.md) ·
[capítulo 14 da documentação](../docs/14-monitor-de-cameras-dvr.md) ·
[Tratamento de erros](../docs/09-tratamento-de-erros.md)