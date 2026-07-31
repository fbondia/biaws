# Inventário inicial de autorização

Este inventário classifica as rotas após a ativação da autorização na Fase 4.
Todas as rotas de negócio abaixo exigem autenticação. As permissões
são globais nesta primeira versão. Endpoints genéricos de atualização deverão
validar também os campos enviados.

## Rotas públicas

| Método | Rota          | Classificação                                                       |
| ------ | ------------- | ------------------------------------------------------------------- |
| `GET`  | `/api/health` | pública                                                             |
| `*`    | `/api/auth/*` | gerida pelo Better Auth; cada operação aplica sua própria exigência |

O cadastro público `POST /api/auth/sign-up/email` está desabilitado.

## Grupos e vínculos

| Método  | Rota                                                 | Permissão aplicada              |
| ------- | ---------------------------------------------------- | ------------------------------- |
| `GET`   | `/api/access/permissions`                            | `roles.read`                    |
| `GET`   | `/api/access/groups` e `/api/access/groups/:groupId` | `roles.read`                    |
| `POST`  | `/api/access/groups`                                 | `roles.manage`                  |
| `PUT`   | `/api/access/groups/:groupId`                        | `roles.manage`                  |
| `PATCH` | `/api/access/groups/:groupId/status`                 | `roles.manage`                  |
| `GET`   | `/api/access/users/:userId`                          | `users.read`                    |
| `PUT`   | `/api/access/users/:userId/groups`                   | `users.update` e `roles.manage` |

As permissões da tabela são aplicadas pelo backend. A administração técnica de
identidades também conserva as verificações internas do Better Auth.

## Issues e taxonomia

| Método   | Rota                                             | Permissão aplicada                                   |
| -------- | ------------------------------------------------ | ---------------------------------------------------- |
| `GET`    | `/api/issues`                                    | `issues.read`                                        |
| `POST`   | `/api/issues`                                    | `issues.create`                                      |
| `POST`   | `/api/issues/imports/eml`                        | `issues.import.eml`                                  |
| `GET`    | `/api/issues/summary`                            | `issues.read`                                        |
| `GET`    | `/api/issues/aggregate`                          | `issues.read`                                        |
| `GET`    | `/api/issues/taxonomy`                           | `taxonomy.read`                                      |
| `PUT`    | `/api/issues/taxonomy`                           | `taxonomy.manage`                                    |
| `GET`    | `/api/issues/by-taxonomy/:taxonomyId`            | `issues.read`                                        |
| `PUT`    | `/api/issues/:id/classification`                 | `issues.classification.update`                       |
| `POST`   | `/api/issues/:id/comments`                       | `issues.comment.create`                              |
| `PUT`    | `/api/issues/:id/comments/:commentId`            | `issues.comment.update`                              |
| `PATCH`  | `/api/issues/:id`                                | por campo: `issues.update` ou `issues.status.update` |
| `GET`    | `/api/issues/:id`                                | `issues.read`                                        |
| `POST`   | `/api/issues/:id/attachments`                    | `issues.attachment.create`                           |
| `GET`    | `/api/issues/:id/attachments/:attachmentId`      | `issues.attachment.read`                             |
| `PATCH`  | `/api/issues/:id/attachments/:attachmentId/tags` | `issues.attachment.update`                           |
| `DELETE` | `/api/issues/:id/attachments/:attachmentId`      | `issues.attachment.delete`                           |

## Melhorias e tarefas

| Método   | Rota                                               | Permissão aplicada                                                                        |
| -------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `GET`    | `/api/requests`                                    | `demands.read`                                                                            |
| `POST`   | `/api/requests`                                    | `demands.create`; exige também `demands.specification.update` quando houver especificação |
| `PUT`    | `/api/requests/:id`                                | por campo: `demands.update` e/ou `demands.specification.update`                           |
| `PATCH`  | `/api/requests/:id/order`                          | `demands.reorder`                                                                         |
| `DELETE` | `/api/requests/:id`                                | `demands.delete`                                                                          |
| `POST`   | `/api/requests/:id/notes`                          | `demands.note.create`                                                                     |
| `PUT`    | `/api/requests/:id/notes/:noteId`                  | `demands.note.update`                                                                     |
| `DELETE` | `/api/requests/:id/notes/:noteId`                  | `demands.note.delete`                                                                     |
| `POST`   | `/api/requests/:id/tasks`                          | `tasks.create`                                                                            |
| `PUT`    | `/api/requests/:id/tasks/:taskId`                  | por campo: `tasks.update` e/ou `tasks.status.update`                                      |
| `DELETE` | `/api/requests/:id/tasks/:taskId`                  | `tasks.delete`                                                                            |
| `POST`   | `/api/requests/:id/tasks/:taskId/notes`            | `tasks.note.create`                                                                       |
| `PUT`    | `/api/requests/:id/tasks/:taskId/notes/:noteId`    | `tasks.note.update`                                                                       |
| `DELETE` | `/api/requests/:id/tasks/:taskId/notes/:noteId`    | `tasks.note.delete`                                                                       |
| `POST`   | `/api/requests/:id/attachments`                    | `demands.attachment.create`                                                               |
| `GET`    | `/api/requests/:id/attachments/:attachmentId`      | `demands.attachment.read`                                                                 |
| `PATCH`  | `/api/requests/:id/attachments/:attachmentId/tags` | `demands.attachment.update`                                                               |
| `DELETE` | `/api/requests/:id/attachments/:attachmentId`      | `demands.attachment.delete`                                                               |

As rotas atuais não oferecem anexos diretamente em subtarefas; as permissões
`tasks.attachment.*` ficam reservadas para essa operação futura.

## Procedimentos

| Método   | Rota                                                 | Permissão aplicada             |
| -------- | ---------------------------------------------------- | ------------------------------ |
| `GET`    | `/api/procedures` e `/api/procedures/:id`            | `procedures.read`              |
| `POST`   | `/api/procedures`                                    | `procedures.create`            |
| `PUT`    | `/api/procedures/:id`                                | `procedures.update`            |
| `DELETE` | `/api/procedures/:id`                                | `procedures.delete`            |
| `POST`   | `/api/procedures/:id/attachments`                    | `procedures.attachment.create` |
| `GET`    | `/api/procedures/:id/attachments/:attachmentId`      | `procedures.attachment.read`   |
| `PATCH`  | `/api/procedures/:id/attachments/:attachmentId/tags` | `procedures.attachment.update` |
| `DELETE` | `/api/procedures/:id/attachments/:attachmentId`      | `procedures.attachment.delete` |

## Skills

| Método  | Rota                                                                            | Permissão aplicada |
| ------- | ------------------------------------------------------------------------------- | ------------------ |
| `GET`   | `/api/skills`, `/api/skills/:skillId`, `/api/skills/:skillId/:version/download` | `skills.read`      |
| `POST`  | `/api/skills`                                                                   | `skills.publish`   |
| `PATCH` | `/api/skills/:skillId/:version/deprecate`                                       | `skills.deprecate` |

## Administração de identidade

A administração técnica de identidades e das próprias chaves usa as APIs do
Better Auth, as permissões do workspace `users.*`, `roles.*` e `api_keys.*` e, quando o
componente exige, a role técnica `admin`. `audit.read` permanece reservado para
uma futura consulta administrativa agregada. O bootstrap continua sendo um
comando local.

| Método   | Rota Bondia Workspaces                 | Permissão aplicada     |
| -------- | -------------------------------------- | ---------------------- |
| `GET`    | `/api/identity/users`                  | `users.read`           |
| `POST`   | `/api/identity/users`                  | `users.create`         |
| `PATCH`  | `/api/identity/users/:userId/disabled` | `users.disable`        |
| `PUT`    | `/api/identity/users/:userId/password` | `users.password.reset` |
| `DELETE` | `/api/identity/users/:userId/sessions` | `users.update`         |

As fachadas validam a permissão antes de delegar a operação ao Better Auth. As
rotas diretas `/api/auth/admin/*` também são filtradas por operação, e
`/api/auth/api-key/*` exige `api_keys.manage.self`.

## Histórico funcional

| Método | Rota                                            | Permissão aplicada |
| ------ | ----------------------------------------------- | ------------------ |
| `GET`  | `/api/audit/issue/:id`                          | `issues.read`      |
| `GET`  | `/api/audit/demand/:id` e `/api/audit/task/:id` | `demands.read`     |
| `GET`  | `/api/audit/procedure/:id`                      | `procedures.read`  |
| `GET`  | `/api/audit/taxonomy/:id`                       | `taxonomy.read`    |
| `GET`  | `/api/audit/skill/:id`                          | `skills.read`      |

A consulta é contextual: a leitura da entidade autoriza a leitura de sua
própria trilha. Não há consulta agregada nesta fase.
