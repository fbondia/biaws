# Bondia Workspaces CLI

CLI do Bondia Workspaces para configurar capacidades locais e integrar agentes
externos aos contratos operacionais da plataforma.

## Instalação

O pacote público usa o nome `biaws` e expõe um binário com shebang portátil:

```bash
npm install --global biaws
biaws --help
biaws --version
```

Para uma execução descartável, use `npx biaws --help`. Em um checkout para
desenvolvimento, `npm --prefix biaws-cli link` cria o mesmo comando global; a
rota direta equivalente é `./biaws-cli/bin/biaws.js`.

Consultas e escritas na API funcionam somente com o pacote npm. Operações de
instância e a configuração completa de MCP/skills também precisam dos assets
Docker e scripts do repositório. Nesse caso, execute a partir do checkout ou
defina sua raiz explicitamente:

```bash
export BIAWS_ROOT=/caminho/absoluto/para/biaws
biaws instance list
```

Windows é suportado por WSL2; o binário e os scripts não têm suporte em Windows
nativo.

## Uso

Com a `biaws-api` em execução:

```bash
biaws skills list
biaws skills publish \
  --dir ../../.agents/skills/biaws-example \
  --version 1.0.0 \
  --changelog "Publicação inicial"
biaws skills publish-all \
  --dir ../../.agents/skills \
  --initial-version 1.0.0 \
  --changelog "Publicação inicial do catálogo"
biaws skills install biaws-example
biaws skills install-all
biaws skills status
biaws skills update
biaws agent configure codex --project /caminho/do/projeto --workspace id-do-workspace
biaws agent configure claude --project /caminho/do/projeto --workspace id-do-workspace
biaws agent doctor codex --project /caminho/do/projeto --workspace id-do-workspace
biaws monitoring signal <aplicação.componente.deployment.runtime> \
  --status healthy \
  --source zabbix \
  --signal-id zabbix:event:18492 \
  --message "Serviço saudável" \
  --metadata-profile sgmp-health/v1 \
  --metadata '{"service_up":true,"database_up":true,"disk_usage_percent":73.42}'
biaws monitoring signals <runtime-uuid-ou-caminho> --limit 20
biaws monitoring describe --template sgmp-health --template-version 1
biaws monitoring validate --template sgmp-health --template-version 1 \
  --payload '{"status":"healthy","message":"OK","metadata":{"service_up":true}}'
biaws monitoring signal <runtime-uuid-ou-caminho> \
  --source external-monitor --template sgmp-health --template-version 1 \
  --payload '{"status":"healthy","message":"OK","metadata":{"service_up":true}}'
```

### Consultas de domínio

As rotas `workspaces`, `applications`, `demands` e `issues` oferecem `list` e
`get`; `demands tasks <melhoria>` lista tarefas por ID ou código. Filtros de
workspace/aplicação, busca, status, página e limite são enviados à API sem
ampliar o escopo. A saída humana sempre informa escopo e paginação. `--json`
emite somente o envelope versionado `biaws.read.v1` em stdout; diagnósticos
permanecem em stderr.

As escritas remotas são restritas às ações `demands task-status`,
`demands complete-task` e `issues transition`. Elas resolvem a entidade antes
da alteração, exigem confirmação (`--yes` em CI), enviam somente o novo status
e retornam `biaws.write.v1`. Repetir o status atual não envia outra escrita.

```bash
biaws workspaces list --json
biaws applications list --workspace "$ISSUE_WORKSPACE_ID" --page 1 --limit 20
biaws demands get CLI-OCLIF-2026-08-18 --workspace "$ISSUE_WORKSPACE_ID"
biaws demands tasks CLI-OCLIF-2026-08-18 --status Pendente --json
biaws issues list --application APPLICATION_ID --status open --json
biaws demands complete-task CLI-OCLIF-2026-08-18 CLI-OCLIF-09 --yes --json
biaws issues transition ISSUE_ID --status Resolvido --yes --json
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

As rotas `skills`, `agent` e `monitoring` são subcomandos oclif nativos: seus
argumentos, flags, ajuda e erros de uso são descobertos e validados pelo
framework. `agent configure` e `agent doctor` permanecem como aliases de
compatibilidade; para novas automações, prefira `configure codex|claude` e
`configure doctor`.

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

## Wizards e planos

Fluxos interativos usam `@inquirer/prompts` somente por meio de um
`PromptAdapter`. Há adapters real, não interativo e programável para testes. A
camada de wizard resolve flags e ambiente, coleta apenas campos ausentes, valida
o conjunto, cria um plano imutável, apresenta um resumo redigido, confirma e só
então chama o executor.

- `--interactive` habilita perguntas quando há TTY;
- `--non-interactive` nunca pergunta e lista todos os campos obrigatórios
  ausentes;
- `--defaults` aplica defaults declarados explicitamente e é sempre opt-in;
- `--yes` pula somente a confirmação, sem preencher campos;
- `--json` não muda coleta ou confirmação e reserva o resumo serializado para
  saída estruturada.

Segredos podem ser acessados pelo executor com `plan.get(campo)`, mas aparecem
como `[REDACTED]` em `plan.values`, `toJSON()` e no resumo. Cancelamento, EOF e
sinais abortam antes da chamada do executor com código estável.

## Instâncias locais

`biaws instance setup`, `list`, `show`, `status`, `start` e `stop` cobrem o
setup e o ciclo de vida local sem exigir chave da API. O setup valida nomes,
URL, portas e storage antes de chamar Docker, preserva segredos existentes e
alerta quando uma reexecução muda os destinos persistentes sem mover dados.

A senha administrativa não possui flag: informe-a no prompt mascarado ou em
`BIAWS_BOOTSTRAP_ADMIN_PASSWORD` num ambiente privado. Consulte o fluxo de
automação e o smoke test Docker em
[`docs/instance-lifecycle.md`](docs/instance-lifecycle.md).

## Desenvolvimento

```bash
npm ci
npm run check
npm test
npm run package:verify
```

O roteiro de publicação, migração dos wrappers e rollback está em
[`docs/releasing.md`](docs/releasing.md). O comando de publicação é dry-run por
padrão e nunca publica sem `--publish` explícito.

### Configuração de clientes e skills

Os comandos nativos de projeto mantêm a chave exclusivamente no ambiente privado
(`ISSUE_API_KEY` ou `--env-file`) e gravam no projeto apenas a URL indireta do
runtime, o workspace e a configuração MCP gerenciada:

```bash
biaws configure codex --project . --workspace <workspace-id>
biaws configure claude --project . --workspace <workspace-id>
biaws configure skills list --json
biaws configure skills install <skill-id>
biaws configure skills update [skill-id]
biaws configure skills verify
biaws configure doctor codex
```

Configurações preexistentes de terceiros são preservadas. Um bloco `biaws`
conflitante só é assumido pelo CLI com `--force`. Sem TTY, cliente, workspace e
seleção de skill devem ser informados explicitamente; `--all` instala o catálogo.
