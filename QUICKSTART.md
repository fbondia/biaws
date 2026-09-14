# Início rápido

Este guia cobre as duas formas suportadas de começar com o **Bondia
Workspaces**:

- conectar um projeto a uma instância que já existe;
- hospedar uma instância local ou compartilhada e depois conectar projetos.

O comando `biaws` é a interface pública. Os scripts em `scripts/` implementam
partes do ciclo de vida e permanecem disponíveis para compatibilidade e
diagnóstico avançado, mas não são a rota principal deste guia.

## 1. Instalar o CLI

O CLI requer Node.js `20.19.0` ou superior. Node.js 22 LTS é recomendado.

```bash
npm install --global biaws
biaws --version
biaws --help
```

Ele possui três níveis canônicos:

```text
biaws admin ...      # instalação, instâncias e executores
biaws config ...     # perfis, URLs e credenciais do CLI
biaws workspace ...  # associação da pasta e recursos do workspace
```

## 2. Escolher a rota

### Conectar a um servidor existente

Você precisa de:

- URL HTTPS da API;
- chave individual com acesso ao workspace;
- ID ou nome do workspace;
- Codex ou Claude Code instalado e autenticado.

Não é necessário Docker nem um checkout local do BIAWS.

### Hospedar uma instância

Além do CLI, você precisa de:

- macOS ou Linux; no Windows, use WSL2;
- Git e Bash;
- Docker com o plugin Compose;
- `curl`, `openssl` e `tar`;
- os assets completos de uma release ou checkout do BIAWS.

Windows nativo, PowerShell, Prompt de Comando, Git Bash, MSYS2 e Cygwin não são
ambientes suportados para hospedar a plataforma. No WSL2, mantenha instalação e
dados no filesystem Linux, não em `/mnt/c`.

## 3. Conectar um projeto a uma instância existente

Crie um arquivo privado fora do projeto:

```dotenv
BIAWS_API_URL=https://biaws.exemplo.com
BIAWS_API_KEY=biaws_chave_individual
```

Proteja o arquivo e configure também um perfil global para os comandos diretos
do CLI:

```bash
chmod 600 ~/.config/biaws/equipe.env
biaws config init --api-url https://biaws.exemplo.com
biaws config doctor
```

`config init` solicita a chave de forma mascarada. Para automação, forneça
`BIAWS_API_KEY` pelo ambiente do processo.

Associe a pasta ao workspace. O arquivo `.biaws/config.json` recebe apenas o
perfil e o ID do workspace, nunca a chave:

```bash
cd /caminho/do/projeto
biaws workspace init id-do-workspace
biaws workspace current
```

Configure o agente. O arquivo privado é necessário porque o processo MCP é
executado separadamente do CLI e não lê `credentials.json`:

```bash
biaws workspace agent configure codex \
  --env-file ~/.config/biaws/equipe.env \
  --workspace id-do-workspace

biaws workspace agent doctor codex \
  --env-file ~/.config/biaws/equipe.env \
  --workspace id-do-workspace
```

Para Claude Code, substitua `codex` por `claude`. Em terminal interativo, o CLI
pode solicitar o workspace quando ele não for informado.

O Codex recebe `.codex/config.toml` e skills em `.agents/skills/`. O Claude Code
recebe `.mcp.json` e skills em `.claude/skills/`. O servidor MCP é fixado como
`npx --yes biaws-mcp@<versão>` e nenhuma chave é gravada nesses arquivos.

## 4. Hospedar uma instância local

Obtenha os assets e valide o ambiente:

```bash
git clone https://github.com/fbondia/biaws.git
cd biaws
biaws admin doctor
```

Quando uma release completa estiver publicada, os mesmos assets podem ser
obtidos com `biaws admin install --version <versão> --directory <destino>`. O
instalador verifica o checksum e recusa diretórios não vazios.

Crie a instância pelo assistente:

```bash
biaws admin instance setup --root "$PWD" --interactive
```

O CLI mostra um plano antes de alterar arquivos ou chamar Docker. O setup:

1. cria `instances/<nome>/.env`;
2. seleciona e valida as portas externas;
3. configura volumes Docker ou diretórios persistentes;
4. gera os segredos locais;
5. constrói e inicia MongoDB, API e UI;
6. cria o administrador inicial e as identidades técnicas;
7. publica o catálogo inicial de skills.

As portas `27017`, `3100` e `4400` são defaults, não endereços garantidos.
Consulte o resultado efetivo:

```bash
biaws admin instance list --root "$PWD"
biaws admin instance show minha-instancia --root "$PWD"
biaws admin instance status minha-instancia --root "$PWD"
```

A senha inicial fica em
`instances/<nome>/.bootstrap-admin-password`, com o diretório ignorado pelo Git.
Troque-a pela UI no primeiro acesso. Não exiba nem copie a chave técnica mantida
no `.env`.

Para conectar um projeto da mesma máquina, use o fluxo da seção anterior com:

```bash
biaws workspace agent configure codex \
  --project /caminho/do/projeto \
  --env-file "$PWD/instances/minha-instancia/.env" \
  --workspace id-do-workspace
```

## 5. Hospedar um servidor compartilhado

No servidor, crie a instância com a origem HTTPS final:

```bash
biaws admin instance setup \
  --root /opt/biaws \
  --name equipe \
  --public-url https://biaws.exemplo.com \
  --interactive
```

Publique UI e API por um proxy HTTPS, encaminhando `/api` para a API. Não exponha
o MongoDB nem distribua o `.env` da instância. Depois do primeiro acesso, crie
uma chave individual para cada pessoa ou automação e aplique o fluxo de cliente
remoto da seção 3.

Requisitos de proxy, isolamento e credenciais estão em
[docs/shared-server.md](docs/shared-server.md).

## 6. Operar e atualizar instâncias

Use `--root` ou defina `BIAWS_ROOT` para a instalação administrativa:

```bash
biaws admin instance start minha-instancia --root /opt/biaws
biaws admin instance stop minha-instancia --root /opt/biaws
biaws admin instance status minha-instancia --root /opt/biaws
biaws admin instance update minha-instancia --root /opt/biaws --check
```

O update efetivo valida o Compose, cria backup completo por padrão e reconstrói
os serviços. Ele não executa `git pull` nem troca a release da instalação.

Backup, restore e remoção:

```bash
biaws admin instance backup minha-instancia --root /opt/biaws
biaws admin instance restore destino \
  --root /opt/biaws \
  --archive /caminho/minha-instancia-<data>.tar.gz.enc
biaws admin instance remove destino --root /opt/biaws
```

Backup e restore solicitam a senha de forma mascarada. Em automação, use
`--password-file` com um arquivo protegido por permissão `0600`. Restore e
remoção exigem confirmação explícita.

Detalhes sobre persistência, migração, rollback e diagnóstico estão em
[docs/operations.md](docs/operations.md).

## 7. Operar recursos do workspace

Depois de configurar o perfil e associar a pasta:

```bash
biaws workspace applications list
biaws workspace demands list
biaws workspace issues list --status open
biaws workspace skills status
```

Para uma rota ainda não coberta por comando de domínio:

```bash
biaws workspace api GET /catalog/workspaces
```

Leituras aceitam `--json` quando o resultado será consumido por automação.
Escritas de domínio resolvem o recurso antes da alteração e solicitam
confirmação quando aplicável.

## 8. Enviar um sinal de monitoramento

Cadastre uma aplicação, componente, deployment e runtime pela UI. Depois use o
UUID do runtime ou seu caminho de identificadores:

```bash
biaws workspace monitoring signal \
  <aplicação.componente.deployment.runtime> \
  --status healthy \
  --source quickstart \
  --signal-id quickstart:1 \
  --message "Primeiro sinal externo"
```

Repetir o comando com o mesmo `--signal-id` não cria outro evento. Consulte o
histórico com:

```bash
biaws workspace monitoring signals \
  <aplicação.componente.deployment.runtime> --limit 20
```

O contrato completo está em [docs/monitoring.md](docs/monitoring.md).

## 9. Executar monitoramentos ativos

O executor ativo é administrado no nível da instalação:

```bash
biaws admin monitoring provision id-do-workspace \
  --instance minha-instancia --root /opt/biaws
biaws admin monitoring validate \
  --instance minha-instancia --root /opt/biaws
biaws admin monitoring start \
  --instance minha-instancia --root /opt/biaws
biaws admin monitoring status \
  --instance minha-instancia --root /opt/biaws
biaws admin monitoring logs \
  --instance minha-instancia --root /opt/biaws
```

Antes de iniciar, revise allowlists de rede, scripts permitidos e referências de
segredos. Cada executor atende exatamente um workspace e deve possuir identidade
técnica própria. O runbook completo está em
[docs/active-monitoring-operations.md](docs/active-monitoring-operations.md).

## 10. Diagnóstico

```bash
biaws config show
biaws config doctor
biaws workspace current
biaws workspace agent doctor codex --env-file ~/.config/biaws/equipe.env
biaws admin doctor
biaws admin instance status minha-instancia --root /opt/biaws
```

Se o diagnóstico do agente falhar:

1. confirme que o arquivo passado em `--env-file` ainda existe e está protegido;
2. confira `BIAWS_API_URL` e a validade da chave;
3. confirme que a identidade pertence ao workspace selecionado;
4. revise a versão fixada do `biaws-mcp` no arquivo do cliente;
5. preserve o `stderr` do MCP para investigar falhas de transporte.

## 11. Arquivos locais importantes

Configuração global do CLI:

```text
~/.config/biaws/
├── config.json
└── credentials.json       # permissão 0600
```

Instalação administrativa:

```text
instances/
└── minha-instancia/
    ├── .env
    ├── .bootstrap-admin-password
    ├── backups/
    └── monitoring/
```

Projeto consumidor com Codex:

```text
.biaws/config.json
.codex/config.toml
.agents/skills/
.agents/biaws-skills.lock.json
```

Projeto consumidor com Claude Code:

```text
.biaws/config.json
.mcp.json
.claude/skills/
.claude/biaws-skills.lock.json
```

`.biaws/config.json` não contém credenciais e pode ser compartilhado quando o
perfil e o workspace forem convencionais para a equipe. Os arquivos MCP contêm
um caminho para o arquivo privado; não os versione quando esse caminho variar
entre máquinas.

## Próximos passos

- Visão geral: [README.md](README.md)
- Referência do CLI: [biaws-cli/README.md](biaws-cli/README.md)
- Ferramentas MCP: [biaws-mcp/README.md](biaws-mcp/README.md)
- Operação e recuperação: [docs/operations.md](docs/operations.md)
- Monitoramento ativo: [docs/active-monitoring-operations.md](docs/active-monitoring-operations.md)
