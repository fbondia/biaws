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

REST e shell são registrados na fase `ACTIVE-MON-03`. Até lá, uma configuração
com provider não instalado gera uma observação `unknown` sanitizada, sem incluir
a configuração recebida.

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
