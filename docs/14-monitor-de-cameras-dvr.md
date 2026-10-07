# 14 · Monitor de câmeras DVR

O portal tem uma aba que mostra, **em tempo real**, se os gravadores de vídeo
(DVRs) das câmeras de segurança de cada escola estão ligados.

O ponto incomum deste módulo: ele **não roda na nuvem**. Os dois outros
backends do portal (Chamados e SCE) estão na internet; este não pode estar,
porque quem faz o `ping` dos endereços é a máquina que alcança as escolas — e
o navegador não envia ICMP.

---

## Por que existe um serviço separado

| O que a tela precisa | O que o navegador pode fazer |
|---|---|
| Perguntar "10.109.121.194 responde?" | **Nada.** O navegador só faz HTTP/HTTPS. ICMP é protocolo de rede, não de aplicação. |

Não há contorno no front. A única forma de responder é um processo **dentro da
rede privada**, e o portal consome o resultado dele por API.

---

## Topologia

```
Portal (Vercel)  ──HTTPS──▶  Cloudflare Tunnel  ──▶  127.0.0.1:4000  ──ICMP/TCP──▶  DVR
   navegador                  (termina o TLS)        serviço Node                   10.109.x.x
```

O portal está na Vercel; a máquina está numa rede sem IP público. O
**Cloudflare Tunnel** (grátis) resolve: ele sai da máquina, termina o TLS e
entrega o serviço num endereço HTTPS público. Nenhuma porta é aberta no
roteador.

O serviço escuta em `127.0.0.1` — quem fala com o navegador é o túnel, não a
LAN.

---

## Como a origem cruzada é resolvida

O portal (Vercel) e o serviço (rede privada) são origens diferentes, então sem
CORS o navegador cancela a requisição **antes do JavaScript ler a resposta** —
e o sintoma é uma tela vazia, com o erro só no console.

O serviço já responde com:

```
Access-Control-Allow-Origin: *        # ou só as origens de CORS_ORIGENS
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
```

E o `OPTIONS` (preflight) é respondido **antes** da autenticação — se exigisse
token, o navegador nunca chegaria a enviar o `GET`.

---

## Autenticação: o mesmo login, sem senha nova

O serviço valida o **mesmo access token JWT** que o backend de chamados já
emite, com o **mesmo segredo** (`SSO_SECRET` = `JWT_SECRET` do backend de
chamados). Não há usuário, senha nem sessão paralela para o monitor.

> ⚠️ **O segredo é o `JWT_SECRET` do backend de chamados.** No SCE o mesmo valor
> chama-se `SSO_SECRET`, porque quem copiou lá deu esse nome — mas o backend de
> chamados **não tem** variável com esse nome. Quem procurar lá não encontra e
> pode acabar gerando um segredo novo: aí o monitor responde `401` para token
> válido, e parece "quebrado".

Perfis liberados: `ADMIN` e `TECNICO` (variável `NIVEIS_PERMITIDOS`). Um
`GESTOR` recebe `403` — a tela fica na matriz, como as demais restritas.

---

## Os dados: onde estão e como são gerados

A fonte é o **mesmo texto do `pingInfoView`** que a equipe já usa:

```
Group: E.E. JARDIM DOM ANGELICO
10.109.119.226 VIDEO-DVR1 ADM
10.109.119.227 VIDEO-DVR2 ADM
10.109.119.229 VIDEO-DVR3 ADM
10.120.248.20  VIDEO-DVR1 PED
10.120.248.21  VIDEO-DVR2 PED
10.120.248.22  VIDEO-DVR3 PED
```

`monitor/scripts/parse-dvr.mjs` transforma esse texto em `config.json`, **uma
faixa por escola**. O serviço lê o `config.json` — nunca o texto cru.

Atual em: **432 DVRs em 72 escolas**, 6 por escola (3 ADM + 3 PED).

### Campos de domínio

| Campo | Para que serve na tela |
|---|---|
| `hostname` (`VIDEO-DVR1/2/3`) | qual gravador é |
| `tipo` (`ADM` / `PED`) | rede administrativa ou pedagógica |
| `escola` | a unidade, que agrupa o cartão e o filtro |

`ADM` e `PED` ficam separados na tela porque são redes diferentes: "câmera da
pedagógica caiu" e "câmera da administrativa caiu" costumam ser atendimentos em
momentos diferentes.

### Endereço repetido entre escolas

Um mesmo IP em duas escolas é **erro de endereçamento** (câmera cadastrada no
IP errado). O serviço mantém a primeira ocorrência, avisa no log e nomeia as
duas escolas — esconder a duplicidade esconderia o problema.

---

## Como "ligada" é decidido

1. O DVR responde a **ping**? → ligada.
2. Se o ICMP for filtrado (comum), tenta as **portas TCP** de `portasPadrao`
   (`80` web do DVR, `8000` SDK, `554` RTSP, `443`, `37777` protocolo NAT).
   Qualquer uma aberta → ligada.

Sem o passo 2, uma câmera que bloqueia ping mas serve vídeo apareceria como
**desligada** — e o painel passaria a mentir. Isso é pior que não ter painel:
o técnico confia no número e abre chamado errado.

### Concorrência e cache

- **48 verificações em paralelo** (configurável). Sequencial, 432 câmeras com 1 s
  de timeout levaria ~7 minutos por ciclo.
- **Ciclo de 30 s**, agendado no serviço. A tela consulta a cada 30 s e só lê o
  resultado pronto: **nenhum clique na tela dispara ping**. Dez pessoas com o
  painel aberto não podem virar um flood na rede.
- Ciclos não se sobrepõem: se a rede ficar lenta, o ciclo é pulado, não
  empilhado.

---

## Endpoints

| Rota | Auth | Uso |
|---|---|---|
| `GET /health` | não | Serviço no ar? Quantas câmeras? Usado por Configurações → Integrações. |
| `GET /api/resumo` | sim | Só os totais. |
| `GET /api/hosts` | sim | Totais + lista de DVRs — o que a aba consome. |
| `GET /api/escolas` | sim | Escolas com a contagem de ligadas/desligadas. |
| `POST /api/varredura` | sim | Força verificação agora (mín. 15 s entre chamadas). |
| `POST /api/config/recarregar` | sim | Relê o `config.json` sem reiniciar. |

`/api/hosts` devolve **totais e lista no mesmo payload** de propósito: se a tela
pedisse separado, mostraria "200 ligadas" ao lado de uma lista de outra
varredura, que não bate.

Configuração inválida no `/api/config/recarregar` **mantém a configuração
anterior** e responde `400` — um erro de digitação não pode derrubar o painel de
quem está atendendo chamado.

---

## O que a tela mostra

| Bloco | Para que serve |
|---|---|
| Banner vermelho | Alguma unidade com DVR desligado, nomeadas. |
| KPIs | Ligadas / desligadas / latência média / total de câmeras. |
| Barra de status | Quando foi verificado, quanto levou, botão **Verificar agora**. |
| Grade por unidade | Um cartão por escola: fração `4/6`, barra e **um quadradinho por DVR** (verde/vermelho), separado em ADM e PED. Clicar filtra a tabela. |
| Tabela | Escola, DVR, rede, IP, situação, como respondeu, latência, **histórico** (barras por ciclo) e há quanto tempo está no estado. |

O **histórico por DVR** (30 ciclos) existe para distinguir "caiu agora" de
"está oscilando há semanas" — que são defeito de rede e de equipamento. Quem
passou de 2 alternâncias ganha o selo *instável*.

Ordenação padrão: **desligadas primeiro**, depois por rede (ADM antes de PED) e
por número de DVR. Quem abre a tela procurando a câmera caída não deveria
precisar ordenar por coluna.

---

## Diagnóstico

| Sintoma | Causa provável |
|---|---|
| Tela vazia, erro só no console | CORS. O `cloudflared` está no ar? A URL em `VITE_API_MONITOR_URL` é a do túnel? |
| Tudo "desligado" | A máquina não alcança a rede das escolas. `ping 10.109.121.194` na própria máquina. |
| `503` nas rotas `/api/*` | `SSO_SECRET` ausente ou diferente do `JWT_SECRET` do backend de chamados. |
| `401` "Token inválido" | Token velho no navegador — recarregue a página. |
| `403` | Perfil sem permissão (só matriz). |
| `429` ao pedir verificação | Menos de 15 s desde a última. O ciclo automático já cobre. |
| "desligada" mas o vídeo funciona | ICMP **e** todas as portas de `portasPadrao` filtradas: ajuste as portas ou o `timeoutPortaMs`. |

Logs: o serviço escreve no console; com a Tarefa Agendada, redirecione para
arquivo. O `monitor/README.md` tem o passo a passo de instalação, Tarefa
Agendada e do túnel.

---

## O que NÃO existe aqui

- **Sem gravação de histórico em disco.** O histórico vive em memória (30
  ciclos). Ao reiniciar o serviço, o histórico recomeça. É proposital: o
  propósito é o estado atual, não um banco de séries temporais.
- **Sem alerta por e-mail/WhatsApp.** A tela mostra o que está fora do ar; o
  aviso às pessoas continua sendo do processo de chamado.
- **Sem verificação de que o DVR está gravando.** O serviço prova que o
  endereço responde, não que as imagens estão sendo gravadas — isso exigiria
  falar com o protocolo do gravador, não só a rede.

---

Ver também: [Arquitetura](./02-arquitetura.md) ·
[Rotas e telas](./05-rotas-e-telas.md) ·
[Backends e endpoints](./06-backends-e-endpoints.md) ·
[Tratamento de erros](./09-tratamento-de-erros.md) ·
[`monitor/README.md`](../monitor/README.md)