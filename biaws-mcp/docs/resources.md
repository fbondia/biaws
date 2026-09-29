# Resources hierárquicos do BIAWS

O MCP expõe `resources/list`, `resources/templates/list` e `resources/read`, além das tools existentes. As leituras usam somente a API HTTP, com o mesmo workspace, autorização, timeout e cancelamento das tools.

## Navegação

Configurar `BIAWS_WORKSPACE_ID`. A URI de um resource precisa usar esse workspace. `resources/list` fornece os pontos de entrada concretos; `resources/templates/list` descreve os padrões parametrizados. O conteúdo JSON inclui `uri` canônica e `links` para coleções, itens e páginas acessíveis. Buscar itens com as tools de domínio e seguir os `resource_link` retornados.

Exemplo de leitura:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "resources/read",
  "params": {
    "uri": "biaws://workspaces/workspace-id/issues/INC12345/comments?page=1&limit=25"
  }
}
```

Coleções paginadas aceitam `page` como inteiro positivo e `limit` de 1 a 100. Os links de página preservam o ID canônico. Resources de coleção retornam dados e links, sem carregar recursivamente todos os filhos. Revisões de documentos conservam o limite existente de 100 itens; observações e auditoria conservam seus limites existentes de até 200 itens.

## ID e identificador

A API procura primeiro pelo ID público usado pela rota e só então pelo identificador de negócio, dentro do mesmo escopo autorizado. Isso vale também para as escritas e para os filhos. As URIs aceitam ambas as referências, mas os links retornados usam IDs canônicos.

| Entidade                                                                      | Identificador alternativo                                                                                       |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Issue                                                                         | `identifier`, opcional; aceita códigos como `INC12345`. O campo `id` dos registros existentes permanece válido. |
| Melhoria                                                                      | `clientCode`                                                                                                    |
| Tarefa                                                                        | `code`, dentro da melhoria; comparação sem distinção de maiúsculas/minúsculas para manter compatibilidade       |
| Documento                                                                     | `identifier`                                                                                                    |
| Aplicação, componente, integração, repositório, servidor, deployment, runtime | `key`, no escopo autorizado; referências ambíguas exigem ID                                                     |
| Segredo                                                                       | `identifier`; leitura somente de metadados                                                                      |

Colisões entre ID e identificador são resolvidas a favor do ID. Identificadores duplicados retornam `409 AMBIGUOUS_REFERENCE`; itens ausentes ou fora do escopo retornam `404`. Comentários, notas e arquivos conservam seus próprios IDs. Referências compostas de runtime já existentes continuam funcionando.

## Classificação pelo agente

1. Ler o resource da issue e, quando relevantes, seus comentários e metadados de arquivos.
2. Seguir o link para `applications/{applicationId}/classification-catalog`.
3. Analisar os dados com o raciocínio do próprio agente e propor assuntos e tags existentes no catálogo, com justificativa.
4. Quando o usuário autorizar a gravação, chamar `issues_classify` e reler `/classification` para verificar o estado persistido.

O servidor não usa sampling nem integra uma LLM para esse fluxo. `issues_suggest_taxonomy` conserva sua busca lexical somente para compatibilidade; ela não faz parte do fluxo de classificação. Clientes sem resources podem usar `issues_get` e `issues_get_classification_catalog` e realizar a mesma análise.

## Arquivos

`files` lista metadados; `files/{fileId}` lê os metadados individuais; `files/{fileId}/content` lê conteúdo com MIME próprio, como texto ou blob Base64. Os resources de conteúdo têm limite de 10 MiB. Locators internos de storage não são retornados pelos endpoints novos de metadados.

Arquivos de tarefa usam `/api/requests/:id/tasks/:taskId/attachments`. A API aplica as permissões `tasks.attachment.*`, valida o vínculo e conserva a associação por tag do código da tarefa. O código precisa ser único dentro da melhoria para acessar arquivos associados. Essa regra é aplicada também ao upload, atualização de tags e exclusão; o MCP não a reimplementa.

## Catálogo de leitura

A API conserva `/api/requests`, `/api/knowledge/documents` e `/attachments`; a URI MCP usa `demands`, `documents` e `files`.

| Resource/template                                                                                                                                      | GET da API                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `biaws://workspaces`                                                                                                                                   | `/api/catalog/workspaces`                                               |
| `biaws://workspaces/{workspaceId}/issues`                                                                                                              | `/api/issues`                                                           |
| `biaws://workspaces/{workspaceId}/demands`                                                                                                             | `/api/requests`                                                         |
| `biaws://workspaces/{workspaceId}/documents`                                                                                                           | `/api/knowledge/documents`                                              |
| `biaws://workspaces/{workspaceId}/issues/{issueId}`                                                                                                    | `/api/issues/{issueId}?includeComments=false`                           |
| `biaws://workspaces/{workspaceId}/issues/{issueId}/comments`                                                                                           | `/api/issues/{issueId}/comments`                                        |
| `biaws://workspaces/{workspaceId}/issues/{issueId}/comments/{commentId}`                                                                               | `/api/issues/{issueId}/comments/{commentId}`                            |
| `biaws://workspaces/{workspaceId}/issues/{issueId}/classification`                                                                                     | `/api/issues/{issueId}/classification`                                  |
| `biaws://workspaces/{workspaceId}/demands/{demandId}`                                                                                                  | `/api/requests/{demandId}`                                              |
| `biaws://workspaces/{workspaceId}/demands/{demandId}/specification`                                                                                    | `/api/requests/{demandId}/specification`                                |
| `biaws://workspaces/{workspaceId}/demands/{demandId}/specification/sections/{sectionId}`                                                               | `/api/requests/{demandId}/specification/sections/{sectionId}`           |
| `biaws://workspaces/{workspaceId}/demands/{demandId}/checklist`                                                                                        | `/api/requests/{demandId}/checklist`                                    |
| `biaws://workspaces/{workspaceId}/demands/{demandId}/journeys`                                                                                         | `/api/requests/{demandId}/journeys`                                     |
| `biaws://workspaces/{workspaceId}/demands/{demandId}/notes`                                                                                            | `/api/requests/{demandId}/notes`                                        |
| `biaws://workspaces/{workspaceId}/demands/{demandId}/notes/{noteId}`                                                                                   | `/api/requests/{demandId}/notes/{noteId}`                               |
| `biaws://workspaces/{workspaceId}/demands/{demandId}/tasks`                                                                                            | `/api/requests/{demandId}/tasks`                                        |
| `biaws://workspaces/{workspaceId}/demands/{demandId}/tasks/{taskId}`                                                                                   | `/api/requests/{demandId}/tasks/{taskId}`                               |
| `biaws://workspaces/{workspaceId}/demands/{demandId}/tasks/{taskId}/notes`                                                                             | `/api/requests/{demandId}/tasks/{taskId}/notes`                         |
| `biaws://workspaces/{workspaceId}/demands/{demandId}/tasks/{taskId}/notes/{noteId}`                                                                    | `/api/requests/{demandId}/tasks/{taskId}/notes/{noteId}`                |
| `biaws://workspaces/{workspaceId}/demands/{demandId}/implementation-context`                                                                           | `/api/requests/{demandId}/implementation-context`                       |
| `biaws://workspaces/{workspaceId}/documents/{documentId}`                                                                                              | `/api/knowledge/documents/{documentId}`                                 |
| `biaws://workspaces/{workspaceId}/documents/{documentId}/content`                                                                                      | `/api/knowledge/documents/{documentId}/content`                         |
| `biaws://workspaces/{workspaceId}/documents/{documentId}/references`                                                                                   | `/api/knowledge/documents/{documentId}/references`                      |
| `biaws://workspaces/{workspaceId}/documents/{documentId}/revisions`                                                                                    | `/api/knowledge/documents/{documentId}/revisions`                       |
| `biaws://workspaces/{workspaceId}/documents/{documentId}/revisions/{revision}`                                                                         | `/api/knowledge/documents/{documentId}/revisions/{revision}`            |
| `biaws://workspaces/{workspaceId}/documents/{documentId}/observations`                                                                                 | `/api/knowledge/documents/{documentId}/observations`                    |
| `biaws://workspaces/{workspaceId}/documents/{documentId}/observations/{observationId}`                                                                 | `/api/knowledge/documents/{documentId}/observations/{observationId}`    |
| `biaws://workspaces/{workspaceId}/issues/{issueId}/files`                                                                                              | `/api/issues/{issueId}/attachments`                                     |
| `biaws://workspaces/{workspaceId}/issues/{issueId}/files/{fileId}`                                                                                     | `/api/issues/{issueId}/attachments/{fileId}/metadata`                   |
| `biaws://workspaces/{workspaceId}/issues/{issueId}/files/{fileId}/content`                                                                             | `/api/issues/{issueId}/attachments/{fileId}`                            |
| `biaws://workspaces/{workspaceId}/demands/{demandId}/files`                                                                                            | `/api/requests/{demandId}/attachments`                                  |
| `biaws://workspaces/{workspaceId}/demands/{demandId}/files/{fileId}`                                                                                   | `/api/requests/{demandId}/attachments/{fileId}/metadata`                |
| `biaws://workspaces/{workspaceId}/demands/{demandId}/files/{fileId}/content`                                                                           | `/api/requests/{demandId}/attachments/{fileId}`                         |
| `biaws://workspaces/{workspaceId}/demands/{demandId}/tasks/{taskId}/files`                                                                             | `/api/requests/{demandId}/tasks/{taskId}/attachments`                   |
| `biaws://workspaces/{workspaceId}/demands/{demandId}/tasks/{taskId}/files/{fileId}`                                                                    | `/api/requests/{demandId}/tasks/{taskId}/attachments/{fileId}/metadata` |
| `biaws://workspaces/{workspaceId}/demands/{demandId}/tasks/{taskId}/files/{fileId}/content`                                                            | `/api/requests/{demandId}/tasks/{taskId}/attachments/{fileId}`          |
| `biaws://workspaces/{workspaceId}/documents/{documentId}/files`                                                                                        | `/api/knowledge/documents/{documentId}/attachments`                     |
| `biaws://workspaces/{workspaceId}/documents/{documentId}/files/{fileId}`                                                                               | `/api/knowledge/documents/{documentId}/attachments/{fileId}/metadata`   |
| `biaws://workspaces/{workspaceId}/documents/{documentId}/files/{fileId}/content`                                                                       | `/api/knowledge/documents/{documentId}/attachments/{fileId}`            |
| `biaws://workspaces/{workspaceId}`                                                                                                                     | `/api/catalog/workspaces/{workspaceId}`                                 |
| `biaws://workspaces/{workspaceId}/applications`                                                                                                        | `/api/catalog/workspaces/{workspaceId}/applications`                    |
| `biaws://workspaces/{workspaceId}/applications/{applicationId}`                                                                                        | `/api/catalog/applications/{applicationId}`                             |
| `biaws://workspaces/{workspaceId}/applications/{applicationId}/context`                                                                                | `/api/catalog/applications/{applicationId}/context`                     |
| `biaws://workspaces/{workspaceId}/applications/{applicationId}/components`                                                                             | `/api/catalog/applications/{applicationId}/components`                  |
| `biaws://workspaces/{workspaceId}/applications/{applicationId}/components/{componentId}`                                                               | `/api/catalog/components/{componentId}`                                 |
| `biaws://workspaces/{workspaceId}/applications/{applicationId}/integrations`                                                                           | `/api/catalog/applications/{applicationId}/integrations`                |
| `biaws://workspaces/{workspaceId}/applications/{applicationId}/integrations/{integrationId}`                                                           | `/api/catalog/integrations/{integrationId}`                             |
| `biaws://workspaces/{workspaceId}/applications/{applicationId}/repositories`                                                                           | `/api/catalog/applications/{applicationId}/repositories`                |
| `biaws://workspaces/{workspaceId}/applications/{applicationId}/repositories/{repositoryId}`                                                            | `/api/catalog/repositories/{repositoryId}`                              |
| `biaws://workspaces/{workspaceId}/applications/{applicationId}/repositories/{repositoryId}/components`                                                 | `/api/catalog/repositories/{repositoryId}/components`                   |
| `biaws://workspaces/{workspaceId}/applications/{applicationId}/deployments`                                                                            | `/api/catalog/applications/{applicationId}/deployments`                 |
| `biaws://workspaces/{workspaceId}/applications/{applicationId}/deployments/{deploymentId}`                                                             | `/api/catalog/deployments/{deploymentId}`                               |
| `biaws://workspaces/{workspaceId}/applications/{applicationId}/deployments/{deploymentId}/publications`                                                | `/api/catalog/deployments/{deploymentId}/publications`                  |
| `biaws://workspaces/{workspaceId}/applications/{applicationId}/deployments/{deploymentId}/runtimes`                                                    | `/api/catalog/deployments/{deploymentId}/runtimes`                      |
| `biaws://workspaces/{workspaceId}/applications/{applicationId}/deployments/{deploymentId}/runtimes/{runtimeId}`                                        | `/api/catalog/runtimes/{runtimeId}`                                     |
| `biaws://workspaces/{workspaceId}/servers`                                                                                                             | `/api/catalog/workspaces/{workspaceId}/servers`                         |
| `biaws://workspaces/{workspaceId}/servers/{serverId}`                                                                                                  | `/api/catalog/servers/{serverId}`                                       |
| `biaws://workspaces/{workspaceId}/servers/{serverId}/runtimes`                                                                                         | `/api/catalog/servers/{serverId}/runtimes`                              |
| `biaws://workspaces/{workspaceId}/servers/{serverId}/deployments`                                                                                      | `/api/catalog/servers/{serverId}/deployments`                           |
| `biaws://workspaces/{workspaceId}/applications/{applicationId}/topology-diagrams`                                                                      | `/api/catalog/applications/{applicationId}/topology-diagrams`           |
| `biaws://workspaces/{workspaceId}/applications/{applicationId}/topology-diagrams/{diagramId}`                                                          | `/api/catalog/topology-diagrams/{diagramId}`                            |
| `biaws://workspaces/{workspaceId}/collections/{resourceType}`                                                                                          | `/api/resource-collections/{resourceType}`                              |
| `biaws://workspaces/{workspaceId}/secrets/{secretId}`                                                                                                  | `/api/secrets/{secretId}`                                               |
| `biaws://workspaces/{workspaceId}/classification-catalog`                                                                                              | `/api/issues/taxonomy`                                                  |
| `biaws://workspaces/{workspaceId}/document-types`                                                                                                      | `/api/knowledge/document-types`                                         |
| `biaws://workspaces/{workspaceId}/monitoring/runtime-topology`                                                                                         | `/api/monitoring/runtime-topology`                                      |
| `biaws://workspaces/{workspaceId}/monitoring/runtime-targets`                                                                                          | `/api/monitoring/runtime-targets`                                       |
| `biaws://workspaces/{workspaceId}/monitoring/metadata-profiles`                                                                                        | `/api/monitoring/metadata-profiles`                                     |
| `biaws://workspaces/{workspaceId}/monitoring/templates/{templateId}`                                                                                   | `/api/monitoring/templates/{templateId}`                                |
| `biaws://workspaces/{workspaceId}/monitoring/templates/{templateId}/versions/{version}`                                                                | `/api/monitoring/templates/{templateId}?version={version}`              |
| `biaws://workspaces/{workspaceId}/monitoring/templates/{templateId}/versions/{version}/contract`                                                       | `/api/monitoring/templates/{templateId}/versions/{version}/contract`    |
| `biaws://workspaces/{workspaceId}/monitoring/templates/{templateId}/versions/{version}/usage`                                                          | `/api/monitoring/templates/{templateId}/versions/{version}/usage`       |
| `biaws://workspaces/{workspaceId}/applications/{applicationId}/monitoring/health`                                                                      | `/api/monitoring/applications/{applicationId}/health`                   |
| `biaws://workspaces/{workspaceId}/applications/{applicationId}/deployments/{deploymentId}/runtimes/{runtimeId}/monitoring/active-monitors`             | `/api/monitoring/runtimes/{runtimeId}/active-monitors`                  |
| `biaws://workspaces/{workspaceId}/applications/{applicationId}/deployments/{deploymentId}/runtimes/{runtimeId}/monitoring/active-monitors/{monitorId}` | `/api/monitoring/runtimes/{runtimeId}/active-monitors/{monitorId}`      |
| `biaws://workspaces/{workspaceId}/audit/{entityType}/{entityId}`                                                                                       | `/api/audit/{entityType}/{entityId}`                                    |
| `biaws://workspaces/{workspaceId}/applications/{applicationId}/classification-catalog`                                                                 | `/api/issues/taxonomy?applicationId={applicationId}`                    |

## Compatibilidade

As tools atuais de leitura permanecem disponíveis. Tools de busca, filtros, agregação, simulação e escrita continuam sendo operações de domínio; a refatoração não transforma automaticamente toda rota GET em resource. O MCP não anuncia subscriptions nem notificações de atualização enquanto essas funcionalidades não forem implementadas.

As rotas agregadas da API mantêm o comportamento anterior. `includeComments=false` permite ler uma issue sem buscar toda a conversa. Novas rotas granulares de leitura retornam `context` com os IDs canônicos, `items` e `meta` para coleções ou `value` para itens.
