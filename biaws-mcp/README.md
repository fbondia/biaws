# Bondia Workspaces MCP

Servidor MCP para agentes consultarem e atualizarem, de forma controlada, a base de conhecimento operacional mantida pelo `biaws-api`.

O servidor separa os domínios:

- `workspaces_*`, `applications_*`, `components_*`, `repositories_*`,
  `servers_*`, `deployments_*` e `runtimes_*`: catálogo de aplicações e
  topologia operacional.
- `issues_*`: chamados, incidentes, requisições operacionais, taxonomia e classificação.
- `demands_*`: melhorias, especificações, jornadas, prazos e contexto para desenvolvimento.
- `procedures_*`: procedimentos operacionais em Markdown, com tags e classificação taxonômica compartilhadas com issues.

O carregamento de ambiente usa o `shared/loadEnv.js` do próprio repositório. O MCP conversa com a `biaws-api` por HTTP e não acessa diretamente o mecanismo de armazenamento.

Em instalações multi-instância, `BIAWS_ENV_FILE` aponta para
`instances/<nome>/.env`. Esse arquivo tem precedência sobre o `.env` da raiz e
permite que várias instâncias compartilhem o mesmo clone do código. Ele contém
a URL e a credencial da instância, mas não seleciona o workspace.

Por padrão, a API é buscada em `http://127.0.0.1:3100`. Para apontar para outro endereço, use uma das variáveis:

- `ISSUE_API_URL`
- `ISSUE_API_BASE_URL`
- `VITE_ISSUE_API_URL`

Defina obrigatoriamente `ISSUE_API_KEY`. O bootstrap open source cria uma
identidade técnica e grava sua chave no `.env` local; uma chave também pode ser
criada manualmente pela UI. O MCP a envia como `Authorization: Bearer`.

Defina `ISSUE_WORKSPACE_ID` no bloco `env` do servidor MCP local ao projeto. O
MCP preserva esse valor mesmo ao carregar `BIAWS_ENV_FILE` e o envia como
`X-Biaws-Workspace-Id`; argumentos das tools não ampliam esse escopo. A chave
precisa pertencer ao workspace — selecionar o ID não concede permissões.

## Execução

Suba a `biaws-api` em outro terminal e execute:

```bash
npm run check
npm start
```

Em um cliente MCP, configure o comando:

```bash
node /caminho/para/biaws/biaws-mcp/src/index.js
```

O fluxo recomendado é gerar a configuração completa com:

```bash
BIAWS_ENV_FILE=/caminho/para/instances/minha-instancia/.env \
node /caminho/para/biaws/biaws-cli/src/index.js \
  agent configure codex --project /caminho/do/projeto --workspace id-do-workspace
```

## Ferramentas

### Catálogo e contexto de aplicações

As consultas do catálogo são:

- `workspaces_list` e `workspaces_get`;
- `applications_list`, `applications_get` e
  `applications_get_context`;
- `components_list` e `components_get`;
- `integrations_list` e `integrations_get`;
- `repositories_list` e `repositories_get`;
- `servers_list` e `servers_get`;
- `deployments_list` e `deployments_get`;
- `runtimes_list` e `runtimes_get`.

As escritas estruturadas são:

- `applications_create` e `applications_update`;
- `components_create` e `components_update`;
- `integrations_create` e `integrations_update`;
- `repositories_create` e `repositories_update`;
- `servers_create` e `servers_update`;
- `deployments_create` e `deployments_update`;
- `runtimes_create` e `runtimes_update`.

As ferramentas de escrita usam `POST` ou `PATCH` da API e, portanto, herdam
suas validações de escopo, relações, permissões e auditoria. Integrações
apontam para outra aplicação ativa do mesmo workspace e preservam o destino
imutável. Arquivamento não
é exposto pelo MCP nesta fase.

`applications_get_context` entrega, em uma única consulta, a aplicação,
integrações, componentes, repositórios, deployments, runtimes, servidores referenciados e
resumos de issues, melhorias e procedimentos associados. O argumento `limit`
vale separadamente para cada grupo, tem teto de 100 e padrão 25. O resultado
informa totais e truncamentos e não contém credenciais, endereços dos
servidores, metadata dos runtimes, anexos nem os textos extensos da base de
conhecimento.

### Issues / chamados

- `issues_search`: busca issues com os mesmos filtros principais da
  `biaws-api`, inclusive por workspace, aplicação e componente afetado.
- `issues_get`: obtém uma issue com comentários.
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
- `issues_suggest_taxonomy`: sugere taxonomias aderentes ao texto da issue.
- `issues_classify`: grava classificação/KB em `issues.classification`.
- `issues_by_taxonomy`: busca issues por assunto/taxonomia, incluindo todos os
  seus descendentes e filtros opcionais de contexto.

### Melhorias

- `demands_list`: lista melhorias com filtros simples e de contexto.
- `demands_get`: obtém uma melhoria estruturada.
- `demands_create`: cria uma melhoria com dados cadastrais, especificação,
  checklist e planejamento; `applicationId` é obrigatório.
- `demands_journey_calendar`: consolida jornadas previstas e executadas por mês.
- `demands_deadlines`: consolida prazos e situação por melhoria.
- `demands_implementation_context`: extrai contexto de especificação e tarefas para agentes de desenvolvimento.
- `demands_add_note`: adiciona anotação a uma melhoria.
- `demands_update_description`: atualiza a descrição sucinta da melhoria.
- `demands_list_tasks`: lista tarefas, com filtro opcional por status.
- `demands_create_task`: inclui uma tarefa.
- `demands_update_task`: altera código, título, status, datas, situação, descrição ou especificação de uma tarefa.
- `demands_update_task_status`: altera somente o status de uma tarefa.
- `demands_delete_task`: exclui uma tarefa.
- `demands_add_task_note`: adiciona uma nota de execução a uma tarefa.
- `demands_update_task_note`: altera uma nota de execução.
- `demands_delete_task_note`: exclui uma nota de execução.

### Procedimentos

- `procedures_search`: pesquisa por ID, texto (título, sumário e conteúdo),
  taxonomia (incluindo descendentes), tag e contexto.
- `procedures_get_classification_catalog`: obtém a árvore taxonômica e os grupos de tags; opcionalmente inclui listas achatadas de IDs válidos.
- `procedures_create`: cria um procedimento com título, sumário, conteúdo,
  classificação e contexto opcionais.
- `procedures_update`: atualiza parcialmente título, sumário, conteúdo,
  classificação ou contexto.

Issues e melhorias criadas pelo MCP sempre pertencem a uma aplicação e podem
informar `affectedComponentIds`. Procedimentos podem permanecer gerais ao
workspace ou ser vinculados opcionalmente a uma aplicação e seus componentes.
Nas ferramentas de consulta, os filtros comuns são `workspaceId`,
`applicationId` e `componentId`.

## Segurança operacional

Este MCP não expõe uma ferramenta genérica de armazenamento. As escritas disponíveis são intencionais, estruturadas, limitadas ao domínio e passam pela `biaws-api`.

O MCP não acessa MongoDB, não executa shell, SSH, deploy ou sincronização Git e
não recebe senhas, tokens, chaves privadas, kubeconfig ou connection strings
nos schemas do catálogo. A `ISSUE_API_KEY` é a única credencial do processo e
é usada exclusivamente no cabeçalho HTTP.

Erros da API mantêm o status e o código funcional para que o agente diferencie
falta de autenticação (`401`), falta de permissão (`403`), recurso inexistente
(`404`), conflito (`409`) e payload ou relação inválida (`422`).

Para `issues_import_eml`, o agente deve fornecer `filename` e o conteúdo integral em `contentBase64`. Para efetivar a escrita, deve informar explicitamente `dryRun: false`; caso contrário, a ferramenta apenas retorna a issue, os comentários e os anexos que seriam importados.
