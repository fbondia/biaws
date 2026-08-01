# Bondia Workspaces API

Documentação do catálogo de workspace, aplicações e topologia operacional:
[docs/catalog-api.md](docs/catalog-api.md).

API REST responsável pelo domínio de issues, incluindo consulta, persistência e importação de EML.

A fundação de identidade usa Better Auth e as rotas de negócio exigem sessão ou
chave de API válida, além das permissões específicas de cada operação. A API
carrega o `.env` pelo `shared/loadEnv.js`
do próprio repositório, nesta precedência:

- `biaws/.env`
- `biaws/biaws-api/.env`, se existir

## Ambiente

Copie `.env.example` da raiz para `.env` e ajuste os valores locais. O arquivo é compartilhado pela API e pelo MCP; quando necessário, `biaws-api/.env` pode sobrescrever valores apenas para a API. A UI possui seu próprio `biaws-ui/.env.example`, conforme o carregamento padrão do Vite.

Variáveis esperadas:

- `MONGO_URI`, `MONGODB_URI` ou `MONGODB_CONNECTION`
- `MONGO_DB`, `MONGODB_DB`, `MONGODB_DATABASE`, `MONGO_DATABASE`, `DB_NAME` ou database presente na URI
- `BETTER_AUTH_SECRET`: segredo com no mínimo 32 caracteres
- `BETTER_AUTH_URL`: URL pública da API
- `BETTER_AUTH_TRUSTED_ORIGINS`: origens permitidas, separadas por vírgula

Variáveis opcionais:

- `ISSUE_API_PORT`: porta HTTP, default `3100`
- `ISSUE_API_HOST`: host HTTP, default `127.0.0.1`
- `ISSUE_API_MAX_EML_BYTES`: tamanho máximo de um upload EML, default `26214400` (25 MiB)
- `ISSUE_API_MAX_ATTACHMENT_BYTES`: tamanho máximo de cada anexo, default `52428800` (50 MiB)
- `ISSUE_API_MAX_JSON_BYTES`: tamanho máximo de payload JSON, incluindo pacotes de skills, default `4194304` (4 MiB)
- `ISSUE_API_RATE_LIMIT_ENABLED`, `ISSUE_API_RATE_LIMIT_WINDOW_SECONDS` e `ISSUE_API_RATE_LIMIT_MAX_REQUESTS`: limite geral persistente por ator; defaults `true`, `60` e `300`
- `BETTER_AUTH_RATE_LIMIT_ENABLED`, `BETTER_AUTH_RATE_LIMIT_WINDOW_SECONDS` e `BETTER_AUTH_RATE_LIMIT_MAX_REQUESTS`: limite por IP e rota do Better Auth; defaults `true`, `10` e `100`
- `ISSUE_API_KEY_RATE_LIMIT_ENABLED`, `ISSUE_API_KEY_RATE_LIMIT_WINDOW_SECONDS` e `ISSUE_API_KEY_RATE_LIMIT_MAX_REQUESTS`: cota persistida em cada API key; defaults `true`, `3600` e `1000`
- `BETTER_AUTH_TRUSTED_PROXIES`: IPs ou CIDRs dos proxies confiáveis, separados por vírgula
- `ISSUE_DIR`: diretório usado para o espelho local e armazenamento dos anexos importados
- `ATTACHMENT_STORAGE_PROVIDER`: provider de anexos; atualmente `local` (default)
- `ATTACHMENT_STORAGE_LOCAL_DIR`: raiz opcional dos anexos no provider local; por padrão usa `ISSUE_DIR`. Caminhos relativos partem da raiz de `biaws`

## Storage de anexos

O armazenamento de anexos usa um contrato assíncrono independente do provider, com as
operações `initialize`, `save`, `read` e `exists`. O provider local mantém o layout
compatível com as importações existentes:

```text
<raiz>/<YYYY-MM>/<issue-id>/attachments/<arquivo>
```

Novos registros guardam uma referência portável no MongoDB:

```json
{
  "storage": {
    "provider": "local",
    "key": "2026-07/INC123/attachments/001-checksum-arquivo.pdf",
    "saved": true,
    "relativePath": "2026-07/INC123/attachments/001-checksum-arquivo.pdf"
  }
}
```

`relativePath` é mantido temporariamente por compatibilidade com clientes atuais.
Os caminhos absolutos do servidor não são mais gravados em novas importações.
O mês é determinado pela primeira data válida entre `receivedEmailAt`,
`jiraCreatedAt`, `firstThreadEmailAt`, `issueCreatedAt` e `createdAt`. Se nenhuma
estiver disponível, é usado o mês corrente. Leituras devem sempre usar a
`storage.key` persistida, de modo que anexos antigos continuem acessíveis.

Para adicionar Google Cloud Storage ou S3, deve-se implementar o mesmo contrato em
`src/storage`, registrar o provider na factory e migrar os arquivos e as referências
`provider`/`key`. A API e a UI não devem depender de caminhos físicos.

## Execução

```bash
npm install
npm run dev
```

ou:

```bash
npm start
```

A configuração e o bootstrap de autenticação estão documentados em
[`docs/authentication.md`](docs/authentication.md). O inventário inicial de
permissões está em [`docs/auth-route-inventory.md`](docs/auth-route-inventory.md)
e a matriz de grupos em
[`docs/permission-groups.md`](docs/permission-groups.md). A política aplicada no
backend está em [`docs/authorization.md`](docs/authorization.md). O modelo de
tenancy e o cabeçalho de seleção de workspace estão em
[`docs/authorization-scopes.md`](docs/authorization-scopes.md).

## Endpoints

Health check:

```bash
curl http://127.0.0.1:3100/api/health
```

Receber um sinal de monitoramento de runtime:

```bash
curl -X POST http://127.0.0.1:3100/api/monitoring/runtimes/<runtime-id>/signals \
  -H "Authorization: Bearer $ISSUE_API_KEY" \
  -H "X-Biaws-Workspace-Id: $ISSUE_WORKSPACE_ID" \
  -H 'Content-Type: application/json' \
  -d '{"signalId":"probe:42","status":"healthy","source":"probe-http"}'
```

O contrato, idempotência e recomendações para emissores estão em
[`../docs/monitoring.md`](../docs/monitoring.md).

Listar issues com paginação:

```bash
curl 'http://127.0.0.1:3100/api/issues?page=1&limit=25'
```

Criar issue manualmente:

```bash
curl -X POST http://127.0.0.1:3100/api/issues \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "incident",
    "status": "open",
    "title": "Falha de sincronismo",
    "text": "Descrição operacional do problema.",
    "applicationId": "<application-id>",
    "affectedComponentIds": [],
    "comment": "Comentário inicial opcional.",
    "createdBy": "biaws-mcp"
  }'
```

Se `id` não for informado, a API gera um ID sintético no formato `YYYY-MM-DD-999`.

Analisar um EML sem gravar no MongoDB ou no `ISSUE_DIR`:

```bash
curl -X POST 'http://127.0.0.1:3100/api/issues/imports/eml?dryRun=true' \
  -F 'file=@./email.eml' \
  -F 'applicationId=<application-id>'
```

Importar efetivamente:

```bash
curl -X POST http://127.0.0.1:3100/api/issues/imports/eml \
  -F 'file=@./email.eml' \
  -F 'applicationId=<application-id>'
```

O multipart também aceita os campos opcionais `type` (um tipo ativo da lista
`issue.type`) e `id`. A API identifica tipo e código pelas expressões
configuradas em `metadata.emlImport.subjectPatterns` de cada tipo, respeitando a
ordem da lista. Uma captura nomeada `(?<code>...)` coleta o código; regras sem
essa captura apenas identificam o tipo. Correspondências que coletam código têm
preferência e, quando nenhuma regra corresponde, a API usa o tipo padrão e
gera ou localiza um ID sintético. A configuração inicial preserva os padrões
legados de `INC`, `REQ`, `erro` e `incidente`.

A API deduplica IDs sintéticos por data e assunto, deduplica comentários por
hash e reabre uma issue existente quando o EML a atualiza. Na importação
efetiva, `ISSUE_DIR` é obrigatório para gravar anexos e atualizar o espelho
local.

As regras de sanitização são consultadas e atualizadas por
`GET/PUT /api/issues/imports/eml/sanitization`. A configuração é versionada por
workspace na collection `emailSanitizationConfigs`; enquanto não houver um
documento persistido, a API usa regras default equivalentes às regras legadas.
O dry-run também aceita `sanitizationConfig` como JSON no multipart para
pré-visualizar alterações ainda não salvas.

Filtros aceitos em `GET /api/issues`:

- `codigo`, `code` ou `id`: busca parcial em `id`
- `tipo` ou `type`: um ou mais tipos separados por vírgula
- `status`: um ou mais status separados por vírgula
- `texto`, `text` ou `q`: busca textual em `id`, `title`, `text`, origem e anexos
- `title`: busca parcial no título
- `from`, `dateFrom`, `to`, `dateTo`: filtro por data
- `dateField`: `receivedEmailAt`, `issueCreatedAt`, `firstThreadEmailAt`, `closedAt` ou `updatedAt`
- `tag_<grupo>`: uma ou mais tags separadas por vírgula em `classification.tags.<grupo>`; por exemplo `tag_ambiente=producao,homologacao`
- `taxonomy`: uma ou mais classificações separadas por vírgula; encontra correspondências no assunto principal ou nos assuntos secundários
- `workspaceId`, `applicationId` e `componentId`: restringem a consulta ao
  contexto do catálogo de aplicações
- `sort`: `date`, `id`, `type`, `status`, `title`, `updatedAt`, `receivedEmailAt`, `issueCreatedAt`, `firstThreadEmailAt`, `closedAt`; prefixe com `-` para descendente
- `order`: `asc` ou `desc`
- `page`: página, começando em `1`
- `limit`: tamanho da página, máximo `100`

Buscar uma issue com comentários:

```bash
curl http://127.0.0.1:3100/api/issues/INC1234567
```

Enviar até 10 anexos:

```bash
curl -X POST http://127.0.0.1:3100/api/issues/INC1234567/attachments \
  -F 'files=@./evidencia.pdf' \
  -F 'files=@./log.txt'
```

Baixar um anexo pelo `id` retornado nos metadados:

```bash
curl -OJ http://127.0.0.1:3100/api/issues/INC1234567/attachments/<attachment-id>
```

Excluir o registro e o arquivo armazenado:

```bash
curl -X DELETE http://127.0.0.1:3100/api/issues/INC1234567/attachments/<attachment-id>
```

Classificar um anexo com tags:

```bash
curl -X PATCH http://127.0.0.1:3100/api/issues/INC1234567/attachments/<attachment-id>/tags \
  -H 'Content-Type: application/json' \
  -d '{"tags":["evidência","produção"]}'
```

Anexos legados sem `id` também podem ser obtidos usando seu `index`.

O mesmo contrato está disponível para melhorias e procedimentos:

```text
POST /api/requests/:id/attachments
GET  /api/requests/:id/attachments/:attachmentId
DELETE /api/requests/:id/attachments/:attachmentId
PATCH /api/requests/:id/attachments/:attachmentId/tags
POST /api/procedures/:id/attachments
GET  /api/procedures/:id/attachments/:attachmentId
DELETE /api/procedures/:id/attachments/:attachmentId
PATCH /api/procedures/:id/attachments/:attachmentId/tags
```

Cada domínio usa sua própria raiz (`ISSUE_DIR`, `REQUEST_DIR` ou `PROCEDURE_DIR`)
e o mesmo layout mensal `YYYY-MM/<id>/attachments/<arquivo>`.

## Catálogo de skills

A API mantém versões imutáveis das skills usadas para configurar os ambientes dos
agentes. Cada pacote contém `SKILL.md`, seus arquivos auxiliares, checksums e
metadados de compatibilidade.

```text
GET   /api/skills
POST  /api/skills
GET   /api/skills/:skillId
GET   /api/skills/:skillId?version=1.0.0
GET   /api/skills/:skillId/:version/download
PATCH /api/skills/:skillId/:version/deprecate
```

Uma publicação usa versão semântica e não pode sobrescrever uma versão existente:

```bash
curl -X POST http://127.0.0.1:3100/api/skills \
  -H 'Content-Type: application/json' \
  -d '{
    "skillId": "biaws-example",
    "version": "1.0.0",
    "name": "Bondia Example",
    "description": "Executa um fluxo de exemplo.",
    "files": [
      {
        "path": "SKILL.md",
        "content": "---\nname: biaws-example\ndescription: Executa um fluxo de exemplo.\n---\n"
      }
    ]
  }'
```

O download usa o formato `biaws-skill-package/v1`, consumido pelo
`biaws/biaws-cli`. Versões antigas devem ser descontinuadas, não excluídas,
para preservar rastreabilidade e rollback.

Alterar tipo e/ou status de uma issue:

```bash
curl -X PATCH http://127.0.0.1:3100/api/issues/INC1234567 \
  -H 'Content-Type: application/json' \
  -d '{"status":"closed"}'
```

Ao fechar uma issue, a API preenche `dates.closedAt`; ao reabrir, limpa esse campo.

Gravar a classificação/taxonomia de uma issue dentro do próprio documento em `issues.classification`:

```bash
curl -X PUT http://127.0.0.1:3100/api/issues/INC1234567/classification \
  -H 'Content-Type: application/json' \
  -d '{
    "primaryTaxonomyId": "aplicativo",
    "secondaryTaxonomyIds": ["execucao-da-atividade"],
    "tags": {
      "ambiente": ["producao"],
      "componente": ["aplicativo"],
      "tratamento": ["analise-log"]
    }
  }'
```

Resumo agregado pelos mesmos filtros, retornando `byDate`, `byWeek`, `byMonth`, `byYear`, `byType` e `byStatus`:

```bash
curl 'http://127.0.0.1:3100/api/issues/summary?from=2026-07-01&to=2026-07-31'
```

O resumo também retorna `byTaxonomy`, quando houver issues classificadas.

Agregação específica:

```bash
curl 'http://127.0.0.1:3100/api/issues/aggregate?groupBy=type'
curl 'http://127.0.0.1:3100/api/issues/aggregate?groupBy=status'
curl 'http://127.0.0.1:3100/api/issues/aggregate?groupBy=date&interval=month'
curl 'http://127.0.0.1:3100/api/issues/aggregate?groupBy=week'
curl 'http://127.0.0.1:3100/api/issues/aggregate?groupBy=month'
curl 'http://127.0.0.1:3100/api/issues/aggregate?groupBy=year'
curl 'http://127.0.0.1:3100/api/issues/aggregate?groupBy=taxonomy'
```

Buscar issues por taxonomia principal ou secundária:

```bash
curl 'http://127.0.0.1:3100/api/issues/by-taxonomy/via-script?status=closed&limit=25'
```

Obter o pacote ativo de taxonomia:

```bash
curl http://127.0.0.1:3100/api/issues/taxonomy
```

Cada nó pode declarar `applicationIds`. Uma lista vazia mantém o nó
compartilhado no workspace; uma lista preenchida restringe sua utilização às
aplicações informadas. Para obter a árvore efetiva de uma aplicação:

```bash
curl 'http://127.0.0.1:3100/api/issues/taxonomy?applicationId=application-id'
```

Gravar ou substituir o pacote ativo de taxonomia em `taxonomies`:

```bash
curl -X PUT http://127.0.0.1:3100/api/issues/taxonomy \
  -H 'Content-Type: application/json' \
  -d @taxonomy.json
```

O payload esperado é o pacote completo:

```json
{
  "schemaVersion": 1,
  "source": {
    "path": "biaws/kb-tags-catalog.json"
  },
  "tagGroups": [
    {
      "id": "ambiente",
      "label": "Ambiente",
      "description": "Tags relacionadas ao ambiente.",
      "tags": ["interno", "externo", "producao", "homologacao"]
    }
  ],
  "taxonomy": [
    {
      "id": "aplicativo",
      "label": "Aplicativo",
      "children": [
        {
          "id": "execucao-da-atividade",
          "label": "Execução da atividade"
        }
      ]
    }
  ]
}
```

## Melhorias planejadas

As melhorias são persistidas em seis collections:

- `requests`: dados principais da melhoria, checklist e `listRank` para ordenação manual.
- `requestJourneyPeriods`: distribuição mensal de jornadas, com `requestId`,
  `month`, `plannedJourneys`, `executedJourneys` e `comment`.
- `requestSpecifications`: especificação técnica da melhoria, com `requestId` e
  `sections` ordenadas.
- `requestNotes`: anotações da melhoria, com `requestId`, `date` e `content`.
- `requestTasks`: tarefas vinculadas à melhoria.
- `requestTaskNotes`: notas de execução das tarefas.

Listar melhorias:

```bash
curl http://127.0.0.1:3100/api/requests
```

A listagem é ordenada por `listRank` decrescente, depois `updatedAt` e `createdAt`. Melhorias antigas sem `listRank` recebem esse campo automaticamente com base em `updatedAt` ou `createdAt`.

Criar melhoria:

```bash
curl -X POST http://127.0.0.1:3100/api/requests \
  -H 'Content-Type: application/json' \
  -d '{
    "clientCode": "ET-2026-014",
    "title": "Automação de carga massiva de formulários",
    "status": "Solicitado",
    "estimatedDeliveryDate": "2026-09-18",
    "startDate": "2026-07-15",
    "endDate": "2026-09-30",
    "estimatedJourneys": 18,
    "description": "Escopo e contexto da melhoria.",
    "specification": {
      "sections": [
        { "id": "default-1", "title": "Objetivo", "content": "Reduzir esforço manual.", "order": 0 },
        { "id": "default-2", "title": "Escopo de Atuação", "content": "Recepção, validação e processamento.", "order": 1 },
        { "id": "default-3", "title": "Impacto no Sistema", "content": "Formulários e processamento assíncrono.", "order": 2 }
      ]
    },
    "checklist": [
      {
        "label": "Solicitação",
        "done": true,
        "date": "2026-07-03",
        "comment": "Melhoria recebida."
      }
    ],
    "journeys": [
      { "month": "2026-07", "plannedJourneys": 4, "executedJourneys": 4, "comment": "Levantamento e desenho técnico." },
      { "month": "2026-08", "plannedJourneys": 8, "executedJourneys": 0, "comment": "Desenvolvimento principal." },
      { "month": "2026-09", "plannedJourneys": 6, "executedJourneys": 0, "comment": "Homologação e ajustes finais." }
    ]
  }'
```

Atualizar melhoria:

```bash
curl -X PUT http://127.0.0.1:3100/api/requests/64f000000000000000000000 \
  -H 'Content-Type: application/json' \
  -d @request.json
```

O payload de atualização usa o mesmo formato da criação. A API normaliza o
checklist fixo, mantém `requestJourneyPeriods` sincronizada com os meses entre
`startDate` e `endDate` e sincroniza `requestSpecifications` por `requestId`.

Instalações que ainda possuem `requestBillingPeriods` devem executar a migração
uma vez antes de iniciar esta versão da API:

```bash
cd biaws-api
npm run migrate:journeys
```

A migração renomeia a collection para `requestJourneyPeriods`, converte
`billedJourneys` em `executedJourneys` e remove o alias legado `journeys` de
cada período. Ela também atualiza os grupos de sistema e as listas de opções
que ainda usam os nomes padrão antigos. Durante a transição, a API ainda aceita
payloads antigos com `billing` e `billedJourneys`, mas responde e persiste
somente o modelo novo.

A criação define a melhoria no topo da lista atualizando `listRank`. Atualizações de conteúdo não alteram `listRank`; depois da criação, a posição só muda pelo reposicionamento manual.

Criar anotação:

```bash
curl -X POST http://127.0.0.1:3100/api/requests/64f000000000000000000000/notes \
  -H 'Content-Type: application/json' \
  -d '{
    "date": "2026-07-15",
    "content": "Priorizar desenho da fila."
  }'
```

Atualizar anotação, incluindo alteração de data:

```bash
curl -X PUT http://127.0.0.1:3100/api/requests/64f000000000000000000000/notes/64f000000000000000000010 \
  -H 'Content-Type: application/json' \
  -d '{
    "date": "2026-07-18",
    "content": "Fila aprovada para desenvolvimento."
  }'
```

Excluir anotação:

```bash
curl -X DELETE http://127.0.0.1:3100/api/requests/64f000000000000000000000/notes/64f000000000000000000010
```

As operações de anotação retornam a melhoria atualizada, mas não alteram `listRank`.

Reordenar melhoria manualmente:

```bash
curl -X PATCH http://127.0.0.1:3100/api/requests/64f000000000000000000000/order \
  -H 'Content-Type: application/json' \
  -d '{
    "previousRequestId": "64f000000000000000000001",
    "nextRequestId": "64f000000000000000000002"
  }'
```

O reposicionamento calcula um novo `listRank` entre os vizinhos informados. Essa operação não altera `updatedAt`, porque não representa alteração de conteúdo da melhoria.

Excluir melhoria:

```bash
curl -X DELETE http://127.0.0.1:3100/api/requests/64f000000000000000000000
```

A exclusão remove o documento em `requests` e também os registros associados em
`requestJourneyPeriods`, `requestSpecifications` e `requestNotes`.

O campo `status` aceita apenas:

- `Sugerido`
- `Solicitado`
- `Aguardando Aprovação`
- `Desenvolvimento`
- `Homologação`
- `Concluído`
