# 05 · Ping e sonda

- `probe.ping(ip, timeoutMs)`: spawna `ping` do SO (`-n 1 -4 -w` no Windows;
  `-c 1` elsewhere), veredito pelo exit code; extrai latência/TTL por regex
  (PT/EN). `ok: null` = binário indisponível.
- `probe.sondaTcp(ip, porta, timeoutMs)`: socket TCP com timeout.

`monitor.criarSondador`: ICMP primeiro; se offline e houver portas, testa
todas em paralelo (`Promise.all`), qualquer aberta = online com
`metodo: tcp:<porta>`. Se nenhuma responde = offline com `metodo: sem-resposta`
(ou `indisponivel`).

`comPool`: pool de concorrência limitada sobre os alvos.

**Ciclo:** varredura inicial no boot, depois `setTimeout` recursivo (intervalo
configurável, mín. 1s); se varredura atrasar, próxima só agenda após término.
`varrer()` ignora se já em andamento.

**Estado/cache:** `estado` é `Map<ip, registro>` com campos de domínio + dinâmicos
(status, metodo, latenciaMs, ttl, verificadoEm, onlineDesde/offlineDesde,
alternancias, totalVerificacoes, historico). `registrar` detecta transição
bidirecional.

**Agregações:** `resumo()` (totais + por faixa com adm/ped + latência
média/máxima + `caidosAgora`), `hosts()` (lista completa), `snapshot()`.