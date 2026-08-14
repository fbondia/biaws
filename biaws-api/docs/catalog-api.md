# API de catálogo e contexto — Fases 1 a 4

O catálogo do Bondia Workspaces organiza aplicações e sua topologia
operacional:

```text
Workspace
├── Applications
│   ├── Components
│   ├── Repositories
│   └── Deployments
│       └── Runtimes
└── Servers
```

Issues e melhorias pertencem obrigatoriamente a uma aplicação e podem afetar
um ou mais componentes dela. Procedimentos podem permanecer gerais ao
workspace ou ser relacionados opcionalmente a uma aplicação e seus
componentes. A UI e o MCP consomem esses contratos exclusivamente pela API.

## Contratos comuns

- `id` é um UUID público opaco; `_id` do MongoDB não faz parte da API.
- `key` é o identificador editável: usa letras minúsculas, números e hífens e
  permanece único no escopo de cada entidade.
- O workspace padrão é criado por upsert idempotente e continua sendo o único
  workspace operacional até a autorização por escopo.
- Recursos são arquivados, não excluídos fisicamente.
- Todas as rotas exigem autenticação, rejeitam seleção dinâmica de banco e
  validam permissões no backend.
- Respostas de lista usam `{ "meta": {}, "items": [] }`; detalhes usam o nome
  singular da entidade.
- Listas aceitam `q`, `status`, `includeArchived=true`, `page` e `limit`. O
  limite máximo é 100 e o padrão é 50.
- Relações usam IDs e são validadas novamente no backend.

## Rotas de workspace e aplicações

| Método  | Rota                                                | Permissão                                                            |
| ------- | --------------------------------------------------- | -------------------------------------------------------------------- |
| `GET`   | `/api/catalog/workspaces`                           | `workspaces.read`                                                    |
| `GET`   | `/api/catalog/workspaces/:workspaceId`              | `workspaces.read`                                                    |
| `GET`   | `/api/catalog/workspaces/:workspaceId/applications` | `applications.read`                                                  |
| `POST`  | `/api/catalog/workspaces/:workspaceId/applications` | `applications.create`                                                |
| `GET`   | `/api/catalog/applications/:applicationId`          | `applications.read`                                                  |
| `PATCH` | `/api/catalog/applications/:applicationId`          | `applications.update`                                                |
| `PATCH` | `/api/catalog/applications/:applicationId/archive`  | `applications.archive`                                               |
| `GET`   | `/api/catalog/applications/:applicationId/context`  | todas as permissões de leitura do catálogo e da base de conhecimento |

Uma aplicação não pode ser arquivada enquanto possuir integrações,
componentes ou repositórios ativos, deployments ou runtimes não arquivados.

## Integrações

| Método  | Rota                                                    | Permissão              |
| ------- | ------------------------------------------------------- | ---------------------- |
| `GET`   | `/api/catalog/applications/:applicationId/integrations` | `integrations.read`    |
| `POST`  | `/api/catalog/applications/:applicationId/integrations` | `integrations.create`  |
| `GET`   | `/api/catalog/integrations/:integrationId`              | `integrations.read`    |
| `PATCH` | `/api/catalog/integrations/:integrationId`              | `integrations.update`  |
| `PATCH` | `/api/catalog/integrations/:integrationId/archive`      | `integrations.archive` |

```json
{
  "key": "customer-api",
  "name": "Customer API",
  "description": "Consulta o cadastro de clientes",
  "targetApplicationId": "uuid"
}
```

A integração é direcional e aponta para outra aplicação ativa do mesmo
workspace. O destino é imutável. Uma aplicação pode existir apenas
para representar o sistema integrado, sem repositórios, componentes,
deployments ou runtimes próprios.

## Componentes

| Método  | Rota                                                  | Permissão            |
| ------- | ----------------------------------------------------- | -------------------- |
| `GET`   | `/api/catalog/applications/:applicationId/components` | `components.read`    |
| `POST`  | `/api/catalog/applications/:applicationId/components` | `components.create`  |
| `GET`   | `/api/catalog/components/:componentId`                | `components.read`    |
| `PATCH` | `/api/catalog/components/:componentId`                | `components.update`  |
| `PATCH` | `/api/catalog/components/:componentId/archive`        | `components.archive` |

Filtros adicionais: `type`, `repositoryId` e `dependencyComponentId`.

```json
{
  "key": "billing-api",
  "name": "Billing API",
  "description": "API de acompanhamento de jornadas",
  "type": "api",
  "repositoryLinks": [
    {
      "repositoryId": "uuid",
      "role": "source"
    }
  ],
  "dependencies": [
    {
      "componentId": "uuid",
      "kind": "http",
      "description": "Consulta de clientes"
    }
  ],
  "tags": ["backend"]
}
```

Tipos: `api`, `ui`, `worker`, `service`, `library`, `integration` e `other`.
Papéis de repositório: `source`, `configuration`, `infrastructure`,
`documentation` e `other`. Relações duplicadas e dependência de si mesmo são
recusadas. Ciclos entre componentes são permitidos.

Um componente não pode ser arquivado enquanto for dependência de componente
ativo ou possuir deployment não arquivado.

## Repositórios

| Método  | Rota                                                    | Permissão                               |
| ------- | ------------------------------------------------------- | --------------------------------------- |
| `GET`   | `/api/catalog/applications/:applicationId/repositories` | `repositories.read`                     |
| `POST`  | `/api/catalog/applications/:applicationId/repositories` | `repositories.create`                   |
| `GET`   | `/api/catalog/repositories/:repositoryId`               | `repositories.read`                     |
| `GET`   | `/api/catalog/repositories/:repositoryId/components`    | `repositories.read` + `components.read` |
| `PATCH` | `/api/catalog/repositories/:repositoryId`               | `repositories.update`                   |
| `PATCH` | `/api/catalog/repositories/:repositoryId/archive`       | `repositories.archive`                  |

Filtro adicional: `provider`.

```json
{
  "key": "billing",
  "name": "Billing",
  "provider": "github",
  "organization": "bondia",
  "url": "https://github.com/bondia/billing.git",
  "defaultBranch": "main",
  "sync": {
    "mode": "manual",
    "lastSyncedAt": null,
    "state": "never"
  }
}
```

Provedores: `github`, `gitlab`, `bitbucket`, `azure-devops`, `local` e
`other`. URLs aceitam somente HTTP(S), sem usuário, senha ou parâmetros com
nomes associados a segredos. A URL pode mudar sem alterar o ID.

Um repositório não pode ser arquivado enquanto estiver ligado a componente
ativo ou for origem de deployment não arquivado.

## Servidores

| Método  | Rota                                           | Permissão                           |
| ------- | ---------------------------------------------- | ----------------------------------- |
| `GET`   | `/api/catalog/workspaces/:workspaceId/servers` | `servers.read`                      |
| `POST`  | `/api/catalog/workspaces/:workspaceId/servers` | `servers.create`                    |
| `GET`   | `/api/catalog/servers/:serverId`               | `servers.read`                      |
| `GET`   | `/api/catalog/servers/:serverId/runtimes`      | `servers.read` + `runtimes.read`    |
| `GET`   | `/api/catalog/servers/:serverId/deployments`   | `servers.read` + `deployments.read` |
| `PATCH` | `/api/catalog/servers/:serverId`               | `servers.update`                    |
| `PATCH` | `/api/catalog/servers/:serverId/archive`       | `servers.archive`                   |

```json
{
  "key": "production-1",
  "name": "Production 1",
  "hostname": "prod-1.example.test",
  "addresses": ["10.0.0.10"],
  "provider": "on-premises",
  "location": "São Paulo",
  "operatingSystem": "Linux",
  "purpose": "Aplicações de produção",
  "status": "active",
  "tags": ["production"]
}
```

Estados: `active`, `maintenance`, `retired` e `archived`. Endereços que usam
formato de URL não podem conter credenciais ou parâmetros secretos. Um servidor
não pode ser arquivado enquanto possuir runtime não arquivado.

## Deployments

| Método  | Rota                                                   | Permissão             |
| ------- | ------------------------------------------------------ | --------------------- |
| `GET`   | `/api/catalog/applications/:applicationId/deployments` | `deployments.read`    |
| `POST`  | `/api/catalog/applications/:applicationId/deployments` | `deployments.create`  |
| `GET`   | `/api/catalog/deployments/:deploymentId`               | `deployments.read`    |
| `PATCH` | `/api/catalog/deployments/:deploymentId`               | `deployments.update`  |
| `PATCH` | `/api/catalog/deployments/:deploymentId/archive`       | `deployments.archive` |

Filtros adicionais: `componentId`, `repositoryId`, `environment` e `serverId`.

```json
{
  "key": "billing-production",
  "name": "Billing production",
  "componentId": "uuid",
  "environment": "production",
  "repositoryId": "uuid",
  "status": "active",
  "publications": [
    {
      "version": "1.0.0",
      "revision": "abc123",
      "repositoryId": "uuid",
      "publishedAt": "2026-07-28T15:00:00.000Z",
      "description": "Primeira versão produtiva"
    }
  ]
}
```

Ambientes: `development`, `test`, `staging`, `production` e `other`. Estados:
`planned`, `deploying`, `active`, `inactive`, `failed` e `archived`.
`componentId` é imutável e deve pertencer à aplicação. O repositório de origem,
quando informado, também deve pertencer à aplicação.

`publications` é um histórico append-only com até 200 itens. `version`,
`source.revision` e `deployedAt` continuam materializados na resposta com os
dados da publicação mais recente para compatibilidade.

Um deployment não pode ser arquivado enquanto possuir runtime não arquivado.

## Runtimes

| Método  | Rota                                              | Permissão          |
| ------- | ------------------------------------------------- | ------------------ |
| `GET`   | `/api/catalog/deployments/:deploymentId/runtimes` | `runtimes.read`    |
| `POST`  | `/api/catalog/deployments/:deploymentId/runtimes` | `runtimes.create`  |
| `GET`   | `/api/catalog/runtimes/:runtimeId`                | `runtimes.read`    |
| `PATCH` | `/api/catalog/runtimes/:runtimeId`                | `runtimes.update`  |
| `PATCH` | `/api/catalog/runtimes/:runtimeId/archive`        | `runtimes.archive` |

Filtros adicionais: `serverId` e `kind`.

```json
{
  "key": "billing-production-1",
  "name": "Billing production 1",
  "kind": "container",
  "serverId": "uuid",
  "endpoint": "https://billing.example.test",
  "port": 443,
  "namespace": "billing",
  "runtimeName": "billing-api",
  "status": "healthy",
  "metadata": {
    "image": "billing:1.0.0",
    "replicas": 2
  },
  "monitoringRetentionDays": 10,
  "documentLinks": [
    {
      "documentId": "document-id",
      "purpose": "operation"
    }
  ],
  "operationalNotesMarkdown": "# Instruções complementares\n\n1. Atualize a imagem."
}
```

Tipos: `process`, `container`, `kubernetes`, `serverless`, `managed`,
`external` e `other`. Estados: `unknown`, `healthy`, `degraded`,
`unavailable`, `stopped` e `archived`.

O runtime herda workspace, aplicação e componente do deployment. Um servidor é
opcional, mas, quando informado, deve pertencer ao mesmo workspace e não pode
estar arquivado. `metadata` aceita no máximo 25 chaves, 16 KiB, escalares ou
arrays de até 20 escalares; objetos aninhados e chaves associadas a senhas,
tokens, credenciais, chaves privadas, kubeconfig ou connection strings são
recusados.

`monitoringRetentionDays` controla a retenção dos eventos desse runtime, usa 10
dias por padrão, aceita de 0 a 3.650 e recalcula os eventos existentes quando
alterado. O valor 0 desativa a expiração. As notas operacionais aceitam até
20.000 caracteres em Markdown. Cada vínculo documental informa um propósito
entre `operation`, `deployment`, `rollback`, `troubleshooting`, `monitoring` e
`reference`.

## Monitoramento

| Método   | Rota                                                                               | Permissão                   |
| -------- | ---------------------------------------------------------------------------------- | --------------------------- |
| `POST`   | `/api/monitoring/runtimes/:runtimeReference/signals`                               | `monitoring.signals.create` |
| `POST`   | `/api/monitoring/runtimes/:runtimeReference/manual-observations`                   | `runtimes.update`           |
| `GET`    | `/api/monitoring/runtimes/:runtimeReference/signals`                               | `runtimes.read`             |
| `GET`    | `/api/monitoring/runtimes/:runtimeReference/timeline`                              | `runtimes.read`             |
| `GET`    | `/api/monitoring/applications/:applicationId/health`                               | `runtimes.read`             |
| `GET`    | `/api/monitoring/metadata-profiles`                                                | `runtimes.read`             |
| `GET`    | `/api/monitoring/runtimes/:runtimeReference/active-monitors`                       | `runtimes.read`             |
| `POST`   | `/api/monitoring/runtimes/:runtimeReference/active-monitors`                       | `runtimes.update`           |
| `PATCH`  | `/api/monitoring/runtimes/:runtimeReference/active-monitors/:monitorId`            | `runtimes.update`           |
| `DELETE` | `/api/monitoring/runtimes/:runtimeReference/active-monitors/:monitorId`            | `runtimes.update`           |
| `POST`   | `/api/monitoring/runtimes/:runtimeReference/active-monitors/:monitorId/executions` | `monitoring.active.request` |
| `POST`   | `/api/monitoring/executor/leases`                                                  | `monitoring.active.execute` |
| `POST`   | `/api/monitoring/executor/leases/:leaseToken/renew`                                | `monitoring.active.execute` |
| `POST`   | `/api/monitoring/executor/leases/:leaseToken/results`                              | `monitoring.active.execute` |

Sinais passivos, execuções ativas e observações manuais são persistidos em
`runtimeMonitoringSignals`, diferenciados por `origin`. O sinal mais recente por
`observedAt` materializa `status`, `observedAt` e `monitoring` no runtime.
`signalId`, quando enviado, torna retries idempotentes no escopo do runtime.
`metadataProfile` referencia um contrato versionado conhecido pelo serviço. A
API valida os metadados pelo perfil, persiste apenas sua identificação e expande
`metadataPresentation` nas respostas para orientar badges, percentuais e séries.
O catálogo vigente desses contratos integrados, acompanhado da quantidade de
observações no workspace, é retornado por `/api/monitoring/metadata-profiles`.
`payload` preserva JSON aninhado de diagnóstico sob os limites e bloqueios de
segredos documentados. A rota `timeline` retorna ambos na mesma ordenação.
`runtimeReference` aceita o UUID do runtime ou o caminho de identificadores
`<aplicação>.<componente>.<deployment>.<runtime>` dentro do workspace do ator.
O UUID permanece estável; o caminho muda quando um desses identificadores é
editado.
O endpoint de aplicação agrega contagens por estado e retorna a pior saúde
observada entre seus runtimes não arquivados.
Veja o [guia de monitoramento](../../docs/monitoring.md).

## Contexto agregado

`GET /api/catalog/applications/:applicationId/context` retorna a aplicação e
resumos limitados de integrações, componentes, repositórios, deployments, runtimes,
servidores referenciados, issues, melhorias e documentos.

- `limit` controla o máximo por coleção, com teto de 100 e padrão 25;
- `includeArchived=true` inclui recursos arquivados;
- `meta.totals` informa as contagens;
- `meta.truncated` informa quais grupos foram truncados;
- hostname e endereços de servidores e `metadata` de runtimes não são expostos
  no agregado;
- anexos e textos extensos de issues, melhorias e documentos também são
  omitidos.

Como o endpoint combina todos os domínios, ele exige as sete permissões de
leitura do catálogo — aplicação, integração, componente, repositório, servidor,
deployment e runtime — e as três permissões `issues.read`, `demands.read` e
`documents.read`.

O mesmo contexto está disponível no MCP pela ferramenta
`applications_get_context`. O MCP não amplia as permissões da chave usada e
não consulta o banco diretamente.

## Relação da base de conhecimento com o catálogo

Os registros de issue, melhoria e documentação usam os campos:

- `workspaceId`;
- `applicationId`;
- `affectedComponentIds`.

`applicationId` é obrigatório na criação de issues e melhorias. Em
procedimentos, guidelines e referências técnicas, `applicationId` e os
componentes afetados são opcionais. Regras, decisões e features exigem uma
aplicação. A API
confirma que a aplicação pertence ao workspace e que cada componente pertence
à aplicação antes de persistir a relação.

Listagens e buscas aceitam `workspaceId`, `applicationId` e `componentId`.
Quando `componentId` é informado, a busca considera
`affectedComponentIds`.

## Integridade, segurança e erros

O backend recusa recursos inexistentes, arquivados ou pertencentes a outra
aplicação/workspace. Principais códigos:

- `404`: `*_NOT_FOUND`;
- `409`: `*_IN_USE`, `*_ARCHIVED`, `*_KEY_CONFLICT`,
  `*_CONCURRENT_UPDATE` e relações imutáveis;
- `422`: payload, enum, paginação, URL, metadata ou relação inválida.

Senhas, tokens, chaves privadas, connection strings com credenciais e
kubeconfigs não fazem parte de nenhum schema. A API não executa SSH, comandos,
deploys ou sincronização Git.

## Auditoria

Criação, atualização, arquivamento e mudanças de relacionamento produzem
eventos funcionais. Os históricos podem ser consultados em:

```text
GET /api/audit/component/:id
GET /api/audit/repository/:id
GET /api/audit/server/:id
GET /api/audit/deployment/:id
GET /api/audit/runtime/:id
```

Cada leitura exige a permissão do tipo correspondente.

## Índices e validação com MongoDB

As coleções são `applicationComponents`, `applicationRepositories`, `servers`,
`applicationDeployments` e `deploymentRuntimes`. Os índices incluem ID público
único, key única no escopo e caminhos de consulta reversa.

Os testes de integração são opt-in para não exigir MongoDB na suíte unitária:

```bash
BIAWS_INTEGRATION_MONGO_URI=mongodb://127.0.0.1:27017 \
BIAWS_INTEGRATION_MONGO_DB=biaws_topology_integration \
node --test test/topologyIntegration.test.js

BIAWS_INTEGRATION_MONGO_URI=mongodb://127.0.0.1:27017 \
BIAWS_HTTP_INTEGRATION=1 \
BIAWS_HTTP_INTEGRATION_MONGO_DB=biaws_topology_http_integration \
node --test test/topologyHttpIntegration.test.js
```

O primeiro teste cobre persistência, referências cruzadas, consultas reversas,
conflitos de arquivamento, concorrência de key, contexto e índices. O segundo
cobre `401`, `403`, CRUD HTTP, relações, validação de segredos e auditoria.
