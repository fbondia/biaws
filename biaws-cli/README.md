# Bondia Workspaces CLI

CLI do Bondia Workspaces para administrar instalações, configurar o acesso
global e operar os recursos do workspace associado à pasta atual.

## Instalação

```bash
npm install --global biaws
biaws help
biaws --version
```

Uma execução descartável pode usar `npx biaws help`. Em um checkout de
desenvolvimento, `npm --prefix biaws-cli link` cria o mesmo comando global.

O pacote requer Node.js 20.19 ou superior. Operações administrativas de
instância também exigem Git, Docker e Docker Compose. Windows é suportado por
WSL2, não de forma nativa.

## Organização

```text
biaws admin ...      # instalação e instâncias; não exige credencial
biaws config ...     # URL, perfis e credenciais globais
biaws workspace ...  # associação da pasta e recursos do workspace
biaws help [...]     # introdução ou ajuda contextual
```

Consulte a árvore completa em
[`docs/command-taxonomy.md`](docs/command-taxonomy.md).

## Primeiros passos

Configure um perfil. A chave é lida de forma mascarada no terminal; em CI, use
`BIAWS_API_KEY`.

```bash
biaws config init --api-url https://biaws.example.com
biaws config doctor
biaws config show
```

Depois, associe a pasta atual a um workspace autorizado:

```bash
cd /caminho/do/projeto
biaws workspace init
biaws workspace current
biaws workspace applications list
```

Em modo não interativo, informe o ID ou o nome:

```bash
biaws workspace init WORKSPACE_ID
```

## Configuração

Os arquivos globais ficam em `~/.config/biaws/` por padrão:

```text
config.json       perfis, URLs e preferências não secretas
credentials.json  chaves de API; permissão 0600
```

`BIAWS_CONFIG_HOME` e `XDG_CONFIG_HOME` podem alterar esse diretório. A pasta do
projeto recebe apenas `.biaws/config.json`, com o perfil e o ID do workspace.
Nenhuma chave é gravada no projeto.

A precedência é:

```text
flags > variáveis de ambiente > configuração da pasta > perfil global > defaults
```

Variáveis canônicas:

- `BIAWS_API_URL`: endereço da API;
- `BIAWS_API_KEY`: chave de API, recomendada para CI;
- `BIAWS_WORKSPACE_ID`: seleção temporária do workspace;
- `BIAWS_CONFIG_HOME`: diretório global de configuração;
- `BIAWS_ROOT`: raiz administrativa de um checkout da plataforma.

Perfis permitem usar instalações diferentes:

```bash
BIAWS_API_KEY=... biaws config init --profile producao --api-url https://biaws.example.com
biaws config profiles list
biaws config profiles use producao
biaws config login --profile producao
```

Nomes de perfil usam letras minúsculas ASCII, números, ponto, hífen ou
sublinhado.

## Recursos do workspace

```bash
biaws workspace list
biaws workspace applications list
biaws workspace demands get CLI-123
biaws workspace demands tasks CLI-123 --status Pendente
biaws workspace issues list --status open
biaws workspace issues transition ISSUE_ID --status Resolvido --yes
```

`--json` emite envelopes estruturados em stdout. Leituras preservam escopo e
paginação. Escritas resolvem a entidade antes da alteração, exigem confirmação
e não repetem uma escrita quando o status já é o solicitado.

Para uma rota ainda não coberta por um comando de domínio:

```bash
biaws workspace api GET /catalog/workspaces
biaws workspace api PATCH /recurso/ID --body '{"status":"Ativo"}'
```

## Agentes e skills

```bash
biaws workspace agent configure codex
biaws workspace agent configure claude
biaws workspace agent doctor codex
biaws workspace skills list
biaws workspace skills install SKILL_ID
biaws workspace skills update
biaws workspace skills status
```

O Codex usa `.codex/config.toml` e `.agents/skills`. O Claude Code usa
`.mcp.json` e `.claude/skills`. Configurações de terceiros são preservadas e
nenhuma credencial é gravada no projeto. O MCP é configurado como
`npx --yes biaws-mcp@<versão-fixada>`, sem exigir um checkout local da
plataforma.

## Monitoramento

```bash
biaws workspace monitoring signal <runtime> \
  --status healthy \
  --source synthetic-http \
  --signal-id check:42

biaws workspace monitoring signals <runtime> --limit 20
biaws workspace monitoring describe --template sgmp-health --template-version 1
biaws workspace monitoring validate --template sgmp-health --template-version 1 \
  --payload '{"status":"healthy"}'
```

O contrato completo está em [`../docs/monitoring.md`](../docs/monitoring.md).

## Administração da instalação

Diagnostique os pré-requisitos e baixe uma release verificada:

```bash
biaws admin doctor
biaws admin install --version 1.0.0 --dry-run
biaws admin install --version 1.0.0 --directory /opt/biaws
```

O instalador busca `biaws-<versão>.tar.gz` e seu arquivo `.sha256` na release do
GitHub. Ele recusa diretórios não vazios e extrai somente depois de verificar o
checksum.

Gerencie as instâncias:

```bash
biaws admin instance setup --interactive
biaws admin instance list
biaws admin instance status local
biaws admin instance start local
biaws admin instance stop local
biaws admin instance update local
biaws admin instance backup local
```

Os executores de monitoramento ativo também pertencem ao nível administrativo:

```bash
biaws admin monitoring validate --instance local
biaws admin monitoring start --instance local
biaws admin monitoring status --instance local
biaws admin monitoring logs --instance local
biaws admin monitoring provision WORKSPACE_ID --instance local
```

Detalhes e automação estão em
[`docs/instance-lifecycle.md`](docs/instance-lifecycle.md).

## Desenvolvimento

```bash
npm ci
npm run format:check
npm run check
npm test
npm run package:verify
```

O processo de publicação está em [`docs/releasing.md`](docs/releasing.md).
