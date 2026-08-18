# Bondia Workspaces CLI

CLI do Bondia Workspaces para configurar capacidades locais e integrar agentes
externos aos contratos operacionais da plataforma.

## Uso

Com a `biaws-api` em execução:

```bash
node src/index.js skills list
node src/index.js skills publish \
  --dir ../../.agents/skills/biaws-example \
  --version 1.0.0 \
  --changelog "Publicação inicial"
node src/index.js skills publish-all \
  --dir ../../.agents/skills \
  --initial-version 1.0.0 \
  --changelog "Publicação inicial do catálogo"
node src/index.js skills install biaws-example
node src/index.js skills install-all
node src/index.js skills status
node src/index.js skills update
node src/index.js agent configure codex --project /caminho/do/projeto --workspace id-do-workspace
node src/index.js agent configure claude --project /caminho/do/projeto --workspace id-do-workspace
node src/index.js agent doctor codex --project /caminho/do/projeto --workspace id-do-workspace
node src/index.js monitoring signal <aplicação.componente.deployment.runtime> \
  --status healthy \
  --source zabbix \
  --signal-id zabbix:event:18492 \
  --message "Serviço saudável" \
  --metadata-profile sgmp-health/v1 \
  --metadata '{"service_up":true,"database_up":true,"disk_usage_percent":73.42}'
node src/index.js monitoring signals <runtime-uuid-ou-caminho> --limit 20
node src/index.js monitoring describe --template sgmp-health --template-version 1
node src/index.js monitoring validate --template sgmp-health --template-version 1 \
  --payload '{"status":"healthy","message":"OK","metadata":{"service_up":true}}'
node src/index.js monitoring signal <runtime-uuid-ou-caminho> \
  --source external-monitor --template sgmp-health --template-version 1 \
  --payload '{"status":"healthy","message":"OK","metadata":{"service_up":true}}'
```

`monitoring signal` envia uma observação passiva para um runtime. A referência
pode ser o UUID ou o caminho de identificadores
`<aplicação>.<componente>.<deployment>.<runtime>`. Use
`--signal-id` para que retries sejam idempotentes e `--observed-at` quando a
observação ocorreu antes do envio. Estados aceitos: `unknown`, `healthy`,
`degraded`, `unavailable` e `stopped`. O contrato completo está em
[`../docs/monitoring.md`](../docs/monitoring.md).

`monitoring describe` retorna contrato, amostra e apresentação da versão;
`monitoring validate` executa JSONata sem persistir sinal. Ao enviar
`--template` e `--template-version`, informe `--payload`; `--status` deixa de ser
obrigatório porque o resultado é calculado pela API.

Por padrão, as skills são instaladas em `.agents/skills`, considerando o diretório
corrente. Outro destino pode ser informado com `--target`.

O CLI mantém `.agents/biaws-skills.lock.json` com as versões instaladas. Ao usar
`--force` ou `skills update`, a instalação anterior é preservada ao lado da nova com
o sufixo `.backup-<data>`.

`skills publish-all` examina somente os subdiretórios imediatos da pasta informada
que contenham `SKILL.md`. Uma skill cuja versão já esteja no catálogo é ignorada,
permitindo repetir a carga inicial sem gerar conflito. Falhas em uma skill não
interrompem as demais e fazem o comando terminar com código de saída diferente de
zero.

`agent configure` registra o `biaws-mcp` e instala todas as skills do catálogo.
Para Codex, usa `.codex/config.toml` e `.agents/skills`. Para Claude Code, usa
`.mcp.json` e `.claude/skills`. O comando preserva outros servidores MCP e não
altera configuração global. Ele grava `ISSUE_WORKSPACE_ID` na configuração MCP
do projeto; informe `--workspace` quando a chave acessar mais de um workspace.
Use `agent doctor` para verificar Node.js, API, autenticação, workspace,
configuração e skills.

## Configuração

- `ISSUE_API_URL` ou `ISSUE_API_BASE_URL`: endereço da API.
- `ISSUE_API_KEY`: chave enviada como `Authorization: Bearer`.
- `ISSUE_WORKSPACE_ID`: workspace usado em execuções diretas do CLI. Para MCP,
  o `agent configure` grava esse valor na configuração local do projeto.
- `BIAWS_ENV_FILE`: caminho absoluto para o `.env` da instância selecionada;
  contém URL e chave, e o setup o grava na configuração MCP do cliente.
- `--api-url`: sobrescreve o endereço apenas para a execução atual.
- `--api-key`: sobrescreve a chave apenas para a execução atual; evite porque o
  valor pode ficar visível na lista de processos ou no histórico do shell.
- `--workspace`: seleciona o workspace e, em `agent configure`, persiste a
  seleção na configuração MCP do projeto. A seleção não amplia as permissões da
  identidade técnica.

O valor padrão é `http://127.0.0.1:3100`.

## Fundação de comandos

Os novos comandos usam bases separadas por contexto:

- `LocalInstanceCommand` resolve raiz, diretório de instâncias e `.env` sem
  exigir credenciais;
- `AuthenticatedApiCommand` valida a autenticação antes de criar o cliente HTTP;
- `ProjectCommand` acrescenta a resolução explícita do diretório do projeto.

Filesystem, processos, API e terminal ficam atrás de adapters injetáveis. A
resolução cria um snapshot do ambiente e não altera `process.env`. Subprocessos
são executados sem shell, recebem argumentos separados e encaminham sinais; ao
receber segredos para redaction, sua saída é sanitizada antes de chegar ao
terminal ou a erros.

## Desenvolvimento

```bash
npm run check
npm test
```
