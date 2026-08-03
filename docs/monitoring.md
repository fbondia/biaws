# Recepção passiva de sinais de monitoramento

O Bondia Workspaces não executa probes, scrapes ou verificações. Agentes externos
observam os serviços e enviam sinais de saúde para um runtime cadastrado. A API
mantém o histórico, atualiza a saúde materializada do runtime e a UI a apresenta
na topologia e na área de monitoramento.

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

## CLI

Com `ISSUE_API_URL`, `ISSUE_API_KEY` e `ISSUE_WORKSPACE_ID` configurados:

```bash
node biaws-cli/src/index.js monitoring signal billing.billing-api.production.primary \
  --status healthy \
  --source synthetic-http \
  --signal-id synthetic-http:2026-07-31T15:00:00Z \
  --observed-at 2026-07-31T15:00:00Z \
  --message "HTTP 200 em 35 ms" \
  --metadata '{"latency_ms":35}' \
  --payload '{"probe":{"statusCode":200,"durationMs":35}}'
```

```bash
node biaws-cli/src/index.js monitoring signals billing.billing-api.production.primary --limit 20
node biaws-cli/src/index.js monitoring signals <runtime-uuid> --limit 20 --json
```

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

## Leitura HTTP

```http
GET /api/monitoring/runtimes/:runtimeReference/signals?page=1&limit=50&status=degraded&observedFrom=2026-07-01&observedTo=2026-07-31
```

Para uma linha do tempo única com sinais externos e observações manuais:

```http
GET /api/monitoring/runtimes/:runtimeReference/timeline?page=1&limit=50&status=degraded&observedFrom=2026-07-01&observedTo=2026-07-31
```

Observações manuais usam o mesmo histórico:

```http
POST /api/monitoring/runtimes/:runtimeReference/manual-observations
```

O corpo aceita `status`, `observedAt`, `source`, `message` e `metadata`. A
permissão necessária é `runtimes.update`; observações manuais não alteram a
saúde materializada pelo último sinal externo.

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
