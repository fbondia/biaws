# Início rápido

Este guia mostra como iniciar uma instância local do **Bondia Workspaces** e
conectá-la ao Codex ou ao Claude Code.

Uma única cópia do repositório pode manter várias instâncias isoladas. Cada
instância possui banco, anexos, portas, usuários e credenciais próprios.

## Pré-requisitos

Instale:

- Git;
- Docker com o plugin Compose;
- Node.js `20.19.0` ou superior;
- `curl`;
- `openssl`.

Verifique o ambiente:

```bash
git --version
docker compose version
node --version
curl --version
openssl version
```

## 1. Baixar o Bondia Workspaces

Enquanto não houver uma release pública, clone o branch principal:

```bash
git clone https://github.com/fbondia/biaws.git
cd biaws
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
./scripts/setup-agent.sh \
  --instance meu-projeto \
  --client codex \
  --project "$HOME/Source/meu-projeto"
```

Para Claude Code:

```bash
./scripts/setup-agent.sh \
  --instance meu-projeto \
  --client claude \
  --project "$HOME/Source/meu-projeto"
```

O setup:

1. cria `instances/meu-projeto/.env`;
2. seleciona portas disponíveis;
3. gera os segredos locais;
4. constrói e inicia MongoDB, API e UI;
5. cria o administrador inicial;
6. cria uma identidade técnica para o agente;
7. publica o catálogo inicial de skills;
8. instala as skills no projeto consumidor;
9. configura o servidor MCP;
10. executa o diagnóstico e o handshake MCP.

Para escolher portas específicas:

```bash
./scripts/setup-agent.sh \
  --instance meu-projeto \
  --api-port 3101 \
  --ui-port 4401 \
  --client codex \
  --project "$HOME/Source/meu-projeto"
```

Para iniciar sem registros de demonstração:

```bash
BIAWS_SKIP_DEMO_SEED=1 \
./scripts/setup-agent.sh \
  --instance meu-projeto \
  --client codex \
  --project "$HOME/Source/meu-projeto"
```

### Escolher onde os dados serão armazenados

Sem opções adicionais, cada instância usa quatro volumes nomeados gerenciados
pelo Docker: MongoDB, anexos de issues, arquivos de requests e arquivos de
procedures. O nome efetivo recebe o prefixo do projeto Compose da instância.

Para armazenar tudo em diretórios visíveis no host, informe uma raiz absoluta
ao criar a instância:

```bash
./scripts/setup-agent.sh \
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
└── procedures/
```

Para escolher cada caminho separadamente:

```bash
./scripts/setup-agent.sh \
  --instance meu-projeto \
  --mongo-data-path "$HOME/biaws-data/mongo" \
  --issue-files-path "$HOME/biaws-data/issues" \
  --request-files-path "$HOME/biaws-data/requests" \
  --procedure-files-path "$HOME/biaws-data/procedures" \
  --client codex \
  --project "$HOME/Source/meu-projeto"
```

Os caminhos precisam ser absolutos, distintos, não aninhados entre si e
graváveis pelo Docker. Eles ficam registrados no `.env` da instância. Para
voltar aos volumes nomeados:

```bash
./scripts/setup-agent.sh \
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

- UI: <http://localhost:4400>;
- API: <http://localhost:3100>;
- health check: <http://localhost:3100/api/health>.

Se essas portas estiverem ocupadas, o setup seleciona outras e informa os
endereços efetivos.

A senha inicial também fica em:

```text
instances/meu-projeto/.bootstrap-admin-password
```

Entre na UI e altere a senha do administrador.

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

## Diagnóstico

Para Codex:

```bash
BIAWS_ENV_FILE="$PWD/instances/meu-projeto/.env" \
node biaws-cli/src/index.js \
  agent doctor codex \
  --project "$HOME/Source/meu-projeto"
```

Para Claude Code:

```bash
BIAWS_ENV_FILE="$PWD/instances/meu-projeto/.env" \
node biaws-cli/src/index.js \
  agent doctor claude \
  --project "$HOME/Source/meu-projeto"
```

Resultado esperado:

```text
OK  node
OK  api
OK  authentication
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

## Usar mais de uma instância

Crie outras instâncias usando o mesmo clone:

```bash
./scripts/setup-agent.sh \
  --instance cliente-a \
  --client codex \
  --project "$HOME/Source/cliente-a"

./scripts/setup-agent.sh \
  --instance cliente-b \
  --client codex \
  --project "$HOME/Source/cliente-b"
```

Liste as instâncias:

```bash
./scripts/setup-agent.sh --list-instances
```

Sem `--instance`, o setup oferece um seletor quando executado em um terminal
interativo.

## Reconfigurar sem reconstruir

Para garantir as skills ausentes e reaplicar a configuração MCP sem repetir o
bootstrap:

```bash
./scripts/setup-agent.sh \
  --instance meu-projeto \
  --client codex \
  --project "$HOME/Source/meu-projeto" \
  --skip-bootstrap
```

Para atualizar as skills já instaladas:

```bash
BIAWS_ENV_FILE="$PWD/instances/meu-projeto/.env" \
node biaws-cli/src/index.js \
  skills update \
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
./scripts/setup-agent.sh \
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

As configurações MCP contêm caminhos absolutos da máquina. Evite versioná-las
quando o projeto não possuir um caminho de instalação padronizado para toda a
equipe.

## Próximos passos

- Consulte a visão geral em [README.md](README.md).
- Veja backup, restauração e atualização em
  [docs/operations.md](docs/operations.md).
- Conheça as ferramentas disponíveis em
  [biaws-mcp/README.md](biaws-mcp/README.md).
- Consulte os comandos do CLI em [biaws-cli/README.md](biaws-cli/README.md).
