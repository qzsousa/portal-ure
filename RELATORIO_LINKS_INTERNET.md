# Relatório — Página "Links de Internet" (portal-ure)

## Data
2026-10-16

## Objetivo
Criar uma página administrativa para centralizar a planilha **"2º Link Internet - URE Leste 3.xlsx"** (controle dos 2º links de internet das unidades) em um dashboard web do portal (Vue 3 + Vite), visível apenas para **ADMIN**.

## O que foi feito

### Nova funcionalidade
- Nova view: `src/views/LinksInternetView.vue`
- Nova rota autenticada: `/links-internet` (`name: links-internet`), `roles: ['ADMIN']`
- Item no menu lateral: **Links de Internet** (ícone `Globe`), apenas para admin
- Dashboard com:
  - KPIs: total de unidades, com 2º link, sem 2º link, links instalados, não instalados, empresas contratadas + velocidade média
  - Distribuição por empresa (barras)
  - Observações registradas
  - Busca textual e filtros (status, empresa, presença de 2º link)
  - Limpar filtros
  - Tabela paginada com detalhes (escola, endereço, link, empresa, velocidade, status, data, responsável, observações, CIE)
  - Exportação CSV
  - Botão **Acessar Firewall** abrindo `https://fw-{CIE}/login`
  - Adicionar / editar / remover links
  - Persistência local em `localStorage` (`portal:links-internet:v1`)
  - Empty state e confirmação ao remover
  - Acessibilidade: `scope="col"`, modal `role="dialog"`, `prefers-reduced-motion`

### Dados
- Planilha convertida para TypeScript em `src/data/linksInternetData.ts`
- 72 unidades (Leste 3)
- Campo `cie` mapeado a partir do `CIE_MAP` de `UnidadesView.vue` (match por normalização + similaridade de tokens)
- Todas as unidades ficaram com CIE mapeado; 0 pendentes

### Arquivos alterados
- `src/components/layout/AppSidebar.vue` — import `Globe`, item de menu admin
- `src/router/index.ts` — rota `/links-internet` admin-only
- `src/views/LinksInternetView.vue` — nova view
- `src/data/linksInternetData.ts` — dados da planilha (+ CIE)
- `src/components/ui/BaseModal.vue` — `role="dialog"`, `aria-modal`, `aria-label`

### Validações
- `npm run build` (vue-tsc + vite) passou

## Como acessar
1. Rodar backend/front conforme `AGENTS.md`
2. Dev server portal: `npm run dev` em `C:\Users\...\portal-ure` (porta 5173)
3. Login como ADMIN e acessar menu "Links de Internet" ou `/links-internet`

## Pendências / melhorias futuras
1. Backend real: hoje os dados são estáticos (`linksInternetData.ts`) com edição apenas local (`localStorage`). Se outro admin alterar, não sincroniza entre usuários/máquinas. Falta API + modelo de dados para persistência centralizada.
2. Upload/importação da planilha pelo próprio portal (hoje conversão manual via script).
3. Histórico/auditoria de alterações (quem editou quando).
4. Validações mais robustas no formulário (CIE numérico, URLs, status customizados).
5. Testes automatizados/E2E para a nova rota e CRUD.
6. Responsividade refinada da tabela em telas pequenas (cards/scroll horizontal já existe).
7. Possível padronização dos nomes de escola com o formato "E.E. ..." usado em outras telas.
8. Revisar permissões de rota (`rotasPermitidas`) para garantir que admins restritos também vejam a página corretamente, se necessário.
9. Documentação de rotas/telas em `docs/05-rotas-e-telas.md`.

## Observações
- O servidor Vite anterior pode precisar reinício para hot-reload se houver cache antigo.
- Nenhum commit/push foi feito.
PY