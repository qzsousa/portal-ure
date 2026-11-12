# 02 · Estrutura do projeto

```
monitor/
├── server.mjs            # entrypoint: rotas, ciclo de varredura
├── package.json
├── .env.example
├── config.example.json
├── src/
│   ├── config.mjs        # leitura/validação do manifesto
│   ├── probe.mjs         # ping ICMP + sonda TCP
│   ├── monitor.mjs       # motor: pool, cache, agregações
│   └── auth.mjs          # JWT HS256 (sem jsonwebtoken)
├── scripts/
│   └── parse-dvr.mjs     # parse de dvr-raw.txt -> config.json
└── testes/               # 39 testes (node --test)
```

Arquivos não versionados: `.env`, `config.json`, `dvr-raw.txt`.