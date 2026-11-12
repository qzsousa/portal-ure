# 22 · Links de internet

Cadastro e consulta de links de internet por unidade escolar
(`/links-internet`), restrito a ADMIN. Dados persistidos em `localStorage`
(`portal:links-internet:v1`), com semente inicial em `src/data/linksInternetData.ts`.

## Visão geral

- UI em `src/views/LinksInternetView.vue`; utilitários em `src/utils/linksInternet.ts`.
- Campos: escola, endereço, URE, segundo link, empresa, velocidade (Mbps), status,
  data prevista de instalação, responsável, observações, CIE, última atualização.
- Paginação (12 por página), busca, exportação CSV (Download).
- Relatório consolidado em `RELATORIO_LINKS_INTERNET.md`.

## Permissões

Somente ADMIN.

## Ver também

[05 · Rotas e telas](./05-rotas-e-telas.md) ·
[12 · Glossário](./12-glossario.md)