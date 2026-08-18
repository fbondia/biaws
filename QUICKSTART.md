# Início rápido

Este guia mostra como iniciar uma instância local do **Bondia Workspaces** ou
conectar Codex e Claude Code a um servidor compartilhado.

Uma única cópia do repositório pode manter várias instâncias isoladas. Cada
instância possui banco, anexos, portas, usuários e credenciais próprios.

## Escolha como instalar

Há três rotas explícitas: `setup-server.sh` cria uma instância; `setup-client.sh`
conecta um agente a uma API existente; `setup-local.sh` orienta o fluxo co-localizado.

| Seu ambiente                                    | Siga esta rota                                                    |
| ----------------------------------------------- | ----------------------------------------------------------------- |
| macOS                                           | [macOS](#macos)                                                   |
| Ubuntu, Debian ou outra distribuição Linux      | [Linux](#linux)                                                   |
| Windows 10/11                                   | [Windows com WSL2](#windows-com-wsl2)                             |
| Codex, Claude Code ou outro agente com terminal | [Instalação por um único prompt](#instalação-por-um-único-prompt) |

O BIAWS requer Git, Docker com o plugin Compose, Node.js `20.19.0` ou superior,
`curl`, `openssl` e Bash. Node.js 22 LTS é recomendado.

### macOS

1. Instale o [Docker Desktop para Mac](https://docs.docker.com/desktop/setup/install/mac-install/).
2. Instale Git, Node.js, `curl` e OpenSSL. Com
   [Homebrew](https://brew.sh/):

   ```bash
   brew install git node curl openssl
   ```

3. Abra o Docker Desktop e aguarde o engine ficar disponível.

O setup é compatível com Macs Apple Silicon e Intel; as imagens Docker escolhem
a arquitetura adequada. Não é necessário substituir o Bash fornecido pelo
macOS.

### Linux

1. Instale o [Docker Engine](https://docs.docker.com/engine/install/) para sua
   distribuição, incluindo o plugin Docker Compose. Se preferir interface
   gráfica, use o [Docker Desktop para Linux](https://docs.docker.com/desktop/setup/install/linux/).
2. Instale Git, `curl`, OpenSSL e os certificados do sistema. Em Ubuntu/Debian:

   ```bash
   sudo apt-get update
   sudo apt-get install -y git curl openssl ca-certificates
   ```

3. Instale Node.js 22 LTS pelo
   [canal oficial do Node.js](https://nodejs.org/en/download). O pacote `nodejs`
   padrão de distribuições antigas pode não atingir a versão mínima `20.19.0`.
4. Inicie o Docker e siga o
   [pós-instalação oficial](https://docs.docker.com/engine/install/linux-postinstall/)
   se quiser executá-lo sem `sudo`.

### Windows com WSL2

O suporte no Windows é feito por WSL2. Windows nativo, PowerShell, Prompt de
Comando, Git Bash, MSYS2 e Cygwin não executam o instalador.

1. Em um PowerShell aberto como administrador, instale o WSL2 com Ubuntu:

   ```powershell
   wsl --install -d Ubuntu
   ```

   Reinicie o Windows se solicitado e conclua a criação do usuário Linux. Veja
   a [documentação oficial do WSL](https://learn.microsoft.com/windows/wsl/install).

2. Instale o [Docker Desktop para Windows](https://docs.docker.com/desktop/setup/install/windows-install/),
   habilite o engine baseado em WSL2 e ative a integração com a distribuição
   Ubuntu em **Settings > Resources > WSL Integration**.
3. No terminal Ubuntu do WSL — não no PowerShell — instale as ferramentas:

   ```bash
   sudo apt-get update
   sudo apt-get install -y git curl openssl ca-certificates
   ```

4. Ainda no Ubuntu, instale Node.js 22 LTS pelo
   [canal oficial do Node.js](https://nodejs.org/en/download).
5. Clone o BIAWS e mantenha seus projetos dentro do filesystem Linux, por
   exemplo em `~/Source`. Evite `/mnt/c`, que introduz diferenças de permissões,
   caminhos e desempenho.

Todos os comandos Bash das próximas seções devem ser executados dentro do
terminal WSL. A UI continuará acessível no navegador do Windows por
`http://localhost:<porta>`.

### Instalação por um único prompt

Se o agente atual pode usar um terminal, você não precisa copiar nenhum dos
comandos deste guia. Envie a ele o
[prompt pronto para instalação assistida](docs/agent-assisted-installation.md).

O agente deve detectar macOS, Linux ou Windows/WSL2, verificar o ambiente,
solicitar aprovação antes de instalar pacotes ou alterar configurações do
sistema, clonar o repositório, executar o setup e validar o MCP. O usuário só
precisa aprovar essas ações e, quando o sistema operacional exigir, concluir
uma janela do Docker Desktop, reinicialização ou autenticação administrativa.

## Escolher a topologia

### Servidor compartilhado

No servidor, crie somente a instância. Não configure Codex ou Claude Code nele:

```bash
./scripts/setup-server.sh --instance default --public-url https://ci.exemplo.com
```

Em cada máquina de desenvolvedor, mantenha uma cópia local do repositório e um
arquivo de ambiente privado com `ISSUE_API_URL=https://ci.exemplo.com/api` e
`ISSUE_API_KEY=<chave individual>`. Em seguida execute:

```bash
chmod 600 ~/.config/biaws/default.env
./scripts/setup-client.sh \
  --client codex \
  --project /caminho/do/projeto \
  --env-file ~/.config/biaws/default.env
```

Os detalhes de proxy, credenciais e isolamento estão em
[docs/shared-server.md](docs/shared-server.md).

### Instância local

Para desenvolvimento individual ou avaliação, siga as etapas abaixo e use
`setup-local.sh`. Ele cria os containers e configura o agente na mesma máquina.

## 1. Baixar o Bondia Workspaces

Enquanto não houver uma release pública, clone o branch principal:

```bash
git clone https://github.com/fbondia/biaws.git
cd biaws
```

Valide os pré-requisitos e o acesso ao Docker:

```bash
./scripts/check-prerequisites.sh --include-git
```

Quando houver releases publicadas, prefira uma versão identificada:

```bash
git clone https://github.com/fbondia/biaws.git
cd biaws
git switch --detach vX.Y.Z
```

## 2. Preparar o projeto consumidor

O projeto consumidor é o repositório no qual o Codex ou o Claude Code usará o
Bondia Workspaces.

Se ainda não existir:

```bash
mkdir -p "$HOME/Source/meu-projeto"
```

## 3. Criar a instância e configurar o agente

Para Codex:

```bash
./scripts/setup-local.sh \
  --instance meu-projeto \
  --client codex \
  --project "$HOME/Source/meu-projeto"
```

Para Claude Code:

```bash
./scripts/setup-local.sh \
  --instance meu-projeto \
  --client claude \
  --project "$HOME/Source/meu-projeto"
```

O setup:

1. cria `instances/meu-projeto/.env`;
2. cria scripts de start, stop, backup e restore em `instances/meu-projeto`;
3. seleciona portas disponíveis;
4. gera os segredos locais;
5. constrói e inicia MongoDB, API e UI;
6. cria o administrador inicial;
7. cria uma identidade técnica para o agente;
8. publica o catálogo inicial de skills;
9. instala as skills no projeto consumidor;
10. configura o servidor MCP;
11. executa o diagnóstico e o handshake MCP.

O `.env` da instância guarda a URL e a chave técnica. O workspace fica na
configuração MCP do projeto consumidor, permitindo conectar projetos diferentes
a workspaces diferentes da mesma instância. Se a chave acessar mais de um,
selecione-o explicitamente:

```bash
./scripts/setup-local.sh \
  --instance meu-projeto \
  --client codex \
  --project "$HOME/Source/meu-projeto" \
  --workspace id-do-workspace
```

Sem `--workspace`, a seleção é automática somente quando a identidade acessa um
único workspace. O ID não concede acesso; primeiro inclua a identidade técnica
como membro ativo do workspace e atribua seus grupos.

Para Codex, o trecho gerado em `.codex/config.toml` contém:

```toml
[mcp_servers.biaws]
command = "node"
args = ["/caminho/para/biaws/biaws-mcp/src/index.js"]
env = { BIAWS_ENV_FILE = "/caminho/para/biaws/instances/meu-projeto/.env", ISSUE_WORKSPACE_ID = "id-do-workspace" }
```

Para Claude Code, `.mcp.json` recebe as mesmas duas variáveis em
`mcpServers.biaws.env`.

Depois do setup, a instância pode ser iniciada ou parada de qualquer diretório:

```bash
instances/meu-projeto/start.sh
instances/meu-projeto/stop.sh
instances/meu-projeto/backup-mongo.sh
instances/meu-projeto/restore-mongo.sh backups/biaws-<data>.archive.gz
```

O `stop.sh` preserva os containers e todos os dados persistentes. Para
reconstruir as imagens ao iniciar, use
`instances/meu-projeto/start.sh --build`.

O `backup-mongo.sh` grava por padrão em `instances/meu-projeto/backups` e
aceita outro diretório como argumento. Ele também gera um checksum SHA-256. O
`restore-mongo.sh` verifica esse checksum, quando disponível, e exige que o
nome da instância seja digitado antes de executar `mongorestore --drop`. Use
`--yes` somente em automações que já tenham confirmação externa.

Para escolher portas específicas:

```bash
./scripts/setup-local.sh \
  --instance meu-projeto \
  --mongo-port 27018 \
  --api-port 3101 \
  --ui-port 4401 \
  --client codex \
  --project "$HOME/Source/meu-projeto"
```

Para iniciar sem registros de demonstração:

```bash
BIAWS_SKIP_DEMO_SEED=1 \
./scripts/setup-local.sh \
  --instance meu-projeto \
  --client codex \
  --project "$HOME/Source/meu-projeto"
```

### Escolher onde os dados serão armazenados

Sem opções adicionais, cada instância usa cinco volumes nomeados gerenciados
pelo Docker: MongoDB, anexos de issues, arquivos de requests, documentos e o
cofre criptografado de segredos. A chave mestra do cofre fica
fora desses volumes, no diretório da instância. O nome efetivo recebe o prefixo
do projeto Compose da instância.

Para armazenar tudo em diretórios visíveis no host, informe uma raiz absoluta
ao criar a instância:

```bash
./scripts/setup-local.sh \
  --instance meu-projeto \
  --storage-dir "$HOME/.local/share/biaws/meu-projeto" \
  --client codex \
  --project "$HOME/Source/meu-projeto"
```

O setup cria:

```text
~/.local/share/biaws/meu-projeto/
├── mongo/
├── issues/
├── requests/
├── documents/
└── secrets/
```

Para escolher cada caminho separadamente:

```bash
./scripts/setup-local.sh \
  --instance meu-projeto \
  --mongo-data-path "$HOME/biaws-data/mongo" \
  --issue-files-path "$HOME/biaws-data/issues" \
  --request-files-path "$HOME/biaws-data/requests" \
  --document-files-path "$HOME/biaws-data/documents" \
  --secret-files-path "$HOME/biaws-data/secrets" \
  --client codex \
  --project "$HOME/Source/meu-projeto"
```

Os caminhos precisam ser absolutos, distintos, não aninhados entre si e
graváveis pelo Docker. Eles ficam registrados no `.env` da instância. Para
voltar aos volumes nomeados:

```bash
./scripts/setup-local.sh \
  --instance meu-projeto \
  --use-docker-volumes \
  --client codex \
  --project "$HOME/Source/meu-projeto"
```

> Alterar os caminhos de uma instância existente não move os dados. Faça backup,
> configure o novo destino e restaure o MongoDB e os arquivos antes de voltar a
> aceitar escritas.

## 4. Fazer o primeiro acesso

Ao final do setup, o terminal mostra:

- endereço da UI;
- endereço da API;
- e-mail do administrador;
- senha inicial.

Por padrão, a primeira instância usa:

- MongoDB: `mongodb://127.0.0.1:27017/biaws`;
- UI: <http://localhost:4400>;
- API: <http://localhost:3100>;
- health check: <http://localhost:3100/api/health>.

Cada instância possui seu próprio container MongoDB e armazenamento. Se alguma
das portas do MongoDB, da API ou da UI estiver ocupada ou reservada por outra
instância, o setup seleciona outra e informa os endereços efetivos. A porta
interna do MongoDB permanece sempre em `27017`; `MONGO_PORT` controla somente a
porta publicada no host.

A senha inicial também fica em:

```text
instances/meu-projeto/.bootstrap-admin-password
```

Entre na UI e altere a senha do administrador.

A primeira tela é a home operacional. Ela já vem com indicadores de chamados,
tarefas pendentes e saúde das aplicações permitidos para o usuário. Use
**Personalizar** para abrir o catálogo, adicionar ou repetir widgets, alterar o
tamanho e configurar opções próprias de cada instância, como a aplicação do
widget de monitoramento. O layout é salvo por usuário e por workspace.

> A chave técnica do agente fica somente em
> `instances/meu-projeto/.env`. Ela não é exibida no resumo da instalação.

## 5. Abrir o agente

Codex:

```bash
cd "$HOME/Source/meu-projeto"
codex
```

Claude Code:

```bash
cd "$HOME/Source/meu-projeto"
claude
```

O cliente pode solicitar aprovação para usar o servidor MCP configurado pelo
projeto. Antes de aprovar, confirme que o comando aponta para:

```text
<caminho-do-clone>/biaws/biaws-mcp/src/index.js
```

## 6. Confirmar o funcionamento

Experimente:

```text
Use o Bondia Workspaces para listar os workspaces e aplicações disponíveis.
```

Com dados de demonstração:

```text
Consulte a issue de demonstração e resuma o contexto registrado.
```

```text
Liste as demandas abertas e identifique suas tarefas pendentes.
```

O agente deve usar as ferramentas MCP `biaws` e retornar dados da instância
selecionada.

## 7. Enviar um sinal de monitoramento

Cadastre uma aplicação, componente, deployment e runtime pela UI. Na aba
Monitoramento do runtime, copie seu UUID ou caminho de identificadores. Usando
a chave técnica criada pelo setup:

```bash
BIAWS_ENV_FILE="$PWD/instances/meu-projeto/.env" \
node biaws-cli/src/index.js \
  monitoring signal <aplicação.componente.deployment.runtime> \
  --workspace id-do-workspace \
  --status healthy \
  --source quickstart \
  --signal-id quickstart:1 \
  --message "Primeiro sinal externo"
```

Abra o runtime na aba Topologia. O estado aparece na lista e o histórico fica
na seção Monitoramento. Repetir o comando com o mesmo `--signal-id` não cria
outro evento. Veja [docs/monitoring.md](docs/monitoring.md).

## 8. Executar monitoramentos ativos por workspace

O executor ativo é um processo separado da API e atende exatamente um
workspace. A agenda, os leases, os templates e o histórico permanecem na API;
o diretório local guarda somente políticas de execução e credenciais montadas
como arquivos. A mesma imagem é compartilhada por todos os executores da
instância.

Inicie a instância antes de configurar seus executores:

```bash
instances/meu-projeto/start.sh
```

### Criar a configuração do workspace

Escolha um identificador local legível, como `equipe-a`, e crie a estrutura:

```bash
mkdir -p \
  instances/meu-projeto/monitoring/workspaces/equipe-a/secrets \
  instances/meu-projeto/monitoring/workspaces/equipe-a/scripts
chmod 700 instances/meu-projeto/monitoring/workspaces/equipe-a/secrets
```

Crie `instances/meu-projeto/monitoring/workspaces/equipe-a/.env`:

```dotenv
BIAWS_MONITOR_EXECUTOR_ENABLED=true
BIAWS_MONITOR_EXECUTOR_API_URL=http://api:3100
BIAWS_MONITOR_EXECUTOR_API_KEY_FILE=/run/secrets/executor-api-key
BIAWS_MONITOR_EXECUTOR_WORKSPACE_ID=id-do-workspace
BIAWS_MONITOR_EXECUTOR_ID=meu-projeto-equipe-a-1
BIAWS_MONITOR_EXECUTOR_CONCURRENCY=4
BIAWS_MONITOR_EXECUTOR_POLL_INTERVAL_MS=15000
BIAWS_MONITOR_EXECUTOR_LEASE_SECONDS=60
BIAWS_MONITOR_EXECUTOR_RENEW_INTERVAL_MS=20000
BIAWS_MONITOR_EXECUTOR_REQUEST_TIMEOUT_MS=10000
BIAWS_MONITOR_EXECUTOR_EVIDENCE_MAX_BYTES=8000

BIAWS_MONITOR_REST_ALLOWED_HOSTS=health.exemplo.com,*.servicos.exemplo.com
BIAWS_MONITOR_REST_ALLOWED_METHODS=GET,HEAD
BIAWS_MONITOR_REST_ALLOW_PRIVATE_ADDRESSES=false
BIAWS_MONITOR_REST_MAX_REDIRECTS=0
BIAWS_MONITOR_REFERENCE_FILE_MAP='{"servico-auth":"servico-auth"}'
BIAWS_MONITOR_SHELL_SCRIPTS='{}'
```

`BIAWS_MONITOR_REST_ALLOWED_HOSTS` deve conter somente os destinos necessários
ao workspace. Se um nome permitido resolver para uma rede corporativa privada,
defina `BIAWS_MONITOR_REST_ALLOW_PRIVATE_ADDRESSES=true` conscientemente; a
allowlist de hosts continua sendo aplicada.

### Provisionar a identidade técnica

Gere uma identidade exclusiva, com somente `monitoring.active.execute`, e
grave sua chave fora do `.env`:

```bash
node scripts/provision-monitoring-workspace.mjs \
  --instance meu-projeto \
  --workspace equipe-a
```

O comando cria ou reconcilia a identidade no workspace informado e grava
`secrets/executor-api-key` com permissão `0600`. A chave existente é enviada ao
bootstrap por entrada padrão para não aparecer nos argumentos do processo.

Para cada entrada de `BIAWS_MONITOR_REFERENCE_FILE_MAP`, crie um arquivo com o
valor completo que será usado pelo header. Por exemplo, `servico-auth` pode
conter `Bearer ...` ou `Basic ...`. Não coloque o valor no `.env`, no monitor,
no Git ou nos logs. Prefira copiar o arquivo diretamente de um cofre:

```bash
install -m 600 /caminho/protegido/servico-auth \
  instances/meu-projeto/monitoring/workspaces/equipe-a/secrets/servico-auth
```

### Validar e iniciar

Valide a rede da API, a credencial e o Compose:

```bash
./scripts/manage-monitoring-workspaces.sh \
  --instance meu-projeto validate equipe-a
```

Inicie o executor e aguarde seu healthcheck:

```bash
./scripts/manage-monitoring-workspaces.sh \
  --instance meu-projeto start equipe-a
```

Consulte estado e logs sanitizados:

```bash
./scripts/manage-monitoring-workspaces.sh \
  --instance meu-projeto status equipe-a

./scripts/manage-monitoring-workspaces.sh \
  --instance meu-projeto logs equipe-a
```

Sem informar identificadores após a ação, o script opera todos os diretórios
`workspaces/*/.env`. Falha em um workspace é reportada sem interromper os
demais. Para interromper somente um executor:

```bash
./scripts/manage-monitoring-workspaces.sh \
  --instance meu-projeto stop equipe-a
```

Cadastre inicialmente os monitores como desabilitados na UI. Depois que o
executor estiver saudável, habilite primeiro um destino de teste e confirme a
primeira observação no histórico antes de habilitar os demais. Para adicionar
outro workspace, repita a estrutura com outro diretório, ID e identidade
técnica; não compartilhe o arquivo `executor-api-key` entre workspaces.

## Diagnóstico

Para Codex:

```bash
BIAWS_ENV_FILE="$PWD/instances/meu-projeto/.env" \
node biaws-cli/src/index.js \
  agent doctor codex \
  --project "$HOME/Source/meu-projeto" \
  --workspace id-do-workspace
```

Para Claude Code:

```bash
BIAWS_ENV_FILE="$PWD/instances/meu-projeto/.env" \
node biaws-cli/src/index.js \
  agent doctor claude \
  --project "$HOME/Source/meu-projeto" \
  --workspace id-do-workspace
```

Resultado esperado:

```text
OK  node
OK  api
OK  authentication
OK  workspace
OK  mcp
OK  configuration
OK  skills
```

## Operar uma instância

Defina um atalho para o Compose:

```bash
BIAWS_ROOT="$PWD"

biaws_compose() {
  docker compose \
    --env-file "$BIAWS_ROOT/instances/meu-projeto/.env" \
    --project-name biaws-meu-projeto \
    --project-directory "$BIAWS_ROOT" \
    "$@"
}
```

Comandos usuais:

```bash
biaws_compose ps
biaws_compose logs -f api
biaws_compose restart api ui
biaws_compose down
biaws_compose up -d
```

`down` remove os containers, mas preserva os volumes nomeados e não apaga os
diretórios configurados como bind mounts.

> Não execute `down --volumes` se desejar manter banco e anexos.

Para eliminar uma instância, seus containers, rede, volumes nomeados e arquivos
mantidos dentro do diretório da instância, use:

```bash
./scripts/remove-instance.sh --instance meu-projeto
```

O comando exige a confirmação pelo nome. Dados configurados em bind mounts fora
da instância são preservados, salvo quando `--delete-external-data` também for
informado.

## Usar mais de uma instância

Crie outras instâncias usando o mesmo clone:

```bash
./scripts/setup-local.sh \
  --instance cliente-a \
  --client codex \
  --project "$HOME/Source/cliente-a"

./scripts/setup-local.sh \
  --instance cliente-b \
  --client codex \
  --project "$HOME/Source/cliente-b"
```

Liste as instâncias:

```bash
./scripts/setup-server.sh --list-instances
```

Sem `--instance`, o setup oferece um seletor quando executado em um terminal
interativo.

## Reconfigurar sem reconstruir

Para garantir as skills ausentes e reaplicar a configuração MCP sem repetir o
bootstrap:

```bash
./scripts/configure.sh \
  --client codex \
  --project "$HOME/Source/meu-projeto" \
  --env-file "$PWD/instances/meu-projeto/.env" \
  --workspace id-do-workspace
```

Se já existir uma configuração `biaws` não gerenciada que deva passar ao
controle do CLI, revise-a e acrescente `--force`.

Para atualizar as skills já instaladas:

```bash
BIAWS_ENV_FILE="$PWD/instances/meu-projeto/.env" \
node biaws-cli/src/index.js \
  skills update \
  --workspace id-do-workspace \
  --target "$HOME/Source/meu-projeto/.agents/skills"
```

Para Claude Code, use
`--target "$HOME/Source/meu-projeto/.claude/skills"`.

## Atualizar o Bondia Workspaces

Se estiver acompanhando o branch principal, atualize o único clone:

```bash
git pull --ff-only
```

Se instalou uma release, selecione explicitamente a nova versão:

```bash
git fetch --tags
git switch --detach vX.Y.Z
```

Depois, execute novamente o setup para cada instância que desejar reconstruir:

```bash
./scripts/setup-local.sh \
  --instance meu-projeto \
  --client codex \
  --project "$HOME/Source/meu-projeto"
```

Antes de atualizar ambientes com dados importantes, siga o roteiro de backup e
restauração em [docs/operations.md](docs/operations.md).

## Arquivos locais importantes

```text
instances/
└── meu-projeto/
    ├── .env
    └── .bootstrap-admin-password
```

Esses arquivos são ignorados pelo Git e não devem ser copiados para locais
públicos.

No projeto consumidor, o setup cria:

Codex:

```text
.codex/config.toml
.agents/skills/
.agents/biaws-skills.lock.json
```

Claude Code:

```text
.mcp.json
.claude/skills/
.claude/biaws-skills.lock.json
```

As configurações MCP contêm caminhos absolutos da máquina e o ID do workspace,
mas não a chave técnica. Evite versioná-las quando o projeto não possuir um
caminho de instalação padronizado para toda a equipe. O segredo permanece
somente no `.env` da instância.

## Próximos passos

- Consulte a visão geral em [README.md](README.md).
- Veja backup, restauração e atualização em
  [docs/operations.md](docs/operations.md).
- Conheça as ferramentas disponíveis em
  [biaws-mcp/README.md](biaws-mcp/README.md).
- Consulte os comandos do CLI em [biaws-cli/README.md](biaws-cli/README.md).
