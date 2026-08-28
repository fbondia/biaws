# Índices e planos de consulta

Os repositórios criam índices idempotentemente quando o domínio é utilizado.
O bootstrap e o seed acionam os índices centrais; domínios opcionais criam os
seus na primeira operação.

## Índices críticos

| Fluxo                        | Prefixo do índice                                                              |
| ---------------------------- | ------------------------------------------------------------------------------ |
| aplicações                   | `workspaceId, name, id`; status exato usa variante com `status`                |
| componentes e repositórios   | `workspaceId, applicationId, name, id`; status exato usa variante com `status` |
| servidores                   | `workspaceId, name, id`; status exato usa variante com `status`                |
| deployments                  | `workspaceId, applicationId, deployedAt, id`                                   |
| runtimes no contexto         | `workspaceId, applicationId, name, id`                                         |
| sinais de um runtime         | `workspaceId, applicationId, runtimeId, observedAt, receivedAt`                |
| issues recentes              | `workspaceId, applicationId, dates.receivedEmailAt, updatedAt, id`             |
| melhorias ordenadas          | `workspaceId, applicationId, listRank, updatedAt, createdAt`                   |
| documentos por tipo e estado | `workspaceId, documentType, status, updatedAt`                                 |
| contexto de conhecimento     | `workspaceId, applicationId, updatedAt, id`                                    |
| auditoria por raiz           | `rootType, rootId, occurredAt`                                                 |
| configuração pessoal da home | `workspaceId, userId`                                                          |

Chaves naturais e IDs têm índices únicos onde o contrato exige unicidade.
Em particular, `issues.id` é único para impedir duplicação em criações
concorrentes; violações retornam `409`.

## Como validar

Use uma cópia representativa, nunca o banco de produção para experimentos:

```javascript
const workspaceId = "workspace-id";
const applicationId = "application-id";

db.issues
  .find({ workspaceId, applicationId })
  .sort({ "dates.receivedEmailAt": -1, updatedAt: -1, id: 1 })
  .limit(25)
  .explain("executionStats");
```

Repita para melhorias e documentos:

```javascript
db.requests
  .find({ workspaceId, applicationId })
  .sort({ listRank: -1, updatedAt: -1, createdAt: -1 })
  .limit(25)
  .explain("executionStats");

db.documents
  .find({ workspaceId, documentType: "procedure", status: "published" })
  .sort({ updatedAt: -1 })
  .limit(25)
  .explain("executionStats");
```

Critérios de revisão:

- o plano usa `IXSCAN` no conjunto representativo;
- não há estágio `SORT` bloqueante para a ordenação padrão;
- `totalDocsExamined` permanece próximo de `nReturned`;
- `totalKeysExamined` cresce de forma compatível com filtros e paginação;
- nenhum plano perde o prefixo `workspaceId`.

Em bases muito pequenas, o otimizador pode preferir `COLLSCAN`; confirme a
compatibilidade do índice com `hint()` e repita o teste com volume
representativo antes de concluir que há regressão.

## Registro da fase 7

Em 2026-07-29, a instalação Docker limpa foi validada com MongoDB 7. O
inventário confirmou índices compostos com `workspaceId` nos domínios de
catálogo, conhecimento, listas, taxonomia e autorização; as consultas críticas
foram exercitadas com paginação e os índices de ordenação acima.

No seed final, os planos com `hint()` retornaram `IXSCAN`, sem estágio `SORT`:

| Consulta                      | retornados | chaves examinadas | documentos examinados |
| ----------------------------- | ---------: | ----------------: | --------------------: |
| aplicações                    |          2 |                 2 |                     2 |
| componentes                   |          1 |                 1 |                     1 |
| issues                        |          1 |                 1 |                     1 |
| melhorias                     |          1 |                 1 |                     1 |
| documentos                    |          1 |                 1 |                     1 |
| deployments e runtimes vazios |          0 |                 0 |                     0 |

Índices antigos, cujas chaves sejam prefixos de índices novos, podem permanecer
após atualização de uma base existente. Revise `getIndexes()` e remova somente
os redundantes após comparar planos e uso em uma cópia restaurada.
