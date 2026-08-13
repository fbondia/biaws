# Monitoramento de runtimes

O monitoramento passivo continua recebendo sinais de agentes externos. A API
também mantém as configurações e o protocolo de leases usados pelo componente
independente de monitoramento ativo. Em ambos os casos, a API é responsável por
tenancy, autorização, histórico, idempotência, retenção e auditoria; executores
não acessam o banco diretamente.

## Estados e contrato

Estados aceitos: `unknown`, `healthy`, `degraded`, `unavailable` e `stopped`.

```http
POST /api/monitoring/runtimes/:runtimeReference/signals
Authorization: Bearer <api-key>
X-Biaws-Workspace-Id: <workspace-id>
Content-Type: application/json
```

`runtimeReference` aceita o UUID público do runtime ou o caminho de
identificadores
`<aplicação>.<componente>.<deployment>.<runtime>`. Cada identificador é único
em seu contexto; o caminho completo resolve esses contextos em sequência dentro
do workspace autenticado. Exemplo:

```text
billing.billing-api.production.primary
```

O UUID permanece estável. O caminho é legível, mas muda quando qualquer um dos
quatro identificadores é editado; atualize os emissores que usam o caminho após
essa alteração.

```json
{
  "signalId": "zabbix:event:18492",
  "status": "degraded",
  "observedAt": "2026-07-31T15:00:00.000Z",
  "source": "zabbix",
  "message": "Latência acima de 800 ms",
  "metadata": { "latency_ms": 850, "region": "sa-east-1" },
  "payload": {
    "probe": { "statusCode": 503, "durationMs": 850 },
    "dependencies": [{ "name": "database", "healthy": false }]
  }
}
```

`status` e `source` são obrigatórios. `observedAt` usa o horário de recepção
quando omitido. `signalId` é opcional, mas recomendado: a combinação de
workspace, runtime e `signalId` é idempotente. O primeiro recebimento responde
`201`; uma repetição responde `200`, `created: false` e o registro original.

Metadados seguem as restrições do runtime: até 25 chaves e 16 KiB, somente
escalares ou arrays de escalares e sem nomes associados a credenciais ou
segredos. Não envie tokens, cabeçalhos de autorização ou conteúdo de resposta.

`metadataProfile` é opcional e associa os metadados a um contrato versionado de
validação e apresentação. O perfil integrado `sgmp-health/v1` descreve estados
de serviço e banco, percentual de disco e uma série histórica de erros. O evento
persiste somente o identificador; nas respostas de leitura a API acrescenta
`metadataPresentation` com rótulos, formatos e visualizações declarativas para a
UI. Perfis desconhecidos ou valores incompatíveis retornam `422`.

O perfil `sgmp-api-health/v1` estende essa apresentação para a API de
automações, acrescentando tempo de resposta do banco e os indicadores do pool
Hikari: estado, utilização, conexões ativas/ociosas/totais, threads aguardando e
limites configurados.

Esses perfis integrados permanecem aceitos para leitura e envio legado. A
migração de monitoramento materializa `sgmp-health/v1` e
`sgmp-api-health/v1` como versões ativas dos templates persistidos
`sgmp-health` e `sgmp-api-health` em cada workspace que já possui observações
com perfil integrado. Eventos históricos não são alterados nem reinterpretados.

```json
{
  "metadataProfile": "sgmp-health/v1",
  "metadata": {
    "service_up": true,
    "database_up": true,
    "disk_usage_percent": 73.42,
    "error_history_dates": ["2026-08-01", "2026-08-02"],
    "error_history_values": [12, 18],
    "error_history_unit": "files"
  }
}
```

Para dados estruturados, `payload` aceita JSON aninhado com até 64 KiB, oito
níveis, 1.000 valores, arrays de até 100 itens e strings de até 8.000 caracteres.
Chaves precisam começar por uma letra e usar letras, números, `_`, `.`, `:` ou
`-`; nomes associados a credenciais e segredos são rejeitados em qualquer
nível. Use `metadata` para dimensões pequenas e pesquisáveis e `payload` para o
diagnóstico detalhado. O payload é exibido somente nos detalhes do evento.

Sinais fora de ordem permanecem no histórico, mas só atualizam a saúde
materializada quando `observedAt` é igual ou posterior ao último sinal aplicado.

## Templates unificados

Novas versões podem usar o schema unificado `1`. Cada versão é imutável e
declara, no mesmo documento, a amostra JSON de entrada, a transformação JSONata,
o contrato da observação normalizada e o catálogo de apresentação. O contrato
limita a 100 campos de metadados e 20 séries, recusa chaves sensíveis e aceita
somente `application/json` e a linguagem `jsonata` nesta versão.

```json
{
  "schemaVersion": "1",
  "input": {
    "mediaType": "application/json",
    "sample": { "status": "healthy", "message": "OK", "metadata": {} }
  },
  "transformation": {
    "language": "jsonata",
    "expression": "{\"status\": status, \"message\": message, \"metadata\": metadata}"
  },
  "output": {
    "status": {
      "type": "string",
      "required": true,
      "enum": ["healthy", "degraded", "unavailable", "unknown"]
    },
    "message": { "type": "string", "required": false, "maxLength": 2000 },
    "metadata": {
      "type": "object",
      "required": true,
      "additionalProperties": false,
      "fields": []
    }
  },
  "presentation": { "label": "Saúde", "fields": [], "series": [] }
}
```

Templates antigos baseados em `rules` e `defaultResult` continuam legíveis e
avaliáveis durante a transição. Observações produzidas por uma versão unificada
guardam um snapshot do contrato e da apresentação aplicados; observações antigas
continuam usando `metadataPresentation` derivado de `metadataProfile`.

A expressão JSONata é compilada e executada contra a amostra antes da ativação.
Pré-visualização, sinais externos e resultados ativos usam o mesmo avaliador em
worker isolado, com cancelamento real, limite de tempo e memória e sem funções ou
bindings personalizados. O resultado precisa ser um único objeto com `status`,
`message` e `metadata` compatíveis com o contrato; tipos, limites, enums e séries
desalinhadas são recusados. Diagnósticos persistidos são limitados a códigos e
posições sanitizados, sem stack trace ou conteúdo da expressão.

Ao enviar `templateRef` em um sinal externo, o servidor avalia apenas `payload`
e ignora `status`, `message` e `metadata` calculados pelo cliente. No provider
REST, um monitor com template aceita como entrada somente o corpo completo de
uma resposta com media type JSON (`application/json` ou `application/*+json`);
corpo truncado, inválido ou de outro tipo produz falha segura do template.

O contrato e a amostra de uma versão podem ser descobertos sem expor a
expressão ou registrar uma observação. A validação usa o mesmo avaliador isolado
de REST e sinais externos:

```http
GET  /api/monitoring/templates/:templateId/versions/:version/contract
POST /api/monitoring/templates/:templateId/versions/:version/validate
```

O `POST` recebe `{ "sample": <json> }`. Ambas as operações exigem
`runtimes.read`, escopo do workspace e nunca persistem o JSON testado.

`npm run migrate:monitoring` informa em dry-run quantos templates seriam
criados. `npm run migrate:monitoring -- --apply` cria somente os ausentes; a
chave única `(workspaceId, id, version)` torna execuções repetidas idempotentes.

## CLI

Com `ISSUE_API_URL` e `ISSUE_API_KEY` configurados, selecione o workspace com
`--workspace` (ou `ISSUE_WORKSPACE_ID` em uma execução direta do CLI):

```bash
node biaws-cli/src/index.js monitoring signal billing.billing-api.production.primary \
  --workspace id-do-workspace \
  --status healthy \
  --source synthetic-http \
  --signal-id synthetic-http:2026-07-31T15:00:00Z \
  --observed-at 2026-07-31T15:00:00Z \
  --message "HTTP 200 em 35 ms" \
  --metadata '{"latency_ms":35}' \
  --payload '{"probe":{"statusCode":200,"durationMs":35}}'
```

```bash
node biaws-cli/src/index.js monitoring signals billing.billing-api.production.primary --workspace id-do-workspace --limit 20
node biaws-cli/src/index.js monitoring signals <runtime-uuid> --workspace id-do-workspace --limit 20 --json
```

Para descobrir um contrato, validar o payload e então registrar um sinal
calculado pelo servidor:

```bash
node biaws-cli/src/index.js monitoring describe \
  --workspace id-do-workspace --template sgmp-health --template-version 1

node biaws-cli/src/index.js monitoring validate \
  --workspace id-do-workspace --template sgmp-health --template-version 1 \
  --payload '{"status":"healthy","message":"OK","metadata":{"service_up":true}}'

node biaws-cli/src/index.js monitoring signal billing.billing-api.production.primary \
  --workspace id-do-workspace --source synthetic-http \
  --template sgmp-health --template-version 1 \
  --payload '{"status":"healthy","message":"OK","metadata":{"service_up":true}}'
```

Com `templateRef`, não envie decisões calculadas pelo cliente: a API deriva
`status`, `message` e `metadata` exclusivamente do JSON informado em `payload`.

O emissor precisa de `monitoring.signals.create` no escopo da aplicação do
runtime. A leitura exige `runtimes.read`. O grupo de sistema “Agente operacional”
recebe a permissão de envio; o grupo “Administração” recebe todo o catálogo.

## Integração de agentes externos

- gere um `signalId` estável por evento ou janela, para repetição segura;
- use o instante real da observação em UTC no formato ISO-8601;
- defina timeouts e retries com backoff no emissor;
- trate `200` e `201` como sucesso;
- trate `401` como credencial ausente/inválida, `403` como falta de permissão,
  `404` como runtime fora do escopo e `422` como payload inválido;
- não use o health check da própria API como saúde das aplicações cadastradas.

Cada novo sinal gera o evento funcional `monitoring_signal_received` na auditoria
do runtime. Retentativas idempotentes não geram outro evento.

## Configurações de monitoramento ativo

As configurações ficam em `runtimeActiveMonitors`, separadas do documento do
runtime para permitir consulta eficiente da agenda e aquisição concorrente. Um
runtime aceita até 50 configurações não arquivadas.

```http
GET    /api/monitoring/runtimes/:runtimeReference/active-monitors
POST   /api/monitoring/runtimes/:runtimeReference/active-monitors
PATCH  /api/monitoring/runtimes/:runtimeReference/active-monitors/:monitorId
DELETE /api/monitoring/runtimes/:runtimeReference/active-monitors/:monitorId
```

As mesmas operações de administração estão disponíveis para agentes pelas
tools MCP `monitoring_templates_*` e `runtime_active_monitors_*`. O MCP usa o
workspace definido em `ISSUE_WORKSPACE_ID`, nunca aceita ampliação de escopo por
argumento e delega autorização, validação e auditoria à API. Monitores que ainda
aguardam o provisionamento do executor devem ser cadastrados com
`enabled: false`.

Leitura exige `runtimes.read`; mutações exigem `runtimes.update` e são
auditadas. `DELETE` arquiva a configuração. O contrato inicial aceita `name`,
`description`, `provider` (`rest` ou `shell`), `enabled`, `intervalSeconds`
(10 a 86.400), `timeoutSeconds` (1 a 300 e nunca maior que o intervalo),
`configuration` e `templateRef`. A configuração usa JSON limitado e recusa
campos associados a credenciais; referências a templates são validadas no
workspace e na versão informada. `templateRef` é exclusivo do provider REST:
novos monitores Shell com template são rejeitados com
`SHELL_TEMPLATE_NOT_SUPPORTED`.

No provider Shell, `configuration` aceita `scriptId`, `arguments`,
`environment`, `failureStatus` (`unknown`, `degraded` ou `unavailable`, padrão
`unavailable`) e `captureOutput` (`none`, `stdout`, `stderr` ou `both`, padrão
`none`). Código de término `0` sempre produz `healthy`; qualquer outro código
produz o `failureStatus` configurado. Saída capturada é sanitizada, truncada no
limite do executor e persistida somente nas chaves estáveis `shell_stdout` e
`shell_stderr` dos metadados. Sem captura, nenhuma saída é persistida.

Monitores Shell legados com `templateRef` continuam legíveis, mas qualquer
edição deve remover a referência. O executor e a API nunca avaliam esse template
legado. `npm run migrate:monitoring -- --apply` remove essas referências de
forma idempotente, incrementa a versão do monitor e informa as contagens
`legacyShellTemplates` e `legacyShellTemplatesRemoved`; sem `--apply`, apenas
reporta o plano.

## Contrato do executor

O executor usa uma identidade técnica com `monitoring.active.execute`. Essa
permissão pode ser limitada por aplicação e não pertence ao grupo padrão
“Agente operacional”.

```http
POST /api/monitoring/executor/leases
POST /api/monitoring/executor/leases/:leaseToken/renew
POST /api/monitoring/executor/leases/:leaseToken/results
```

A aquisição recebe `executorId`, `limit` (até 25) e `leaseSeconds` (10 a 300).
Cada item inclui configuração, `leaseToken`, `executionId`, `scheduledFor` e
`leasedUntil`. Apenas o mesmo executor pode renovar ou publicar enquanto o
lease for válido. Leases expirados preservam o `executionId` da ocorrência ao
serem retomados; a publicação usa esse ID em um `signalId` estável, tornando
retries idempotentes. Resultados ativos materializam a saúde do runtime e entram
na timeline com `origin: active`, `monitorId`, `executionId`, provider e a versão
do template usada.

## Processo executor

`biaws-monitor-executor` é um processo Node.js implantável separadamente. Cada
réplica usa uma identidade técnica dedicada e um workspace fixo, consulta leases
continuamente, limita a concorrência local, renova trabalhos longos e publica o
resultado pelo contrato acima. Como a agenda e o lease ficam persistidos na API,
reinícios e réplicas concorrentes não dependem de estado local para coordenar a
mesma ocorrência.

Falhas temporárias de transporte, `408`, `425`, `429` e respostas `5xx` usam
retry exponencial limitado com jitter. `409` por perda de lease não é repetido.
Em `SIGTERM` ou `SIGINT`, novas aquisições cessam e os trabalhos recebem um
período de graça; após o limite, são cancelados e o lease expirado pode ser
recuperado por outra réplica com o mesmo `executionId`.

O executor percebe alterações de configuração na próxima aquisição, sem
reinício. REST e shell usam registro extensível com schema, validação, execução
cancelável e normalização de evidência. O provider REST exige allowlist local de
hosts, revalida DNS e redirects e bloqueia redes privadas/especiais por padrão.
O provider shell aceita somente `scriptId` allowlisted localmente, sem shell
intermediário, e restringe caminho, `cwd`, argumentos e ambiente. Seu resultado
é definido pelo código de término, sem template; captura de saída é opcional e
limitada. Configurações recusadas e timeouts produzem `unknown` com diagnóstico
sanitizado; respostas válidas do alvo são distinguidas por `outcome_kind`.

Endpoints locais, por padrão na porta `3110`:

- `/health/live`: ciclo do processo;
- `/health/ready`: aquisição recente da API ou modo desabilitado;
- `/metrics`: métricas Prometheus de atraso, duração, retries, leases e falhas.

O serviço Compose usa o profile `active-monitoring` e não altera a instalação
padrão. Configure `BIAWS_MONITOR_EXECUTOR_API_KEY` e
`BIAWS_MONITOR_EXECUTOR_WORKSPACE_ID`, então inicie e escale independentemente:

```bash
docker compose --profile active-monitoring up -d monitor-executor
docker compose --profile active-monitoring up -d --scale monitor-executor=2 monitor-executor
```

Defina `BIAWS_MONITOR_EXECUTOR_ENABLED=false` para manter a réplica disponível
sem adquirir novas ocorrências. A referência completa de configuração está em
`biaws-monitor-executor/README.md`.

## Leitura HTTP

```http
GET /api/monitoring/runtimes/:runtimeReference/signals?page=1&limit=50&status=degraded&observedFrom=2026-07-01&observedTo=2026-07-31
```

Para uma linha do tempo única com sinais passivos, execuções ativas e
observações manuais:

```http
GET /api/monitoring/runtimes/:runtimeReference/timeline?page=1&limit=50&status=degraded&observedFrom=2026-07-01&observedTo=2026-07-31
```

Observações manuais usam o mesmo histórico:

```http
POST /api/monitoring/runtimes/:runtimeReference/manual-observations
```

O corpo aceita `status`, `observedAt`, `source`, `message` e `metadata`. A
permissão necessária é `runtimes.update`; observações manuais não alteram a
saúde materializada pelo último resultado ativo ou sinal passivo.

```http
GET /api/monitoring/applications/:applicationId/health
```

O histórico usa `{ "meta": {}, "items": [] }`, ordenado por observação e
recepção mais recentes. Os filtros opcionais `status`, `observedFrom` e
`observedTo` são aplicados antes da paginação; datas no formato `YYYY-MM-DD`
incluem o dia inteiro em UTC. A saúde da aplicação usa `{ "health": {} }`, agrega os runtimes e prioriza
`unavailable`, `degraded`, `stopped`, `unknown` e `healthy`, nessa ordem. A
retenção usa `monitoringRetentionDays` do runtime, com padrão de 10 dias. Cada
evento recebe `expiresAt` e um índice TTL o remove automaticamente. Use 0 para
desativar a expiração de um runtime.
