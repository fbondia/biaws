# Guidelines de desenvolvimento

Estas diretrizes registram como evoluir o Bondia Workspaces sem romper suas
fronteiras arquiteturais, de segurança e operação. Elas complementam a
[arquitetura](../architecture.md), os documentos de cada módulo e o
[guia de contribuição](../../CONTRIBUTING.md).

Use este índice antes de implementar ou revisar uma mudança. Código existente é
uma referência útil, mas não prevalece sobre uma regra explícita documentada
aqui.

## Princípios

1. `workspaceId` é a fronteira primária de isolamento.
2. UI, MCP e CLI usam a API; somente a API acessa MongoDB e storage.
3. Autorização é aplicada no backend e nunca delegada ao cliente.
4. Contratos públicos devem ser explícitos, limitados e compatíveis.
5. Mutações relevantes têm validação, autorização, auditoria e testes.
6. Dependências novas exigem necessidade e responsabilidade claras.
7. Documentação e testes fazem parte da mudança, não são acabamento posterior.

## Mapa

| Documento                                              | Quando consultar                                               |
| ------------------------------------------------------ | -------------------------------------------------------------- |
| [Fronteiras arquiteturais](architecture-boundaries.md) | Ao criar módulos, mover responsabilidades ou ligar componentes |
| [Nomenclatura e estrutura](naming-and-structure.md)    | Ao criar ou dividir arquivos e componentes                     |
| [Dependências](dependencies.md)                        | Antes de adicionar ou substituir uma biblioteca                |
| [API e dados](api-and-data.md)                         | Ao criar rotas, repositories, índices, migrações ou storage    |
| [Desenvolvimento de UI](ui-development.md)             | Ao criar telas, componentes, hooks, modelos e estilos          |
| [MCP e CLI](mcp-and-cli.md)                            | Ao expor capacidades para agentes ou linha de comando          |
| [Testes](testing.md)                                   | Ao planejar e validar qualquer mudança comportamental          |
| [Logging e auditoria](logging-and-audit.md)            | Ao tratar erros, telemetria ou mutações de negócio             |
| [Segurança](security.md)                               | Ao lidar com identidade, escopo, uploads ou dados sensíveis    |
| [Code review](code-review.md)                          | Ao revisar uma alteração ou preparar um pull request           |
| [Checklist de mudança](change-checklist.md)            | Antes de considerar uma implementação concluída                |

## Código para documentação

Ao alterar uma área, revise também os documentos relacionados. Nem toda mudança
exige editar a documentação, mas a decisão deve ser consciente.

| Área alterada                         | Documentação relacionada                                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `biaws-api/src/auth/`                 | `biaws-api/docs/authentication.md`, `authorization.md`, `authorization-scopes.md` e `permission-groups.md` |
| `biaws-api/src/routes/`               | README da API e inventário/contrato do domínio afetado                                                     |
| `biaws-api/src/repositories/`         | `docs/architecture.md`, `docs/performance.md` e documento do domínio                                       |
| `biaws-api/src/logging/` ou auditoria | `docs/operations.md`, `biaws-api/docs/functional-audit.md` e estas guidelines                              |
| `biaws-api/src/storage/`              | `docs/architecture.md` e `docs/operations.md`                                                              |
| `biaws-ui/src/components/`            | documento funcional correspondente e, para estilos, `biaws-ui/src/styles/README.md`                        |
| `biaws-mcp/src/`                      | `biaws-mcp/README.md` e catálogo da capacidade afetada                                                     |
| `biaws-cli/src/`                      | `biaws-cli/README.md` e runbook, se houver efeito operacional                                              |
| `shared/`                             | contratos dos consumidores e documentos de autorização/domínio                                             |
| `scripts/`, `docker/` ou Compose      | `README.md`, `QUICKSTART.md` e `docs/operations.md`                                                        |
| `.github/workflows/`                  | `CONTRIBUTING.md` e comandos de validação documentados                                                     |

## Fonte de verdade

- arquitetura e invariantes: `docs/architecture.md` e estas guidelines;
- contrato de um módulo: README e documentação mantidos junto dele;
- comportamento executável: código e testes;
- operação: `docs/operations.md`;
- status e limitações conhecidas: `docs/project-status.md`.

Se documentação e implementação divergirem, não normalize a divergência em
silêncio. Corrija a parte errada ou registre explicitamente a limitação.
