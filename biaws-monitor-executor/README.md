# Executor de monitoramento ativo

Processo independente que consome os contratos HTTP de leases da API do BIAWS.
O componente não acessa MongoDB, cofre ou filesystem da API. Configurações são
recarregadas a cada aquisição e a API continua responsável pela agenda
persistente, coordenação entre réplicas, tenancy, idempotência e histórico.

## Ciclo de execução

1. adquire até `BIAWS_MONITOR_EXECUTOR_CONCURRENCY` ocorrências vencidas;
2. executa o provider registrado respeitando o timeout do monitor;
3. renova o lease durante trabalhos longos;
4. publica o resultado com retry exponencial e jitter;
5. interrompe novas aquisições em `SIGTERM`/`SIGINT` e aguarda os trabalhos até
   o limite de desligamento gracioso.

Os providers REST e shell são registrados independentemente do núcleo. Cada um
expõe schema, valida configuração, executa com cancelamento e normaliza uma
evidência limitada. Falha do provider/configuração usa `failure_stage: provider`;
falha futura de avaliação usa `failure_stage: template`; resposta válida mas não
saudável usa `outcome_kind: target_unhealthy`.

## Políticas dos providers

REST é deny-by-default. Configure:

- `BIAWS_MONITOR_REST_ALLOWED_HOSTS`: hosts separados por vírgula; `*.example.com`
  aceita somente subdomínios;
- `BIAWS_MONITOR_REST_ALLOWED_METHODS`: métodos separados por vírgula; o padrão
  seguro aceita somente `GET,HEAD`;
- `BIAWS_MONITOR_REST_ALLOW_PRIVATE_ADDRESSES`: `false` por padrão; mantenha
  assim para bloquear loopback, link-local, redes privadas e especiais;
- `BIAWS_MONITOR_REST_MAX_REDIRECTS`: padrão `3`; cada destino é novamente
  validado e redirects de métodos com efeito colateral são recusados;
- `BIAWS_MONITOR_REFERENCE_ENV_MAP`: JSON que associa referências públicas a
  nomes de variáveis de ambiente, por exemplo
  `{"service-auth":"SERVICE_AUTH_HEADER"}`. A configuração usa
  `headerRefs: [{"name":"Authorization","reference":"service-auth"}]`;
  o valor resolvido nunca entra na evidência ou nos logs.

O provider REST fixa cada conexão no endereço DNS validado, desativa reuso de
socket e limita método, protocolo, headers, corpo e resposta. Headers sensíveis
inline e redirects entre origens são recusados.

Shell também é deny-by-default e nunca usa `shell: true`. Configure:

- `BIAWS_MONITOR_SHELL_ROOT`: raiz que contém scripts e diretórios de trabalho;
- `BIAWS_MONITOR_SHELL_SCRIPTS`: JSON indexado por `scriptId`, com `path`,
  `workingDirectory`, `argumentPatterns`, `environmentPatterns` e
  `fixedEnvironment`.

Exemplo:

```json
{
  "service-health": {
    "path": "service-health.sh",
    "workingDirectory": ".",
    "argumentPatterns": ["[a-z0-9-]+"],
    "environmentPatterns": { "TARGET": "[a-z0-9.-]+" },
    "fixedEnvironment": { "MODE": "probe" }
  }
}
```

Caminho e `cwd` são canonicalizados dentro da raiz; symlinks de escape,
scripts não executáveis, argumentos/ambiente fora da política e identificadores
desconhecidos são recusados. Em cancelamento, o grupo de processos recebe
`SIGTERM` e depois `SIGKILL`.

## Configuração

Obrigatórias quando habilitado:

- `BIAWS_MONITOR_EXECUTOR_API_KEY`: chave de uma identidade técnica com
  `monitoring.active.execute`;
- `BIAWS_MONITOR_EXECUTOR_WORKSPACE_ID`: workspace fixo da réplica;
- `BIAWS_MONITOR_EXECUTOR_API_URL`: URL da API, padrão
  `http://127.0.0.1:3100`.

Controles principais:

- `BIAWS_MONITOR_EXECUTOR_ENABLED` (`true`);
- `BIAWS_MONITOR_EXECUTOR_ID` (hostname e PID por padrão);
- `BIAWS_MONITOR_EXECUTOR_CONCURRENCY` (`4`, máximo `25`);
- `BIAWS_MONITOR_EXECUTOR_POLL_INTERVAL_MS` (`15000`);
- `BIAWS_MONITOR_EXECUTOR_LEASE_SECONDS` (`60`);
- `BIAWS_MONITOR_EXECUTOR_RENEW_INTERVAL_MS` (um terço do lease);
- `BIAWS_MONITOR_EXECUTOR_RETRY_ATTEMPTS` (`4`);
- `BIAWS_MONITOR_EXECUTOR_RETRY_BASE_MS` (`500`);
- `BIAWS_MONITOR_EXECUTOR_RETRY_MAX_MS` (`15000`);
- `BIAWS_MONITOR_EXECUTOR_SHUTDOWN_GRACE_MS` (`30000`).
- `BIAWS_MONITOR_EXECUTOR_EVIDENCE_MAX_BYTES` (`8000`, máximo `8000`, alinhado
  ao limite de string do contrato de observações da API).

Defina `BIAWS_MONITOR_EXECUTOR_ENABLED=false` para manter o processo saudável
sem adquirir trabalho. A mudança é aplicada ao reiniciar somente esse componente,
sem reiniciar ou reconfigurar a API.

## Saúde e telemetria

O servidor HTTP usa a porta `3110` por padrão:

- `GET /health/live`: processo em execução;
- `GET /health/ready`: pronto após uma aquisição bem-sucedida recente (ou
  imediatamente quando desabilitado);
- `GET /metrics`: métricas Prometheus de polling, atraso da agenda, duração,
  leases, retries e falhas.

Os logs são JSON, possuem eventos estáveis e sanitizam campos relacionados a
credenciais. IDs de monitor e execução são registrados; configuração e
evidência não são incluídas nos logs do núcleo.

## Desenvolvimento

```bash
cd biaws-monitor-executor
npm install
npm run format:check
npm run check
npm test
```
