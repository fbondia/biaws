# Bondia Workspaces MCP

Servidor MCP para agentes consultarem e atualizarem, de forma controlada, a base de conhecimento operacional mantida pelo `biaws-api`.

O transporte stdio usa o SDK oficial `@modelcontextprotocol/server` 2.2.0,
com compatibilidade para clientes MCP de 2024/2025 e 2026. A matriz de
protocolos e a validação com cliente oficial estão em [releasing.md](docs/releasing.md).

O servidor separa os domínios:

- `workspaces_*`, `applications_*`, `components_*`, `repositories_*`,
  `servers_*`, `deployments_*` e `runtimes_*`: catálogo de aplicações e
  topologia operacional.
- `issues_*`: chamados, incidentes, requisições operacionais, taxonomia e classificação.
- `demands_*`: melhorias, especificações, jornadas, prazos e contexto para desenvolvimento.
- `documents_*`: regras, decisões, guidelines, features, referências técnicas e
  procedimentos relacionados ao workspace, a aplicações e a componentes.
- `knowledge_context_load`: regras ativas e decisões aceitas para o contexto
  solicitado.
- `attachments_*`: envio, download, classificação e exclusão de arquivos de
  chamados, melhorias, tarefas e documentos.
- `secrets_*`: consulta e registro de metadados de segredos, sem acesso aos valores.
- `monitoring_templates_*`, `runtime_active_monitors_*` e
  `runtime_monitoring_results_list`: administração versionada de templates,
  configuração de monitores e consulta do histórico dos runtimes.
- `resource_collections_*` e `*_move_to_collection`: organização hierárquica
  de aplicações, documentos, melhorias, segredos, skills e servidores.

O carregamento de ambiente é autocontido no pacote. Em um checkout, ele preserva
o fallback para o `.env` da raiz; no pacote publicado, usa o `.env` local ou o
arquivo indicado por `BIAWS_ENV_FILE`. O MCP conversa com a `biaws-api` por HTTP
e não acessa diretamente o mecanismo de armazenamento.

Em instalações multi-instância, `BIAWS_ENV_FILE` aponta para
`instances/<nome>/.env`. Esse arquivo tem precedência sobre o `.env` da raiz e
permite que várias instâncias compartilhem o mesmo clone do código. Ele contém
a URL e a credencial da instância, mas não seleciona o workspace.

Por padrão, a API é buscada em `http://127.0.0.1:3100`. Para apontar para outro endereço, use uma das variáveis:

- `BIAWS_API_URL`
- `BIAWS_API_BASE_URL`
- `VITE_BIAWS_API_URL`

Defina obrigatoriamente `BIAWS_API_KEY`. O bootstrap open source cria uma
identidade técnica e grava sua chave no `.env` local; uma chave também pode ser
criada manualmente pela UI. O MCP a envia como `Authorization: Bearer`.

Defina `BIAWS_WORKSPACE_ID` no bloco `env` do servidor MCP local ao projeto. O
MCP preserva esse valor mesmo ao carregar `BIAWS_ENV_FILE` e o envia como
`X-Biaws-Workspace-Id`; argumentos das tools não ampliam esse escopo. A chave
precisa pertencer ao workspace — selecionar o ID não concede permissões.

Chamadas HTTP são interrompidas após 15 segundos por padrão. Defina
`BIAWS_MCP_HTTP_TIMEOUT_MS` para alterar esse limite, até o máximo de 120
segundos. O timeout cobre tanto a conexão quanto a leitura do corpo da resposta.
Leituras com falhas transitórias (`429`, `502`, `503` ou `504`) recebem até duas
novas tentativas com backoff; `BIAWS_MCP_HTTP_RETRIES` configura esse número
entre zero e três. Escritas, autenticação, autorização e validação nunca são
repetidas automaticamente.

Arquivos enviados ou baixados pelo MCP têm limite padrão de 10 MiB. Defina
`BIAWS_MCP_MAX_ATTACHMENT_BYTES` para reduzir ou elevar esse limite, respeitado
o teto de 50 MiB do MCP e o limite independente configurado na API.

## Resources e classificação

O servidor também expõe resources hierárquicos para ler itens, comentários, tarefas, notas, documentos e arquivos. Consulte o [catálogo de resources e endpoints](docs/resources.md). A API aceita ID ou identificador de negócio nos parâmetros aplicáveis; as tools existentes permanecem disponíveis para compatibilidade.

A classificação é proposta pelo agente após ler a issue e o catálogo aplicável como resources. `issues_classify` grava o resultado autorizado; o servidor não solicita sampling.

## Instalação e execução

O pacote público expõe o executável `biaws-mcp`. Clientes configurados pelo CLI
usam uma versão fixada por meio do cache local do npm:

```bash
npx --yes biaws-mcp@0.11.0
```

Também é possível instalá-lo explicitamente:

```bash
npm install --global biaws-mcp@0.11.0
biaws-mcp
```

O processo continua usando transporte MCP `stdio`; somente as chamadas para a
`biaws-api` atravessam a rede.

### Desenvolvimento pelo checkout

Suba a `biaws-api` em outro terminal e execute:

```bash
npm ci
npm run check
npm run build
npm start
```

O código e os testes usam TypeScript em modo `strict`. `npm run check` verifica
ambos; `npm test` compila e executa somente os testes gerados em `dist/test`.
O pacote publicado contém `dist/src` e o pequeno bootstrap JavaScript em `bin`;
a instalação não depende do compilador TypeScript. Os scripts de build e de
empacotamento continuam em JavaScript e não integram a lógica do servidor.

Em um cliente MCP, configure o comando:

```bash
npx --yes biaws-mcp@0.11.0
```

O fluxo recomendado é gerar a configuração completa com:

```bash
BIAWS_ENV_FILE=/caminho/para/instances/minha-instancia/.env \
biaws workspace agent configure codex \
  --project /caminho/do/projeto --workspace id-do-workspace
```

O processo de publicação e rollback está em
[`docs/releasing.md`](docs/releasing.md).

## Diagnóstico do transporte

A partir da versão 0.5.0, o processo escreve um evento JSON por linha em
`stderr`. O `stdout` permanece exclusivo para frames JSON-RPC do MCP. Cada
execução recebe um `executionId` e cada chamada de tool recebe um `requestId`,
permitindo correlacionar ciclo de vida, duração, tentativas HTTP, cancelamento e
falhas de processo sem registrar argumentos, respostas ou credenciais.

Os eventos principais são:

- `mcp_server_started`, `mcp_shutdown_requested` e `mcp_server_stopped`;
- `mcp_tool_call_started`, `mcp_tool_call_completed`,
  `mcp_tool_call_failed` e `mcp_tool_call_cancelled`;
- `mcp_http_attempt_completed`, `mcp_http_attempt_failed` e
  `mcp_http_retry_scheduled`;
- `mcp_input_error`, `mcp_stdout_error`, `mcp_uncaught_exception` e
  `mcp_unhandled_rejection`.

`BIAWS_MCP_LOG_LEVEL` aceita `debug`, `info`, `warn` ou `error` e usa `info` por
padrão. O nível `debug` também registra o início de cada tentativa HTTP. O MCP
seleciona somente origem, método, status, duração e dados de correlação; URLs
completas, query strings, headers, argumentos, payloads e valores de ambiente
não são emitidos.

Para investigar `Transport closed`, preserve o `stderr` do processo configurado
pelo cliente MCP e procure, usando o mesmo `executionId`, por
`mcp_stdout_error`, eventos fatais, sinais ou encerramentos sem
`mcp_server_stopped`. Um `mcp_tool_call_failed` com resposta MCP válida indica
falha funcional ou da API, não fechamento do transporte.

## Ferramentas

### Catálogo e contexto de aplicações

As consultas do catálogo são:

- `resources/read` de `biaws://workspaces` e `resources/read` de `biaws://workspaces/{workspaceId}`;
- `applications_list`, `resources/read` de `biaws://workspaces/{workspaceId}/applications/{applicationId}` e
  `applications_get_context`;
- `components_list` e `resources/read` de `biaws://workspaces/{workspaceId}/components/{componentId}`;
- `integrations_list` e `resources/read` de `biaws://workspaces/{workspaceId}/integrations/{integrationId}`;
- `repositories_list` e `resources/read` de `biaws://workspaces/{workspaceId}/repositories/{repositoryId}`;
- `servers_list` e `resources/read` de `biaws://workspaces/{workspaceId}/servers/{serverId}`;
- `deployments_list` e `resources/read` de `biaws://workspaces/{workspaceId}/deployments/{deploymentId}`;
- `runtimes_list` e `resources/read` de `biaws://workspaces/{workspaceId}/runtimes/{runtimeId}`.

As escritas estruturadas são:

- `applications_create` e `applications_update`;
- `components_create` e `components_update`;
- `integrations_create` e `integrations_update`;
- `repositories_create` e `repositories_update`;
- `servers_create` e `servers_update`;
- `deployments_create`, `deployments_update` e
  `deployments_record_publication`;
- `runtimes_create` e `runtimes_update`.

As ferramentas de escrita usam `POST` ou `PATCH` da API e, portanto, herdam
suas validações de escopo, relações, permissões e auditoria. Integrações
apontam para outra aplicação ativa do mesmo workspace e preservam o destino
imutável. Arquivamento não
é exposto pelo MCP nesta fase.

### Monitoramento

Templates de monitoramento usam o workspace selecionado na configuração do
servidor MCP e preservam as permissões, validações e auditoria da API:

- `monitoring_templates_list` e `resources/read` de `biaws://workspaces/{workspaceId}/monitoring/templates/{templateId}`: consultam templates
  e versões;
- `monitoring_templates_preview`: testa uma definição com uma amostra JSON sem
  persistir;
- `monitoring_templates_create` e `monitoring_templates_create_version`: criam
  a versão inicial ou uma nova versão em rascunho;
- `resources/read` de `biaws://workspaces/{workspaceId}/monitoring/templates/{templateId}/versions/{version}/usage` e `resources/read` de `biaws://workspaces/{workspaceId}/monitoring/templates/{templateId}/versions/{version}/contract`:
  consultam uso e contrato público;
- `monitoring_templates_validate`: avalia uma amostra com uma versão persistida
  sem registrar observação;
- `monitoring_templates_activate` e `monitoring_templates_deactivate`: alteram
  o estado da versão;
- `monitoring_templates_archive`: arquiva somente uma versão sem uso, conforme
  validação da API.

Monitoramentos ativos são configurados por referência pública ou ID do runtime:

- `resources/read` de `biaws://workspaces/{workspaceId}/runtimes/{runtimeId}/monitoring/active-monitors`;
- `runtime_active_monitors_create`;
- `runtime_active_monitors_update`;
- `runtime_active_monitors_archive`.

`runtime_monitoring_results_list` consulta o histórico unificado de observações
ativas, passivas e manuais. `observedFrom` e `observedTo` aceitam uma data
`YYYY-MM-DD` ou um instante ISO 8601; datas sem horário preservam a semântica de
dia inteiro no limite final.

`runtime_monitoring_health_summary` consulta períodos extensos sem transferir
todo o histórico. A tool agrega uma série por monitoramento, preserva o pior
estado observado em cada intervalo e escolhe uma resolução compatível com
`maxPoints` (50 a 1.000). Sem intervalo explícito, resume os últimos 30 dias.
Use o resumo para tendências e `runtime_monitoring_results_list` para abrir os
eventos detalhados dos intervalos relevantes.

As tools não aceitam `workspaceId`; o escopo vem exclusivamente de
`BIAWS_WORKSPACE_ID`. Configurações REST podem referenciar segredos apenas por
identificadores públicos em `headerRefs`; valores de credenciais não pertencem
ao MCP. Templates são permitidos somente para o provider REST. Para preparar um
monitor antes de provisionar o executor, crie-o com `enabled: false`.

### Coleções de recursos

- `resources/read` de `biaws://workspaces/{workspaceId}/collections/{resourceType}`: lista a árvore de um tipo de recurso;
- `resource_collections_create`: cria uma coleção na raiz ou sob outra coleção;
- `resource_collections_update`: renomeia ou reparenta uma coleção;
- `resource_collections_delete`: exclui somente uma coleção vazia, sem
  subcoleções nem itens vinculados;
- `applications_move_to_collection`, `servers_move_to_collection`,
  `secrets_move_to_collection`, `skills_move_to_collection`,
  `demands_move_to_collection` e `documents_move_to_collection`: movem um item
  para uma coleção validada ou
  para a raiz quando `collectionId` é vazio.

As quatro ferramentas `resource_collections_*` aceitam `resourceType` com os
valores `applications`, `demands`, `documents`, `secrets`, `skills` ou
`servers`. Todas as mutações mantêm as validações contra ciclos,
escopo do workspace, permissões e auditoria da API.

`applications_get_context` entrega, em uma única consulta, a aplicação,
integrações, componentes, repositórios, deployments, runtimes, servidores referenciados e
resumos de issues, melhorias e documentos associados. O argumento `limit`
vale separadamente para cada grupo, tem teto de 100 e padrão 25. O resultado
informa totais e truncamentos e não contém credenciais, endereços dos
servidores, metadata dos runtimes, anexos nem os textos extensos da base de
conhecimento.

### Histórico de documentos

- `resources/read` de `biaws://workspaces/{workspaceId}/documents/{documentId}/revisions`: consulta até 100 revisões mais recentes.
- `resources/read` de `biaws://workspaces/{workspaceId}/documents/{documentId}/observations`: consulta até 200 observações mais recentes.

Ambas exigem `documentId` e preservam a autorização da API. Esses endpoints
não oferecem paginação.

### Consultas de monitoramento

- `resources/read` de `biaws://workspaces/{workspaceId}/monitoring/runtime-topology`: consulta a topologia monitorada.
- `resources/read` de `biaws://workspaces/{workspaceId}/monitoring/runtime-targets`: lista os alvos de runtime monitorados.
- `resources/read` de `biaws://workspaces/{workspaceId}/monitoring/metadata-profiles`: lista os perfis de apresentação de
  metadados; exige leitura de runtimes no escopo de workspace.
- `applications_monitoring_health_get`: consulta a saúde consolidada de uma
  aplicação; `includeConfigured` inclui runtimes com monitores configurados
  mesmo sem resultados recebidos (padrão `false`).
- `runtime_monitoring_signals_list`: lista sinais passivos/externos por runtime,
  período e status, com `page` (padrão 1) e `limit` (padrão 50, máximo 100).
  Para resultados de monitores ativos, use `runtime_monitoring_results_list`.

Topologia, alvos e perfis retornam o conjunto acessível fornecido pela API, sem
paginação. As consultas usam o workspace configurado no MCP.

### Auditoria

- `audit_events_list`: consulta os eventos mais recentes de uma entidade, com
  `entityType`, `entityId` e `limit` (padrão 100, máximo 200). Usa a permissão
  de leitura e o escopo da entidade. A API não oferece paginação deste histórico.

### Issues / chamados

- `issues_search`: busca issues com os mesmos filtros principais da
  `biaws-api`, inclusive por workspace, aplicação e componente afetado.
- `issues_get`: obtém uma issue com comentários e metadados dos anexos.
- `issues_add_comment`: adiciona um comentário em Markdown a uma issue
  existente; a autoria é atribuída pela identidade autenticada na API.
- `issues_update_comment`: atualiza o conteúdo e, opcionalmente, a data de um
  comentário existente, preservando sua autoria original.
- `issues_get_classification_catalog`: obtém a árvore taxonômica e os grupos de tags válidos; opcionalmente inclui listas achatadas de IDs e caminhos.
- `issues_create_taxonomy_item`: inclui um item na raiz ou sob outro item,
  opcionalmente configurando seu escopo por aplicações.
- `issues_update_taxonomy_item`: altera o nome ou o escopo por aplicações de
  um item existente, preservando seu ID e seus descendentes.
- `issues_summary`: retorna agregados por dia, semana, mês, ano, tipo, status e taxonomia.
- `issues_aggregate`: retorna uma agregação específica.
- `issues_create`: cria uma issue manual com origem `mcp`; `applicationId` é
  obrigatório.
- `issues_import_eml`: analisa ou importa um EML enviado em Base64; `dryRun` é `true` por padrão.
- `issues_update_state`: altera status e/ou tipo de uma issue.
- `issues_update`: altera título, texto, tipo, status, aplicação e componentes
  afetados. Exige ao menos um campo e preserva os campos omitidos.
- `issues_suggest_taxonomy`: busca lexical legada, mantida para compatibilidade; o fluxo principal usa a análise do agente sobre os resources da issue e do catálogo.
- `issues_classify`: grava classificação/KB em `issues.classification`.
- `issues_by_taxonomy`: busca issues por assunto/taxonomia, incluindo todos os
  seus descendentes e filtros opcionais de contexto.

### Melhorias

- `demands_list`: lista uma página de melhorias, com `page` (padrão 1),
  `limit` (padrão 25, máximo 100), filtros de contexto e `collectionId`
  (`__root__` seleciona a raiz). A resposta informa total, página e total de
  páginas. Busca por `text` e código parcial em `code` percorre as páginas da
  API e aplica os filtros antes da paginação do resultado.
- `demands_get`: obtém uma melhoria estruturada.
- `demands_create`: cria uma melhoria com dados cadastrais, especificação,
  checklist e planejamento; `applicationId` é obrigatório.
- `demands_journey_calendar`: consolida jornadas previstas e executadas por mês.
- `demands_deadlines`: consolida prazos e situação por melhoria.
- `demands_implementation_context`: extrai contexto de especificação e tarefas para agentes de desenvolvimento.
- `demands_add_note`: adiciona anotação a uma melhoria.
- `demands_update_description`: atualiza a descrição sucinta da melhoria.
- `demands_update`: altera código, título, descrição, status, prazos, estimativa
  de jornadas, aplicação e componentes afetados. Exige ao menos um campo;
  campos omitidos são preservados pela API.
- `demands_update_specification`: substitui todas as seções da especificação.
- `demands_update_checklist`: substitui todos os itens do checklist, incluindo
  conclusão, data e comentário.
- `demands_update_journeys`: substitui o planejamento mensal de jornadas.
  Os meses devem estar dentro de `startDate`/`endDate` da melhoria; ajuste as
  datas com `demands_update` primeiro. A API preenche meses do período não
  informados com zero.
- `demands_update_note`: altera conteúdo e, opcionalmente, data de uma nota;
  preserva a data existente quando omitida.
- `demands_delete_note`: exclui permanentemente uma nota da melhoria.
- `demands_list_tasks`: lista tarefas, com filtro opcional por status.
- `demands_create_task`: inclui uma tarefa.
- `demands_update_task`: altera código, título, status, datas, situação, descrição ou especificação de uma tarefa.
- `demands_update_task_status`: altera somente o status de uma tarefa.
- `demands_delete_task`: exclui uma tarefa.
- `demands_add_task_note`: adiciona uma nota de execução a uma tarefa.
- `demands_update_task_note`: altera uma nota de execução.
- `demands_delete_task_note`: exclui uma nota de execução.

Calendário e prazos percorrem todas as páginas de melhorias no escopo informado,
com filtro opcional por `collectionId`. Essas consultas e a busca local de
`demands_list` leem até 100 páginas de 100 melhorias. Ao exceder o limite, retornam
`DEMAND_SCAN_LIMIT_EXCEEDED` e solicitam filtros mais específicos, sem devolver
um resultado parcial como completo.

As novas ferramentas de alteração aceitam `requestId` como ID ou código exato da melhoria.
Consulte `demands_get` antes de substituir especificação, checklist ou jornadas
para conservar os itens desejados. Arrays vazios limpam especificação e checklist;
para jornadas, zeram o planejamento no período da melhoria. IDs de seções,
rótulos de checklist e meses de jornadas devem ser únicos. As alterações usam
somente a API, com as mesmas permissões, escopo e auditoria da interface.

### Anexos

- `attachments_upload`: envia até dez arquivos, fornecidos em
  `files[].contentBase64`, para uma entidade;
- `attachments_download`: devolve nome, MIME type, tamanho e conteúdo integral
  do arquivo em `contentBase64`;
- `attachments_update_tags`: substitui as tags de classificação do arquivo;
- `attachments_delete`: exclui permanentemente o registro do anexo e seu
  conteúdo armazenado.

As quatro ferramentas aceitam `entityType` com `issue`, `demand`, `task` ou
`document`. `entityId` identifica o chamado, melhoria ou documento. Para
`task`, `entityId` deve ser o ID da melhoria pai e `taskId` deve identificar a
tarefa por ID ou código.

A API expõe rotas próprias de arquivos de tarefas em
`/api/requests/:id/tasks/:taskId/attachments`. Ela resolve os IDs ou códigos,
valida a associação e preserva a tag do código da tarefa. O MCP delega essas
regras à API e usa as permissões `tasks.attachment.*`.

Nas tools de compatibilidade, os arquivos trafegam em Base64. Resources de conteúdo devolvem texto ou blob conforme o MIME type. O servidor não
aceita caminhos locais, URLs para download remoto ou referências ao filesystem
do processo. Todas as operações passam pelas rotas autenticadas da
`biaws-api`, preservando autorização, escopo e auditoria por domínio.
Em instalações novas, o grupo padrão `agent-operator` inclui as permissões de
leitura, criação, alteração de tags e exclusão de anexos nesses três domínios
raiz. Matrizes de grupos já existentes são preservadas durante atualizações;
quando essas permissões tiverem sido removidas ou ainda não existirem, um
administrador deverá concedê-las. Operações no contexto de tarefa usam as
permissões de anexos da melhoria pai.

### Documentos

- `document_types_list`: consulta o contrato oficial de cada tipo, incluindo
  estados, contexto obrigatório e campos específicos de `details`;
- `documents_search` e `resources/read` de `biaws://workspaces/{workspaceId}/documents/{documentId}`: localizam documentos e carregam seu
  conteúdo completo sob demanda;
- `documents_create`: cria regras, decisões, guidelines, features, referências
  técnicas e procedimentos usando um schema discriminado por `documentType`;
- `documents_update`: atualiza conteúdo, contexto e metadados, preservando o
  tipo imutável;
- `documents_add_observation`: acrescenta uma observação imutável.

Regras de negócio, decisões arquiteturais e features exigem `applicationId`.
Referências técnicas podem pertencer ao workspace ou a uma aplicação.
Procedimentos também podem pertencer ao workspace ou ser vinculados a uma
aplicação e seus componentes; são documentos com `documentType=procedure`.
Guidelines usam `details.scope`: `workspace` proíbe `applicationId`,
`application` o exige e `component` exige também `affectedComponentIds`.
Componentes sempre devem estar ativos e pertencer à aplicação informada.

### Metadados de segredos

- `secrets_list`: lista metadados, com filtros por aplicação, ambiente, estado
  de provisionamento e estado de arquivamento;
- `resources/read` de `biaws://workspaces/{workspaceId}/secrets/{secretId}`: consulta os metadados de um registro;
- `secrets_register`: registra uma necessidade de segredo com identificação,
  descrição, tipo, formato esperado, aplicação, ambiente e coleção opcionais.

`secrets_register` cria um item com `provisioningStatus: pending`, sem provider,
versão ou conteúdo. Um usuário autorizado deve completar o registro pela UI,
usando **Cadastrar valor** ou **Enviar arquivo**. A primeira gravação cria a
versão 1 e altera o estado para `ready`.

O grupo padrão `agent-operator` recebe `secrets.metadata.read` e
`secrets.metadata.create`, mas não recebe `secrets.value.write` ou
`secrets.value.reveal`.

Issues e melhorias criadas pelo MCP sempre pertencem a uma aplicação e podem
informar `affectedComponentIds`. Documentos seguem as regras de contexto
declaradas por `document_types_list`.
Nas ferramentas de consulta, os filtros comuns são `workspaceId`,
`applicationId` e `componentId`.

## Segurança operacional

Este MCP não expõe uma ferramenta genérica de armazenamento. As escritas disponíveis são intencionais, estruturadas, limitadas ao domínio e passam pela `biaws-api`. As ferramentas `attachments_*` aceitam somente os quatro tipos de entidade declarados e não podem ser usadas para segredos. As ferramentas `secrets_*` não possuem campos para valor, arquivo ou conteúdo codificado.

O MCP não acessa MongoDB, não executa shell, SSH, deploy ou sincronização Git e
não recebe valores de senhas, tokens, chaves privadas, kubeconfig ou connection
strings. A `BIAWS_API_KEY` é a única credencial do processo e
é usada exclusivamente no cabeçalho HTTP.

Erros da API mantêm o status e o código funcional para que o agente diferencie
falta de autenticação (`401`), falta de permissão (`403`), recurso inexistente
(`404`), conflito (`409`) e payload ou relação inválida (`422`). Erros de
execução são devolvidos como resultado MCP com `isError: true`, conteúdo textual
e `structuredContent.error`; não são convertidos em erro de protocolo JSON-RPC.
Quando disponíveis, o resultado também preserva `requiredPermissions`, erros
por campo, `requestId` e a indicação `retryable`. Chamadas simultâneas são
isoladas, e `notifications/cancelled` interrompe o HTTP associado sem bloquear
as demais ferramentas.

Para `issues_import_eml`, o agente deve fornecer `filename` e o conteúdo integral em `contentBase64`. Para efetivar a escrita, deve informar explicitamente `dryRun: false`; caso contrário, a ferramenta apenas retorna a issue, os comentários e os anexos que seriam importados.

### Migração das leituras específicas

A próxima publicação destas alterações retira 21 tools redundantes. Consulte
[read-migration.md](docs/read-migration.md) para a matriz completa, os templates
e as exceções preservadas. Clientes devem implementar `resources/read` e sua
descoberta; nomes retirados retornam `TOOL_NOT_FOUND`, sem aliases. As leituras
agregadas de issues e melhorias permanecem disponíveis com suas projeções.
