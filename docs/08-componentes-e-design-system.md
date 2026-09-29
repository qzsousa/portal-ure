# 08 · Componentes e design system

## Não há biblioteca de UI

Todo o visual é próprio: variáveis CSS em `styles/tokens.css` + classes
globais em `styles/main.css` + CSS `scoped` em cada componente. Isso dá um
vocabulário consistente e zero dependência de estilo.

---

## Tokens (`styles/tokens.css`)

Todas as cores, raios, sombras e medidas do portal saem daqui. **Nunca escreva
uma cor literal em um componente novo** — use o token.

### Marca

| Token | Valor | Uso |
|---|---|---|
| `--sidebar-bg` | `#081a33` | Sidebar, botão primário, avatar |
| `--sidebar-bg-deep` | `#061429` | Gradiente inferior da sidebar, rodapés |
| `--brand-gold` | `#f5b921` | Item ativo do menu, botão dourado, destaque |
| `--brand-gold-soft` | `#ffe9b3` | Fundo de destaque suave |
| `--sidebar-width` | `240px` | Largura da sidebar |
| `--topbar-height` | `64px` | Altura da topbar |

### Superfícies e texto

| Token | Valor |
|---|---|
| `--bg-app` | `#f1f4f9` |
| `--surface` | `#ffffff` |
| `--surface-muted` | `#f8fafc` |
| `--border` / `--border-strong` | `#e2e8f0` / `#cbd5e1` |
| `--text-primary` / `--text-secondary` / `--text-muted` | `#0f172a` / `#475569` / `#94a3b8` |

### Cores semânticas (todas com par `-soft`)

| Cor | Principal | Suave | Significado |
|---|---|---|---|
| blue | `#2563eb` | `#dbeafe` | Informação, em atendimento |
| green | `#16a34a` | `#dcfce7` | Sucesso, disponível, concluído |
| yellow | `#d97706` | `#fef3c7` | Atenção, manutenção, pendente |
| red | `#dc2626` | `#fee2e2` | Erro, quebrado, aberto |
| purple | `#9333ea` | `#f3e8ff` | Aguardando, especial |
| slate | `#64748b` | `#e2e8f0` | Neutro, extraviado |

### Alias de status

Atalhos que documentam a intenção:

```
--st-disponivel, --st-quebrado, --st-manutencao, --st-extraviado
--ch-aberto, --ch-atendimento, --ch-aguardando, --ch-concluido
```

### Forma

`--radius-sm: 8px` · `--radius-md: 12px` · `--radius-lg: 16px`
`--shadow-sm` · `--shadow-md` · `--shadow-lg`
`--font-sans: 'Inter', system-ui, …`

---

## Classes globais (`styles/main.css`)

### `.card`

Fundo branco, borda `--border`, raio médio, sombra pequena. Base de **toda**
superfície: KPI, tabela, formulário, modal.

### Botões

| Classe | Aparência | Quando usar |
|---|---|---|
| `.btn` | Base (reset + flex + peso 600) | sempre, junto com uma variante |
| `.btn-primary` | Azul-marinho, texto branco | Ação principal da tela |
| `.btn-gold` | Dourado, texto escuro | Ação de destaque (enviar, chamar) |
| `.btn-outline` | Branco com borda | Ação secundária |
| `.btn:disabled` | `opacity: .55`, cursor bloqueado | Estado de carregamento |

Em componentes há variantes locais: `.btn-mini`, `.btn-grande`, `.btn-del`
(ícone de lixeira, vermelho), `.btn-limpar`, `.btn-copiar`.

### Formulários

| Classe | Uso |
|---|---|
| `.field` | `flex column` com `gap: 6px` — rótulo + controle |
| `.input` | Input e textarea |
| `.select-input` | `<select>` com a mesma aparência |
| Foco | Borda azul + halo `rgb(37 99 235 / 0.15)` |

### Tabelas

| Classe | Uso |
|---|---|
| `.table-wrap` | `overflow-x: auto` — o wrapper que permite rolagem lateral |
| `.table` | `collapse`, 13 px, `th` em maiúscula 11 px |

> ⚠️ **Ao criar uma tabela dentro de um container com `overflow: hidden`, o
> menu `RowActions` é cortado.** O menu usa `Teleport to body` justamente para
> escapar disso. Se um menu abrir "atrás" de algo, o problema quase sempre é
> `z-index` ou `overflow` no ancestral, não o componente.

---

## Componentes de UI (`components/ui/`)

### `StatCard.vue` — card de KPI

```vue
<StatCard label="Equipamentos cadastrados" :value="total" tone="blue">
  <Monitor :size="20" />
</StatCard>
```

| Prop | Valores | Padrão |
|---|---|---|
| `label` | texto | — |
| `value` | texto ou número | — |
| `tone` | `blue` `green` `yellow` `red` `slate` `purple` | `blue` |
| `detail` | texto (ex.: percentual, legenda) | `''` |

O ícone vai no **slot** e é renderizado dentro de um chip quadrado com fundo
`-soft` e cor `-main` do tom. `detail` também é colorido pelo tom.

Layout: `grid auto-fit minmax(180px, 1fr)` (ou 340 px nos grids de gráfico).

### `StatusPill.vue` — pílula de status

Uma única prop: `status` (texto). **O tom é inferido por substring**, o que
permite usar tanto `ABERTO` (código do backend de chamados) quanto
`Disponível` (texto do SCE):

| Se o texto contém… | Tom |
|---|---|
| `dispon` | green |
| `manuten` | yellow |
| `quebrad` ou é exatamente `aberto` | red |
| `extrav` | slate |
| `andamento` / `atendimento` | blue |
| `aguard` / `comunicado` | purple |
| `conclu` / `resolv` / `emprestad` | green |
| `pendent` | yellow |
| qualquer outro | slate |

Visual: pílula arredondada com um ponto do mesmo tom da cor.

> ⚠️ **Ao inventar um status novo**, verifique a ordem das regras. "Pendente"
> precisa ser testado antes do fallback, e "Em Empréstimo" precisa conter
> `emprestad` para não cair em slate.

### `DonutCard.vue` — gráfico de rosca

```vue
<DonutCard
  titulo="Status dos Equipamentos"
  :fatias="porStatus"
  :cores="CORES_STATUS"
  center-label="equipamentos"
/>
```

- `fatias`: `Record<string, number>` (rótulo → valor)
- `cores`: `Record<string, string>` opcional — sem isso usa a paleta padrão
  (azul, verde, laranja, vermelho, cinza, roxo, ciano, rosa, em rotação)
- As fatias são **ordenadas da maior para a menor** automaticamente
- Legenda própria com `rótulo` + `percentual %  valor`
- Centro: total formatado em pt-BR + rótulo
- `cutout: 68%`, legenda do Chart.js desativada (a legenda é HTML)

Paletas usadas no sistema:

```ts
// Status de equipamento
Disponível #16a34a · Manutenção #f59e0b · Quebrado #dc2626 · Extraviado #64748b
Emprestado #2563eb · Inservível #9333ea · Em verificação #0891b2

// Notas de avaliação (1 → 5)
#dc2626 · #f59e0b · #eab308 · #2563eb · #16a34a
```

### `PaginationBar.vue`

Props: `page`, `pageSize`, `total`. Emite `change(page)`.

Texto: `Mostrando 10 a 19 de 132 registros`. Até 7 páginas aparecem todas;
acima disso, reticências entram. Botões de 32×32 px, mínimo de 30 px no mobile.

### `BaseModal.vue`

```vue
<BaseModal :titulo="titulo" :aberto="true" @fechar="fechar">
  conteúdo
  <template #footer>botões</template>
</BaseModal>
```

- `Teleport to body` + `Transition`
- Clica no **fundo** fecha (mas não clicar dentro)
- Botão ✕ no cabeçalho
- `max-width: 640px`, `max-height: 86dvh`, corpo com rolagem
- Rodapé só existe se houver slot `#footer`

### `RowActions.vue` — menu "⋮"

```vue
<RowActions :itens="[
  { rotulo: 'Editar', icone: Pencil, acao: abrirEditar },
  { rotulo: 'Excluir', icone: Trash2, perigo: true, acao: remover },
]" />
```

O menu é `Teleport to body` e **se posiciona por JavaScript**, não por CSS:

1. Abre abaixo do botão; se estourar a base da viewport, **abre para cima**
2. Alinha pela borda direita do botão
3. Limita 8 px das bordas da viewport
4. `min-width: 190px`, `max-height` com rolagem interna

Fecha em: clique fora, `Esc`, rolagem (inclusive dentro de containers) e
redimensionamento. Reconfirma a posição no próximo frame, para não abrir
"colado" no botão quando o layout é assíncrono.

### `ToastContainer.vue`

`fixed`, topo-direita, `z-index: 1000`, `max-width: 380px`. Fila com
`TransitionGroup`. Cada toast tem um ✕ para fechar.

---

## Componentes de layout

### `AppShell.vue`

```
<div class="shell">
  <AppSidebar />
  <div class="content">
    [banner de simulação, se houver]
    <AppTopbar />
    <main class="page"><RouterView /></main>
  </div>
</div>
```

Fecha o drawer a cada mudança de rota (`watch route.fullPath`).

### `AppSidebar.vue`

Gradiente azul-marinho, brasão circular, `PORTAL URE LESTE 3` /
`Unidade Regional de Ensino`. Menu com o item ativo em **dourado** e texto
escuro. Rodapé em itálico serifado: *"Tecnologia a serviço da educação"*.

Itens filtrados por perfil (ver
[Autenticação e permissões](./04-autenticacao-e-permissoes.md#o-menu-lateral)).

No mobile (≤ 900 px) vira **drawer**: `translateX(-105%)`, overlay com
`rgb(15 23 42 / 0.55)` e transição de 250 ms.

### `AppTopbar.vue`

Da esquerda para a direita:

| Elemento | Detalhe |
|---|---|
| ☰ | Só no mobile, abre o drawer |
| Título + breadcrumb | Vêm de `route.meta.title` / `route.meta.breadcrumb` |
| Relógio | `25 de Setembro de 2026` / `Sexta-Feira - 15:48`. Escondido no mobile |
| 🔔 Sino | Badge vermelho de não lidas (teto em `99+`). Dropdown com lista rolável e "Marcar todas como lidas" |
| Avatar + nome | Avatar com a inicial; `<perfil> · URE Leste 3` |
| Menu do usuário | "Trocar senha" e "Sair" (vermelho) |

O dropdown do sino mostra tempo relativo em português:
`agora mesmo`, `há 5 min`, `há 2 h`, `ontem`, `há 3 dias`, depois a data.

---

## Componentes de gráfico

### `BarChartCard.vue` (`components/publico/`)

```vue
<BarChartCard
  titulo="Resolvidos por técnico"
  sub="Chamados concluídos por cada técnico"
  :labels="nomes"
  :series="[{ label: 'Resolvidos', data: [...], cor: '#16a34a' }]"
  horizontal
  empilhado
  legenda
/>
```

| Prop | Padrão | Efeito |
|---|---|---|
| `horizontal` | `false` | Eixo Y vira categorial (barras horizontais) |
| `empilhado` | `false` | Barras empilhadas |
| `legenda` | `false` | Mostra a legenda do Chart.js embaixo |

Se não houver dado, mostra **"Sem dados para exibir."** em vez de um gráfico
vazio.

### `GraficoCategorias.vue` (`components/equipamentos/`)

Rosca de categorias com **drilldown**: clicar numa fatia abre, dentro do próprio
card, a lista dos modelos daquela categoria. O rótulo de cada modelo é
`marca modelo` (ou `Sem marca/modelo`).

No modo filial, o drilldown usa o cache local (sem requisição). No modo ADMIN,
consulta o servidor.

---

## Responsividade

| Breakpoint | O que muda |
|---|---|
| ≤ 1100 px | Filtros do painel passam a 2 colunas |
| ≤ 900 px | Sidebar vira drawer; botão ☰ aparece; relógio some; padding do `.page` cai para 16 px |
| ≤ 640 px | Formulários colapsam para 1 coluna; tabelas rolam; botões ocupam a largura toda |

---

## Acessibilidade — o que já existe

- `aria-label` nos botões só com ícone (`Ações`, `Abrir menu`, `Notificações`)
- `aria-expanded` e `aria-haspopup` nos gatilhos de dropdown
- `role="menu"` / `role="menuitem"` no menu de ações
- `role="radiogroup"` + `role="radio"` nos grupos de escolha (opções do
  formulário, urgência, estrelas da avaliação)
- `aria-invalid` nos campos com erro
- `aria-live` implícito nos toasts; `role="alert"` nos erros de formulário
- Foco visível em todos os controles
- Área de toque mínima de 40×40 px no `RowActions` (era 32 px)
- `Escape` fecha o menu de ações

---

Ver também: [Rotas e telas](./05-rotas-e-telas.md) ·
[Estado, stores e composables](./07-estado-stores-composables.md)
