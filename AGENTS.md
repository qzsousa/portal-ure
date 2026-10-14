# portal (portal-ure) — frontend Vue/Vite

Portal web (Vue 3 + Vite) com monitor interno. Repositório de produto: trabalhe
aqui apenas quando a tarefa for sobre o portal.

## Stack

- Frontend: Vue 3, TypeScript, Vite, Pinia, Vue Router, Axios, Chart.js.
- Monitor: Node (dentro de `monitor/`).
- Build: `vue-tsc -b && vite build`.

## Comandos

```bash
npm run dev        # Vite (porta 5173 por padrão)
npm run build      # typecheck + build de produção
npm run preview
```

Subir para os gates do orq:
```bash
dev-restart -Port 5173 -Dir "C:\Users\Pablo\Desktop\portal-ure" -Script "node_modules/vite/bin/vite.js"
```

## Regras

- Não faça push sem autorização explícita.
- Termine com a árvore limpa (tudo commitado).
- Só edite arquivos do escopo da tarefa; se precisar de outro, PARE e reporte.
- Vue é reativo: não mova estado compartilhado para `localStorage` sem decisão
  explícita de arquitetura.

## Skills a carregar (OpenCode)

Use a tool `skill` antes de trabalhar, conforme o escopo:
- UI/UX e design: `frontend-design`, `frontend-patterns`, `frontend-ui-ux`
- Testes E2E: `webapp-testing`, `lsp-validation`
- Qualidade/gates: `verification-loop`, `eval-harness`, `strategic-compact`
- Padrões gerais: `coding-standards`, `security-review`, `tdd-workflow`
- Aprendizado/contexto: `continuous-learning`, `continuous-learning-v2`, `iterative-retrieval`

Se mais de uma se aplica, carregue em paralelo.

## Observações de integração

- O portal consome o backend de chamados (porta 10000) e o SCE (porta 3000).
- Mudanças em chamada de API afetam contrato: descreva o impacto no relatório.