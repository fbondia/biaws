# Grupos de permissões do Bondia Workspaces

Os grupos são armazenados em `permissionGroups` e os vínculos de usuários em
`workspaceMemberships`. O vínculo usa o `userId` canônico do Better Auth, mas não altera
`user.role`, sessões, contas ou credenciais.

As permissões efetivas são calculadas a cada autenticação como a união das
permissões dos grupos ativos associados ao usuário. Elas são acrescentadas ao
ator retornado por `GET /api/auth/me` nos campos `groups` e `permissions`.
Nenhuma permissão é copiada para o documento de sessão.

## Grupos iniciais

| Grupo                        | Matriz                                                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Administração                | Todo o catálogo canônico                                                                                                                                                  |
| Gestão de incidentes         | Todas as permissões `issues.*`, mais leitura de workspaces, aplicações e componentes                                                                                      |
| Gestão de melhorias          | Todas as permissões `demands.*` e `tasks.*`                                                                                                                               |
| Gestão de conhecimento       | Todas as permissões `taxonomy.*`, `documents.*` e `skills.*`                                                                                                              |
| Chamados                     | `issues.read`, `issues.status.update`, `issues.comment.create`, `issues.comment.update`, `issues.attachment.read`                                                         |
| Desenvolvimento de melhorias | `demands.read`, `demands.specification.update`, `demands.attachment.read`, `tasks.status.update`, `tasks.note.create`, `tasks.attachment.read`, `tasks.attachment.create` |

Para desenvolvimento de melhorias, “incluir especificações” usa
`demands.specification.update`, pois o modelo atual possui uma única operação de
substituição da especificação. Inclusão de arquivos permite criar e ler anexos,
mas não alterar tags nem excluir. As permissões `tasks.attachment.*` permanecem
reservadas enquanto não existem rotas diretas de anexos de tarefa.

## Ciclo de vida

- grupos de sistema são identificados por `system: true`, mas sua matriz pode ser
  ajustada administrativamente;
- nomes são únicos sem distinção de maiúsculas/minúsculas;
- grupos não são excluídos fisicamente: podem ser desativados;
- os vínculos de um grupo desativado são preservados, porém o grupo deixa de
  contribuir para as permissões efetivas;
- somente grupos existentes e ativos podem receber novas associações;
- reativar um grupo restaura seu efeito nos vínculos preservados;
- alterações de matriz aparecem na próxima resolução do ator, sem revogar ou
  regravar sessões do Better Auth.
- a replicação entre workspaces copia definição, permissões e escopo, mas nunca
  vínculos de usuários;
- escopos por aplicação são mapeados pela chave técnica da aplicação e a cópia
  é recusada quando o destino não possui todo o conjunto;
- grupos de sistema atualizam o grupo correspondente no destino pelo
  `systemKey`; grupos personalizados exigem um identificador e são criados ou
  substituídos por ele. O identificador é opcional para salvar, editável e único
  dentro do workspace.

A Fase 4 aplica as permissões no backend. A role técnica `admin` permanece apenas
como requisito interno adicional do Better Auth para administração de
identidades; não concede permissões de negócio.

Antes de ativar a autorização em uma base existente, execute novamente o
bootstrap. Ele associa o administrador técnico ativo ao grupo `Administração`
sem criar outra identidade.
