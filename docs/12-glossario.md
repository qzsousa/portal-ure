# 12 · Glossário

Siglas e termos próprios do sistema.

---

## Siglas

| Sigla | Significado |
|---|---|
| **SETEC** | Secretaria de Tecnologia e Cultura do Estado de São Paulo. É a pasta técnica que responde pela tecnologia da rede. |
| **URE** | Unidade Regional de Ensino. |
| **URE Leste 3** | A região atendida por este portal (municípios do leste da Capital). |
| **SCE** | Sistema de Controle de Equipamentos. O segundo sistema, mais antigo, que o portal passou a integrar. |
| **SSO** | *Single Sign-On*. Login único: o mesmo token JWT é aceito pelos dois backends. |
| **JWT** | *JSON Web Token*. Token de autenticação assinado. |
| **AOE** | *Agente de Organização Escolar*. Cargo escolar. |
| **HMR** | *Hot Module Replacement*. Recarga instantânea do Vite. |
| **SPA** | *Single Page Application*. O portal é uma SPA. |
| **CSV / PDF** | Formatos de exportação. |
| **Zod** | Biblioteca de validação usada no backend de chamados. |
| **RLS** | *Row Level Security*. Controle de acesso por linha no Supabase. |

---

## Papéis

| Termo | Significado |
|---|---|
| **Matriz** | Quem pertence à região (URE Leste 3) e não a uma escola. Equivale ao `ADMIN`. |
| **Técnico** | Atende chamados e equipamentos de um conjunto de escolas (lista na `filial`). |
| **Gestor** | Responsável por uma escola. Gerencia chamados, equipamentos e até 2 usuários da unidade. |
| **Visualizador** | Como o Gestor, mas **sem** apagar usuários nem equipamentos. |
| **MÃE** | Escola que administra o painel de equipamentos de um prédio compartilhado. |
| **FILHA** | Escola irmã que compartilha o prédio e **só visualiza** os equipamentos. |

---

## Conceitos de chamado

| Termo | Significado |
|---|---|
| **Protocolo** | Identificador público do chamado: `CH-AAAAMMDD-NNNN`, sequencial por dia. |
| **Categoria** | Agrupamento do chamado no formulário público: `rede`, `equipamento`, `sistemas`, `email`. |
| **Pergunta condicional** | Pergunta que só aparece se a resposta de outra for exatamente certo rótulo. |
| **Alerta de opção** | Mensagem (e/ou bloqueio) exibida quando certa opção é escolhida. |
| **Encerra** | Flag de alerta que **bloqueia** o avanço do formulário. |
| **Exige anexo** | Flag de alerta que torna o anexo obrigatório. |
| **"Outro (descrever)"** | Opção automática de toda pergunta de opções, que abre um campo livre. |
| **Status do chamado** | `ABERTO` → `ENCAMINHADO` → `ANDAMENTO` → `AGUARDANDO_CONFERENCIA` → `RESOLVIDO`, mais `COMUNICADO` (pergunta da matriz à escola). |
| **Aceite** | Momento em que o técnico assume o chamado (`aceitoEm`). Antes disso não pode registrar nem concluir. |
| **Registro de atendimento** | Linha datada do que o técnico fez. Pode repetir; cada uma guarda a hora do servidor. |
| **Conclusão** | Registro do técnico ao entregar o serviço; leva o chamado a `AGUARDANDO_CONFERENCIA`. |
| **Conferência** | Verificação da escola sobre o que o técnico fez. É ela que encerra o chamado. |
| **Contestação** | Escola informa o que ficou faltando: o chamado volta para `ABERTO` e conta mais uma reabertura. |
| **Reabertura** | Quantas vezes o chamado foi contestado e reaberto (`reaberturas`). |
| **Pergunta da matriz** | Mensagem da equipe para a escola, enviada ao mudar para *Aguardando resposta*. |
| **Resposta da escola** | Mensagem da unidade para a matriz. |
| **Encaminhamento** | Atribuir um responsável técnico ao chamado. |
| **Encaminhamento automático** | Regra que atribui o técnico sozinho, pela categoria do chamado. |
| **Regra de encaminhamento** | Ligação categoria → destino (técnico da unidade ou técnico fixo). |
| **Avaliação** | Nota de 1 a 5 que a escola dá ao atendimento, após a resolução. |
| **Exclusão lógica** | `excluido = true` — o chamado some das listas mas o registro fica no banco. |

---

## Conceitos de equipamento

| Termo | Significado |
|---|---|
| **Parque** | O conjunto de equipamentos de uma região. |
| **Patrimônio** | Identificador patrimonial do equipamento. |
| **Número de série** | Identificador do fabricante. Pelo menos um dos dois deve ser informado. |
| **Boletim de ocorrência** | Documento anexado quando o equipamento é marcado como **Extraviado** (obrigatório). |
| **Emprestado** | Equipamento cedido a outra escola, com responsável e data de devolução. |
| **Histórico de alterações** | Registro de campo a campo de cada edição de um equipamento. |
| **Auditoria do SCE** | Registro administrativo de ações no inventário (usuário + ação). |
| **Catálogo** | Tabela de categoria → marca → modelo que alimenta o formulário público. |
| **Cascata** | Seleção em três níveis (categoria → marca → modelo) no formulário de chamado. |
| **Unidade (resumo)** | Totais de equipamentos de uma escola, por status. |

---

## Conceitos técnicos

| Termo | Significado |
|---|---|
| **Token de acesso** | `accessToken`, expira em ~15 min. Vai no header `Authorization`. |
| **Refresh** | Renovação automática do token quando o acesso expira (401). |
| **Fila de refresh** | Requisições que esperam o token novo enquanto uma renovação acontece. |
| **Envelope** | Formato `{ success, data, error }` do SCE. |
| **4xx** | Erro do cliente (validação, permissão, não encontrado). Resposta normal. |
| **5xx** | Erro do servidor. Vai para o log de erros. |
| **Sem resposta** | O navegador não recebeu nada: servidor fora, CORS ou timeout. |
| **Cooldown** | Intervalo mínimo entre dois toasts da mesma falha (60 s). |
| **Polling** | Atualização periódica automática de uma tela. |
| **Atualização silenciosa** | Polling que não mostra spinner nem erro, preservando os dados na tela. |
| **Abordagem** | *Deep link* — abrir uma tela já num registro específico (`/chamados?chamado=id`). |
| **Code splitting** | Cada tela vira um arquivo separado no build. |
| **Teleport** | Renderizar um elemento fora da hierarquia do DOM (modais, menus). |
| **Scoped CSS** | Estilos que valem só dentro do componente. |
| **Design token** | Variável CSS de cor/raio/sombra, definida em `tokens.css`. |

---

## Nomes de domínio

| Nome | Significado |
|---|---|
| **`filial`** | Campo de texto com a unidade do usuário. Lista separada por vírgula para o Técnico. |
| **`grupo`** | Nome composto do prédio: `"E.E. A / E.E. B"`. |
| **`irma`** | A outra escola do prédio (campo `irma` em `UnidadePainel`). |
| **`tecnico`** | Nome do técnico responsável por uma escola, exibido na tela de Unidades. |
| **`categoriaChave`** | Slug da categoria do formulário — é o que liga o chamado à regra de encaminhamento. |
| **`inventarioStatus`** | Situação do inventário do grupo: `CONCLUIDO`, `EM_ANDAMENTO`, `NAO_REALIZADO`, `NAO_INFORMADO`. |
| **`statusManutencao`** | Situação do chamado de manutenção: `Pendente`, `Em andamento`, `Concluído`. |

---

Ver também: [Visão geral](./01-visao-geral.md) ·
[Arquitetura](./02-arquitetura.md)
