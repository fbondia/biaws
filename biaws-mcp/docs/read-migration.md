# Migração de tools de leitura (MCP-SERVER-REVIEW-T04)

Mudança incompatível prevista para a próxima publicação: 119 → 100 tools. São
retiradas 21 leituras redundantes e adicionadas duas operações de EML local no
host. A retirada é intencional após a preservação de contratos em T01/T02. Não
há aliases de tools. Os contratos preservados conservam nomes, schemas,
descrições e ordem relativa.
Resources passam de 77 para 84 templates, com sete entradas diretas para preservar
as permissões das entidades sem exigir leitura de ancestrais. Versão do pacote
não é alterada por esta tarefa; não houve publicação.

`W` abaixo significa `biaws://workspaces/{workspaceId}`, com o workspace da
configuração. Descobrir templates com `resources/templates/list`; `resources/list`
inclui entradas concretas quando o workspace está configurado. Usar ID público
ou identificador autorizado; a resposta e os links usam o ID canônico.

## Matriz de leituras

| Tool anterior                        | Resource/template                                                 | Equivalência e decisão                                                                                                            |
| ------------------------------------ | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `workspaces_list`                    | `biaws://workspaces`                                              | Mesmo GET, dados, credencial e workspace; retirar.                                                                                |
| `workspaces_get`                     | `W`                                                               | Mesmo GET, dados, credencial e workspace; retirar.                                                                                |
| `applications_list`                  | Parcial ou inexistente                                            | Manter: Busca/lista com filtros de domínio e/ou escopo explícito; resource expõe somente navegação sem esses filtros.             |
| `applications_get`                   | `W/applications/{applicationId}`                                  | Mesmo GET, dados, credencial e workspace; retirar.                                                                                |
| `applications_get_context`           | Parcial ou inexistente                                            | Manter: Contexto agregado com limit e includeArchived; resource oferece apenas snapshot padrão.                                   |
| `components_list`                    | Parcial ou inexistente                                            | Manter: Busca/lista com filtros de domínio e/ou escopo explícito; resource expõe somente navegação sem esses filtros.             |
| `components_get`                     | `W/components/{componentId}`                                      | GET direto com a mesma permissão; nova entrada resource evita permissões adicionais de ancestrais. Retirar.                       |
| `integrations_list`                  | Parcial ou inexistente                                            | Manter: Busca/lista com filtros de domínio e/ou escopo explícito; resource expõe somente navegação sem esses filtros.             |
| `integrations_get`                   | `W/integrations/{integrationId}`                                  | GET direto com a mesma permissão; nova entrada resource evita permissões adicionais de ancestrais. Retirar.                       |
| `repositories_list`                  | Parcial ou inexistente                                            | Manter: Busca/lista com filtros de domínio e/ou escopo explícito; resource expõe somente navegação sem esses filtros.             |
| `repositories_get`                   | `W/repositories/{repositoryId}`                                   | GET direto com a mesma permissão; nova entrada resource evita permissões adicionais de ancestrais. Retirar.                       |
| `servers_list`                       | Parcial ou inexistente                                            | Manter: Busca/lista com filtros de domínio e/ou escopo explícito; resource expõe somente navegação sem esses filtros.             |
| `servers_get`                        | `W/servers/{serverId}`                                            | Mesmo GET, dados, credencial e workspace; retirar.                                                                                |
| `deployments_list`                   | Parcial ou inexistente                                            | Manter: Busca/lista com filtros de domínio e/ou escopo explícito; resource expõe somente navegação sem esses filtros.             |
| `deployments_get`                    | `W/deployments/{deploymentId}`                                    | GET direto com a mesma permissão; nova entrada resource evita permissões adicionais de ancestrais. Retirar.                       |
| `runtimes_list`                      | Parcial ou inexistente                                            | Manter: Busca/lista com filtros de domínio e/ou escopo explícito; resource expõe somente navegação sem esses filtros.             |
| `runtimes_get`                       | `W/runtimes/{runtimeId}`                                          | GET direto com a mesma permissão; nova entrada resource evita permissões adicionais de ancestrais. Retirar.                       |
| `resource_collections_list`          | `W/collections/{resourceType}`                                    | Mesmo GET, dados, credencial e workspace; retirar.                                                                                |
| `secrets_list`                       | Parcial ou inexistente                                            | Manter: Busca/lista com filtros de domínio e/ou escopo explícito; resource expõe somente navegação sem esses filtros.             |
| `secrets_get`                        | `W/secrets/{secretId}`                                            | Mesmo GET, dados, credencial e workspace; retirar.                                                                                |
| `knowledge_context_load`             | Parcial ou inexistente                                            | Manter: Composição de documentos atuais por aplicação/componente com includeMarkdown e limite; não equivale a um item.            |
| `document_types_list`                | Parcial ou inexistente                                            | Manter: Enriquece catálogo com context e commonRules; resource da API contém apenas contratos básicos.                            |
| `documents_search`                   | Parcial ou inexistente                                            | Manter: Busca/lista com filtros de domínio e/ou escopo explícito; resource expõe somente navegação sem esses filtros.             |
| `documents_get`                      | `W/documents/{documentId}`                                        | Mesmo GET, dados, credencial e workspace; retirar.                                                                                |
| `documents_list_revisions`           | `W/documents/{documentId}/revisions`                              | Mesmo GET, dados, credencial e workspace; retirar.                                                                                |
| `documents_list_observations`        | `W/documents/{documentId}/observations`                           | Mesmo GET, dados, credencial e workspace; retirar.                                                                                |
| `audit_events_list`                  | Parcial ou inexistente                                            | Manter: Limit até 200, entidade tipada; resource MCP permite limit até 100. Histórico limitado, sem paginação real.               |
| `monitoring_runtime_topology_get`    | `W/monitoring/runtime-topology`                                   | Mesmo GET, dados, credencial e workspace; retirar.                                                                                |
| `monitoring_runtime_targets_list`    | `W/monitoring/runtime-targets`                                    | Mesmo GET, dados, credencial e workspace; retirar.                                                                                |
| `monitoring_metadata_profiles_list`  | `W/monitoring/metadata-profiles`                                  | Mesmo GET, dados, credencial e workspace; retirar.                                                                                |
| `applications_monitoring_health_get` | Parcial ou inexistente                                            | Manter: includeConfigured altera o snapshot; resource oferece apenas padrão.                                                      |
| `runtime_monitoring_signals_list`    | Parcial ou inexistente                                            | Manter: Filtros por status/datas e paginação; sem resource equivalente.                                                           |
| `monitoring_templates_list`          | Parcial ou inexistente                                            | Manter: Busca/lista com filtros de domínio e/ou escopo explícito; resource expõe somente navegação sem esses filtros.             |
| `monitoring_templates_get`           | `W/monitoring/templates/{templateId}`                             | Sem versão: este template; com versão: /versions/{version}. Mesmo GET/version e dados. Retirar.                                   |
| `monitoring_templates_get_usage`     | `W/monitoring/templates/{templateId}/versions/{version}/usage`    | Mesmo GET, dados, credencial e workspace; retirar.                                                                                |
| `monitoring_templates_get_contract`  | `W/monitoring/templates/{templateId}/versions/{version}/contract` | Mesmo GET, dados, credencial e workspace; retirar.                                                                                |
| `runtime_monitoring_results_list`    | Parcial ou inexistente                                            | Manter: Timeline com filtros por datas/status e paginação; sem resource equivalente.                                              |
| `runtime_monitoring_health_summary`  | Parcial ou inexistente                                            | Manter: Agregação temporal com resolution/maxPoints e filtros; sem resource equivalente.                                          |
| `runtime_active_monitors_list`       | `W/runtimes/{runtimeId}/monitoring/active-monitors`               | GET direto com a mesma permissão; nova entrada resource evita permissões adicionais de ancestrais. Retirar.                       |
| `issues_search`                      | Parcial ou inexistente                                            | Manter: Busca/lista com filtros de domínio e/ou escopo explícito; resource expõe somente navegação sem esses filtros.             |
| `issues_get`                         | Parcial ou inexistente                                            | Manter: Projeção agregada com comentários e anexos embutidos; item resource os separa em coleções paginadas.                      |
| `issues_get_classification_catalog`  | Parcial ou inexistente                                            | Manter: Projeção flatten com IDs/caminhos e opções derivadas; resource retorna catálogo bruto.                                    |
| `issues_summary`                     | Parcial ou inexistente                                            | Manter: Agregação do resultado com agrupamentos e filtros.                                                                        |
| `issues_aggregate`                   | Parcial ou inexistente                                            | Manter: Agregação do resultado com agrupamentos e filtros.                                                                        |
| `issues_suggest_taxonomy`            | Parcial ou inexistente                                            | Manter: Avaliação lexical de texto sobre taxonomia; nenhuma leitura resource equivalente.                                         |
| `issues_by_taxonomy`                 | Parcial ou inexistente                                            | Manter: Busca filtrada por assunto e escopo; coleção resource não aceita esses filtros.                                           |
| `demands_list`                       | Parcial ou inexistente                                            | Manter: Busca/lista com filtros de domínio e/ou escopo explícito; resource expõe somente navegação sem esses filtros.             |
| `demands_get`                        | Parcial ou inexistente                                            | Manter: Projeção agregada completa de especificação, checklist, jornadas, notas, tarefas e anexos; item resource é cadastral.     |
| `demands_journey_calendar`           | Parcial ou inexistente                                            | Manter: Agregação de jornadas entre meses após varrer páginas e aplicar filtros.                                                  |
| `demands_deadlines`                  | Parcial ou inexistente                                            | Manter: Projeção calculada de prazos e atrasos por referenceDate e filtros.                                                       |
| `demands_implementation_context`     | Parcial ou inexistente                                            | Manter: Calcula resumo de jornadas e specification.byTitle e aceita includeNotes; resource da API tem outra estrutura.            |
| `demands_list_tasks`                 | Parcial ou inexistente                                            | Manter: Filtro status com validação das listas vigentes e projeção completa sem paginação; resource MCP aceita apenas page/limit. |

Mutações e avaliações POST permanecem tools. As permissões continuam nas rotas da
API: workspaces.read, applications.read, components.read, integrations.read,
repositories.read, servers.read, deployments.read, runtimes.read, documents.read,
secrets.read e a permissão específica do tipo de coleção. O MCP transmite a mesma
credencial e o cabeçalho de workspace; não amplia permissões. Entradas diretas de
topologia fazem um GET, enquanto os caminhos hierárquicos continuam validando os
ancestrais. Identificadores ambíguos preservam a rejeição da API.

## Caminhos e opções

- Template completo de uma versão: `W/monitoring/templates/{templateId}/versions/{version}`.
  Contrato e uso ficam nos filhos `/contract` e `/usage`. IDs opacos de template
  podem conter `/`, codificado como `%2F`; segmentos vazios, pontos e controles são
  rejeitados. A definição e as versões são preservadas na resposta.
- Monitores: `W/runtimes/{runtimeId}/monitoring/active-monitors?page=2&limit=10`.
  Aceita ID/key ou referência composta existente; meta.runtimeId canoniza a URI.
  Seguir os links para `{monitorId}` e para páginas seguintes.
- Componentes, integrações, repositórios, deployments e runtimes: buscar com a
  tool filtrada, seguir resource_link direto e ler o item sem uma permissão extra
  de applications.read ou deployments.read.
- Documento: item completo com Markdown e relações; `/content`, `/references`,
  `/revisions` e `/observations` são leituras específicas. Revisões mantêm até
  100 e observações até 200 itens no endpoint existente, sem novos limites.
- Clientes sem resources precisam ser atualizados. As exceções agregadas não
  substituem as tools retiradas nem funcionam como aliases.

## Validação

Cliente oficial verifica ausência e TOOL_NOT_FOUND para todos os nomes retirados,
descoberta e equivalência de GET/dados/opções dos templates substitutos, resolução
canônica de IDs/key, headers de workspace/autorização, negação da API, tenancy,
item ausente e cancelamento. A comparação do catálogo exige os mesmos contratos
para todas as tools remanescentes.
