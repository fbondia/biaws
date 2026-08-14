# Operação do monitoramento ativo

Este runbook cobre a instalação, configuração, escala, diagnóstico, atualização
e rollback do executor de monitoramentos ativos. O fluxo passivo permanece
independente: pausar ou remover o executor não impede a recepção de sinais
externos nem apaga configurações ou histórico.

## Instalação de referência

O bootstrap cria duas identidades técnicas distintas:

- o agente MCP/CLI usa o grupo `agent-operator`;
- o executor usa o grupo `monitor-executor`, cuja única permissão é
  `monitoring.active.execute`.

A chave do executor é gravada em
`instances/<instância>/monitor-secrets/executor-api-key`, com permissão `0600`,
e montada somente no container em `/run/secrets/executor-api-key`. Ela não é
gravada no ambiente do container nem deve ser copiada para a configuração de um
monitor.

```bash
./scripts/setup-agent.sh \
  --instance producao \
  --client codex \
  --project /caminho/do/projeto

docker compose \
  --env-file instances/producao/.env \
  --project-name biaws-producao \
  --profile active-monitoring \
  up -d --build --wait monitor-executor
```

O profile é opt-in. API, UI e receptor passivo continuam funcionando quando ele
não é selecionado. O container do executor roda como usuário não-root, com
filesystem somente leitura, todas as capabilities removidas, `no-new-privileges`
e apenas um `tmpfs` limitado em `/tmp`.

## Configuração mínima e políticas locais

O bootstrap preenche `BIAWS_MONITOR_EXECUTOR_WORKSPACE_ID` e configura
`BIAWS_MONITOR_EXECUTOR_API_KEY_FILE`. Ele também grava
`BIAWS_MONITOR_EXECUTOR_UID` e `BIAWS_MONITOR_EXECUTOR_GID` com a identidade do
proprietário da chave, para que o bind mount permaneça legível com permissão
`0600` em hosts Linux. Revise os limites antes de habilitar monitores:

```dotenv
BIAWS_MONITOR_EXECUTOR_CONCURRENCY=4
BIAWS_MONITOR_EXECUTOR_EVIDENCE_MAX_BYTES=8000
BIAWS_MONITOR_REST_ALLOWED_HOSTS=status.example.com,*.internal.example.com
BIAWS_MONITOR_REST_ALLOWED_METHODS=GET,HEAD
BIAWS_MONITOR_REST_ALLOW_PRIVATE_ADDRESSES=false
BIAWS_MONITOR_REST_MAX_REDIRECTS=3
```

REST e shell permanecem deny-by-default. Para shell, coloque scripts revisados
no diretório definido por `BIAWS_MONITOR_SHELL_FILES_PATH`, mantenha o mount
somente leitura e associe cada `scriptId` em `BIAWS_MONITOR_SHELL_SCRIPTS`.
Código shell enviado pela API nunca é executado.

### Segredos por referência

Prefira arquivos a variáveis de ambiente. Crie um arquivo por valor dentro de
`BIAWS_MONITOR_SECRET_FILES_PATH`, com nome simples e permissão `0600`, e mapeie
uma referência pública:

```dotenv
BIAWS_MONITOR_REFERENCE_FILE_MAP={"billing-auth":"billing-auth-header"}
```

A configuração REST usa apenas a referência:

```json
{
  "headerRefs": [{ "name": "Authorization", "reference": "billing-auth" }]
}
```

O executor canonicaliza o arquivo dentro de `/run/secrets`, recusa symlinks que
escapem da raiz, arquivos vazios/não regulares ou maiores que 64 KiB e nunca
inclui o valor em evidências ou logs. O arquivo reservado `executor-api-key`
não pode ser associado a uma referência de provider.
`BIAWS_MONITOR_REFERENCE_ENV_MAP` continua
disponível para compatibilidade, mas a variável mapeada precisa ser injetada
explicitamente no processo e não deve aparecer em arquivos versionados.

## Readiness, métricas e logs

Valide os três serviços e o executor:

```bash
docker compose --env-file instances/producao/.env \
  --project-name biaws-producao ps

docker compose --env-file instances/producao/.env \
  --project-name biaws-producao exec -T monitor-executor \
  node -e "fetch('http://127.0.0.1:3110/health/ready').then(async r=>{console.log(r.status,await r.text());if(!r.ok)process.exit(1)})"

docker compose --env-file instances/producao/.env \
  --project-name biaws-producao exec -T monitor-executor \
  node -e "fetch('http://127.0.0.1:3110/metrics').then(r=>r.text()).then(console.log)"
```

Readiness exige uma aquisição recente bem-sucedida. Diagnóstico mínimo:

- `poll_failures` e retries crescentes: API, autenticação, rate limit ou rede;
- `schedule_lag_seconds`: capacidade insuficiente ou backlog;
- `lease_losses`: timeout, pausa longa ou réplicas/API instáveis;
- `provider_failures`: política local, destino, script ou template;
- mesmo `executionId` em retries: retomada idempotente esperada;
- mais de uma observação para o mesmo `executionId`: incidente de duplicidade.

Correlacione `monitorId` e `executionId` entre logs e timeline. Configuração,
evidência, API key e valores resolvidos não devem aparecer nos logs.

## Escala e mudança de configuração

```bash
docker compose --env-file instances/producao/.env \
  --project-name biaws-producao \
  --profile active-monitoring \
  up -d --scale monitor-executor=2 monitor-executor
```

Cada réplica recebe ID próprio pelo hostname/PID. Ajuste concorrência e a cota
da chave para a carga total. As configurações são lidas em cada lease; uma
alteração válida passa a valer na próxima ocorrência, sem reiniciar o executor.

## Atualização e migração

1. Faça backup do MongoDB, volumes e chave mestra conforme
   [operations.md](operations.md).
2. Pause novas aquisições com `BIAWS_MONITOR_EXECUTOR_ENABLED=false` e recrie
   apenas o executor.
3. Execute `npm run migrate:monitoring` sem `--apply` e revise o resumo.
4. Execute novamente com `--apply` na janela aprovada.
5. Construa as novas imagens, suba API/UI e depois o profile do executor.
6. Confirme readiness, métricas, timeline ativa e um sinal passivo idempotente.

Antes de reabilitar aquisições, descreva e valide pelo menos um template
migrado e execute smoke tests separados para REST, envio externo e Shell. REST e
externo devem produzir resultado e apresentação equivalentes para a mesma
amostra; Shell deve operar sem `templateRef` e respeitar `failureStatus` e
`captureOutput`.

A migração preserva sinais passivos, materializa observações manuais legadas,
recalcula retenção e cria índices/permite contratos ativos. Ela é repetível e o
modo padrão é dry-run.

## Rollback

Rollback do executor não exige rollback de dados:

```bash
docker compose --env-file instances/producao/.env \
  --project-name biaws-producao stop monitor-executor
```

Leases em andamento expiram e podem ser retomados com o mesmo `executionId`.
Configurações, templates, snapshots e histórico permanecem na API; sinais
passivos e inclusões manuais continuam disponíveis. Volte a API/UI para imagens
anteriores somente se elas forem compatíveis com os campos já persistidos. Não
remova coleções ou campos manualmente. Para corrupção de dados, restaure primeiro
em ambiente isolado e siga o procedimento de recuperação geral.

Para rollback de uma alteração de template, desative a versão nova e reative a
versão anterior já validada; atualize os monitores REST e emissores externos para
essa referência imutável. Não reescreva snapshots nem observações antigas. O
catálogo legado de `metadataProfile` permanece apenas como fallback de leitura,
de modo que uma imagem anterior continue apresentando o histórico sem exigir
migração destrutiva.

## Evidência automatizada

As suítes e o CI cobrem os fluxos críticos:

| Cenário                               | Evidência reproduzível                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| sucesso e contrato API/executor       | integração HTTP/Mongo de topologia e testes do cliente/engine                |
| timeout e cancelamento                | `biaws-monitor-executor/test/engine.test.js` e testes dos providers          |
| retry/backoff                         | testes de engine, cliente e retry                                            |
| duplicidade entre réplicas/publicação | engine concorrente e integração HTTP idempotente                             |
| mudança de configuração               | aquisição consecutiva com revisões distintas no teste de engine              |
| retenção e inclusão manual            | integração HTTP/Mongo da API                                                 |
| convivência passiva                   | timeline integrada e migração de monitoramento                               |
| segredo e isolamento                  | testes do resolver, providers, grupo mínimo e smoke de não vazamento em logs |
| empacotamento/readiness/métricas      | job Compose da CI com o profile `active-monitoring`                          |

Execução local:

```bash
cd biaws-api && BIAWS_HTTP_INTEGRATION=1 npm test
cd ../biaws-monitor-executor && npm run format:check && npm run check && npm test
docker compose config --quiet
```
