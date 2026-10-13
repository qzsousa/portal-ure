# 16 · Tutoriais — comentários e curtidas

Este documento registra o esquema de dados implantado para dar **curtidas
(likes) e comentários** (inclusive respondendo a outros comentários) aos
tutoriais da base de conhecimento. É um esquema **de backend (Prisma)**;
a superfície de API e a UI consomem-no nas próximas iterações.

## Resumo em 30 segundos

- Um **usuário** pode curtir um **tutorial** uma única vez (`TutorialCurtida`,
  unicidade por `tutorial + usuario`).
- Um tutorial pode ter **vários comentários** (`TutorialComentario`), inclusive
  de autores públicos (usuário pode ser `null`, ex.: links compartilháveis).
- Um comentário pode **responder** a outro comentário (`parentId` →
  `TutorialComentario`), formando uma árvore (thread).
- Um comentário pode receber **várias curtidas**, uma por usuário
  (`TutorialComentarioCurtida`).
- Exclusão em cascata: apagar tutorial remove seus anexos, comentários e
  curtidas; apagar um comentário pai remove suas respostas.

## Prints

![Tela de tutoriais](./screenshots/21-tutoriais.png)

## Modelo de dados

### Novos modelos (Prisma)

```prisma
model TutorialCurtida {
  id         String   @id @default(cuid())
  tutorialId String
  tutorial   Tutorial @relation(fields: [tutorialId], references: [id], onDelete: Cascade)
  usuarioId  String
  usuario    Usuario  @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())

  @@unique([tutorialId, usuarioId])
  @@index([tutorialId])
  @@index([usuarioId])
}

model TutorialComentario {
  id         String   @id @default(cuid())
  tutorialId String
  tutorial   Tutorial  @relation(fields: [tutorialId], references: [id], onDelete: Cascade)
  usuarioId  String?
  usuario    Usuario?  @relation(fields: [usuarioId], references: [id], onDelete: SetNull)
  autorNome  String
  texto      String
  parentId   String?
  parent     TutorialComentario?  @relation("TutorialComentarioRespostas", fields: [parentId], references: [id], onDelete: Cascade)
  respostas  TutorialComentario[] @relation("TutorialComentarioRespostas")
  curtidas   TutorialComentarioCurtida[]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([tutorialId])
  @@index([parentId])
  @@index([usuarioId])
  @@index([createdAt])
}

model TutorialComentarioCurtida {
  id           String   @id @default(cuid())
  comentarioId String
  comentario   TutorialComentario @relation(fields: [comentarioId], references: [id], onDelete: Cascade)
  usuarioId    String
  usuario      Usuario            @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  createdAt    DateTime           @default(now())

  @@unique([comentarioId, usuarioId])
  @@index([comentarioId])
  @@index([usuarioId])
}
```

### Relações adicionadas

- `Usuario` passa a ter `tutorialCurtidas`, `tutorialComentarios` e
  `tutorialComentarioCurtidas`.
- `Tutorial` passa a ter `comentarios` e `curtidas`.

### Regras (constraints) que garantem o contrato

| Regra | Onde | Efeito |
|---|---|---|
| Um usuário curte um tutorial uma vez | `@@unique([tutorialId, usuarioId])` em `TutorialCurtida` | segunda tentativa gera `P2002`. |
| Um usuário curte um comentário uma vez | `@@unique([comentarioId, usuarioId])` em `TutorialComentarioCurtida` | idem. |
| Comentário pode existir sem usuário | `usuarioId?` + `onDelete: SetNull` | histórico preservado (snapshot em `autorNome`). |
| Comentários podem ser aninhados | `parentId?` self-referência | respostas removidas em cascata com o pai. |
| Apagar tutorial limpa tudo | `onDelete: Cascade` nas relações | sem lixo órfão. |

### Migration

Arquivo: `backend/prisma/migrations/20261013170000_add_comentarios_likes_tutoriais/migration.sql`
(com `CREATE TABLE`, índices e foreign keys acima).

### Prisma Client

Regenerado com `npm run prisma:generate` (backend) — os tipos `TutorialCurtida`,
`TutorialComentario` e `TutorialComentarioCurtida` já aparecem em
`@prisma/client`.

## Como o frontend consome (próximos passos)

- Curtir tutorial: toggle em `/tutoriais/:id` (POST/DELETE ou criação
  idempotente).
- Listar comentários com respostas aninhadas e contagem de curtidas; filtrar
  por `tutorialId`.
- Responder comentário: cria `TutorialComentario` com `parentId`.
- Curtir comentário: toggle em cada item.

## Notas de implementação

- A contagem de curtidas **não é desnormalizada** no tutorial nem no
  comentário; é obtida por `COUNT`/`_count` para manter fonte única de verdade.
- `visualizacoes` (já existente) continua independente das curtidas.
- A contagem de "quantos comentários" pode ser obtida via
  `prisma.tutorialComentario.count({ where: { tutorialId, parentId: null } })`.
