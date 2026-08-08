# Bondia Workspaces

**A camada operacional do harness para pessoas e agentes operarem e evoluírem software.**

O Bondia Workspaces (`biaws`) é uma plataforma open source e agent-native que
conecta trabalho, conhecimento, topologia e sinais operacionais. Pessoas usam a
interface web; agentes autorizados acessam o mesmo contexto por ferramentas de
domínio, com identidade, escopo e auditoria.

> **Status:** alpha (`0.x`). O projeto é adequado para avaliação, demonstração e
> desenvolvimento local. Ainda não há garantia de compatibilidade entre versões
> nem recomendação para dados críticos de produção.

**Nomenclatura:** a marca apresentada às pessoas é **Bondia Workspaces**. Código,
comandos, banco de dados, containers e outros identificadores técnicos usam a
sigla curta `biaws`.

Para começar, escolha a rota do seu sistema no [QUICKSTART](QUICKSTART.md) ou
[entregue a instalação ao seu agente](docs/agent-assisted-installation.md) com
um único prompt.

![Dashboard operacional do workspace fictício Athena Tek](docs/screenshots/athena-operations-dashboard.jpg)

<table>
  <tr>
    <td><img src="docs/screenshots/athena-application-topology.jpg" alt="Topologia da aplicação Helix Desk"></td>
    <td><img src="docs/screenshots/athena-monitoring-details.jpg" alt="Detalhes de monitoramento de um runtime degradado"></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/athena-business-rules.jpg" alt="Regra de negócio ativa do MailPilot"></td>
    <td><img src="docs/screenshots/athena-improvement-tracking.jpg" alt="Acompanhamento de melhoria e tarefas do FlowForge"></td>
  </tr>
</table>

As telas usam o workspace fictício **Athena Tek**, uma pequena software house
operando três aplicações de clientes. Nenhum endereço, cliente ou dado exibido
representa um ambiente real.

## Por que uma camada de harness operacional?

Um agente é tão útil quanto o contexto, as ferramentas e os limites oferecidos
ao seu redor. Na prática, essas informações costumam ficar separadas entre
chamados, documentos, inventários, dashboards e o conhecimento tácito da equipe.

O BIAWS transforma esse material em uma camada operacional compartilhada:

- **contexto:** chamados, melhorias, tarefas, procedimentos, regras e decisões;
- **mapa:** aplicações, componentes, repositórios, integrações, servidores,
  deployments e runtimes;
- **sinais:** histórico passivo e idempotente da saúde dos runtimes;
- **guardrails:** workspaces, identidades, grupos, permissões, escopo por
  aplicação, cofre criptografado e auditoria;
- **ferramentas:** operações estruturadas via MCP, CLI e skills versionadas.

O projeto não orquestra modelos nem executa agentes. Ele fornece a camada de
contexto e controle que clientes como Codex, Claude e outros agentes compatíveis
podem usar para trabalhar sobre sistemas reais.

## Use o agente que você já assina

O BIAWS não chama diretamente a API de um provedor de modelos e não exige uma
`OPENAI_API_KEY` ou `ANTHROPIC_API_KEY`. Ele executa um servidor MCP que oferece
contexto e ferramentas ao cliente escolhido pelo usuário. Não há, portanto, um
token de modelo entregue à plataforma para ficar disponível a automações em
segundo plano ou fluxos desconhecidos.

Quem já usa o Codex com um plano ChatGPT elegível ou o Claude Code autenticado
por uma assinatura Pro ou Max pode conectar o MCP do BIAWS e operar dentro do
uso incluído no próprio plano, sem contratar cobrança de API separada apenas
para acessar a plataforma. O Codex e o Claude Code documentam oficialmente o
uso por assinatura e a conexão com servidores MCP:

- [Codex com um plano ChatGPT](https://help.openai.com/pt-br/articles/11369540-using-codex-with-your-chatgpt-plan)
  e [configuração MCP no Codex](https://developers.openai.com/codex/mcp/);
- [Claude Code com Pro ou Max](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan)
  e [configuração MCP no Claude Code](https://docs.anthropic.com/en/docs/claude-code/mcp).

O uso continua sujeito aos limites da assinatura escolhida. Créditos extras,
pay-as-you-go ou upgrades só entram em cena quando o próprio usuário decide
ultrapassar esses limites. A chave técnica criada pelo setup autentica o MCP no
BIAWS local; ela não é um token faturável do provedor do modelo.

## Como o harness se organiza

| Camada                 | O que o BIAWS oferece                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------- |
| Trabalho               | Chamados, melhorias, tarefas, prazos, checklists, anexos e jornadas                    |
| Conhecimento           | Procedimentos e documentos tipados em Markdown                                         |
| Topologia              | Aplicações, componentes, repositórios, integrações, servidores, deployments e runtimes |
| Observação             | Sinais externos de saúde, metadados operacionais e relação com procedimentos           |
| Controle               | Tenancy, permissões, escopo por aplicação, segredos e trilha de auditoria              |
| Interface para agentes | MCP com ferramentas de domínio, CLI e catálogo de skills                               |

## Comece pelo contexto que já existe

O primeiro inventário não precisa começar em um formulário. O catálogo inicial
inclui skills de descoberta que ajudam o modelo a ler evidências já presentes no
projeto, comparar o resultado com o BIAWS e propor um mapa para revisão:

| Skill                              | O que descobre                                            | Fontes típicas                                         |
| ---------------------------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| `$biaws-discover-application`      | Aplicações, componentes, repositórios e integrações       | Código, manifests de pacotes, contratos e documentação |
| `$biaws-discover-infrastructure`   | Servidores, deployments, runtimes e relações de topologia | Docker, Kubernetes, IaC, CI/CD e runbooks              |
| `$biaws-discover-secret-inventory` | Nomes, escopos, consumidores e referências de segredos    | Templates de ambiente, schemas, manifests e workflows  |

As descobertas são baseadas em evidências e funcionam em modo de proposta por
padrão. O agente mostra fontes, confiança, correspondências e lacunas; a equipe
revisa as diferenças antes de autorizar o registro via MCP. No inventário de
segredos, valores reais nunca são lidos nem enviados ao BIAWS — somente
metadados e referências seguras.

Depois do setup, por exemplo, peça ao agente:

```text
Use $biaws-discover-application para mapear este repositório no workspace,
mas apresente a proposta e as evidências antes de registrar qualquer mudança.
```

## Destaques

- home pessoal baseada em um catálogo expansível de widgets configuráveis;
- chamados com importação EML, anexos, filtros, indicadores e taxonomia;
- melhorias com especificação Markdown, tarefas, checklist, prazos e acompanhamento de jornadas;
- procedimentos organizados em coleções, classificados pela mesma taxonomia e
  associáveis a runtimes;
- documentos tipados em Markdown — regras, decisões, guidelines, features e referências técnicas — com coleções,
  contexto de aplicação, componentes, revisões e referências estruturadas;
- workspaces e aplicações como fronteiras de organização e autorização;
- componentes, repositórios, servidores, deployments e runtimes com consultas
  reversas e contexto agregado;
- recepção passiva e idempotente de sinais externos de saúde dos runtimes, com
  apresentação estruturada dos metadados;
- autenticação, chaves de API, grupos e permissões;
- cofre local para textos e arquivos secretos reversíveis, com versões criptografadas e chave
  mestra separada;
- trilha de auditoria funcional;
- servidor MCP com ferramentas de catálogo, topologia, issues, melhorias,
  procedimentos, conhecimento, coleções e metadados de segredos;
- CLI para publicar, instalar e atualizar skills;
- UI React responsiva e acessível;
- MongoDB e armazenamento local de anexos, com contrato preparado para outros
  providers.

## Arquitetura

```mermaid
flowchart LR
    Browser[UI React] --> API[biaws-api / Express]
    Agent[Cliente MCP] --> MCP[biaws-mcp]
    Monitor[Agente de monitoramento] --> CLI
    CLI[biaws-cli] --> API
    MCP --> API
    API --> Mongo[(MongoDB)]
    API --> Files[(Anexos locais)]
```

Detalhes de responsabilidades e fluxos estão em
[docs/architecture.md](docs/architecture.md).

## Instalação

O runtime usa containers, mas o setup também configura o MCP e as skills no
projeto que será operado pelo agente. Estas são as rotas oficialmente
documentadas:

| Ambiente | Rota suportada                                                        |
| -------- | --------------------------------------------------------------------- |
| macOS    | Bash + Docker Desktop                                                 |
| Linux    | Bash + Docker Engine ou Docker Desktop                                |
| Windows  | WSL2 + uma distribuição Linux + integração do Docker Desktop          |
| Agente   | Um único prompt; o agente detecta o sistema e executa esta mesma rota |

Windows nativo, PowerShell, Prompt de Comando, Git Bash, MSYS2 e Cygwin não são
ambientes de execução suportados. No Windows, clone o repositório e mantenha os
dados dentro do filesystem do WSL2, não em `/mnt/c`.

As instruções de instalação dos pré-requisitos para cada sistema e o fluxo
completo estão no [QUICKSTART](QUICKSTART.md). Se você já usa Codex, Claude Code
ou outro agente com terminal, copie o
[prompt de instalação assistida](docs/agent-assisted-installation.md): o agente
poderá instalar o BIAWS sem pedir que você digite comandos, solicitando apenas
as aprovações necessárias.

### Fluxo comum após instalar os pré-requisitos

Pré-requisitos:

- Docker com o plugin Compose;
- Node.js `20.19.0` ou superior;
- `curl` e `openssl`;

Valide o ambiente antes do primeiro setup:

```bash
./scripts/check-prerequisites.sh --include-git
```

Crie ou selecione uma instância e configure o projeto consumidor:

```bash
./scripts/setup-agent.sh \
  --instance meu-projeto \
  --client codex \
  --project /caminho/do/projeto
```

O script:

1. cria `instances/meu-projeto/.env`, se necessário;
2. cria os comandos de start, stop, backup e restore em
   `instances/meu-projeto`;
3. seleciona portas livres para o MongoDB, a API e a UI;
4. gera um `BETTER_AUTH_SECRET` local;
5. constrói e inicia MongoDB, API e UI;
6. cria o primeiro administrador;
7. cria uma identidade técnica de menor privilégio para MCP e CLI;
8. publica o catálogo inicial de skills;
9. instala as skills e configura o MCP no projeto consumidor;
10. executa o diagnóstico completo.

Ao final, ele mostra a credencial inicial e os endereços:

- UI: <http://localhost:4400>
- API: <http://localhost:3100>
- MongoDB: `mongodb://127.0.0.1:27017/biaws`
- health check: <http://localhost:3100/api/health>

A senha inicial fica em
`instances/meu-projeto/.bootstrap-admin-password`, ignorado pelo Git. Troque-a
pela UI no primeiro acesso.

A chave técnica fica somente no `.env` da instância, também ignorado pelo Git.
Ela não é exibida no resumo do bootstrap.

O workspace é uma escolha do projeto consumidor, não da instância. Quando a
identidade técnica tiver acesso a mais de um, informe-o ao setup:

```bash
./scripts/setup-agent.sh \
  --instance meu-projeto \
  --client codex \
  --project /caminho/do/projeto \
  --workspace id-do-workspace
```

Sem `--workspace`, o setup seleciona automaticamente quando a chave acessa um
único workspace. A opção não concede acesso: a identidade técnica precisa ser
membro ativo do workspace selecionado.

Para publicar também as starter skills no workspace selecionado, execute o setup
com `--publish-starter-skills`:

```bash
./scripts/setup-agent.sh \
  --instance meu-projeto \
  --client codex \
  --project /caminho/do/projeto \
  --workspace id-do-workspace \
  --publish-starter-skills
```

O workspace informado deve existir e estar ativo. O comando publica as skills
ausentes e ignora versões que já existem. Versões publicadas são imutáveis; para
distribuir conteúdo alterado, publique uma nova versão.

Inicie e pare a instância com:

```bash
instances/meu-projeto/start.sh
instances/meu-projeto/stop.sh
instances/meu-projeto/backup-mongo.sh
instances/meu-projeto/restore-mongo.sh backups/biaws-<data>.archive.gz
```

O backup lógico do MongoDB recebe timestamp e checksum SHA-256. O restore
confere o checksum, quando presente, e solicita confirmação explícita antes de
substituir o banco da instância.

Para informar sua própria credencial:

```bash
BIAWS_BOOTSTRAP_ADMIN_EMAIL=voce@example.com \
BIAWS_BOOTSTRAP_ADMIN_NAME="Seu Nome" \
BIAWS_BOOTSTRAP_ADMIN_PASSWORD="uma-senha-segura-com-12-ou-mais-caracteres" \
./scripts/setup-agent.sh \
  --instance meu-projeto \
  --client codex \
  --project /caminho/do/projeto
```

Para iniciar sem dados de demonstração:

```bash
BIAWS_SKIP_DEMO_SEED=1 ./scripts/setup-agent.sh \
  --instance meu-projeto \
  --client codex \
  --project /caminho/do/projeto
```

Liste as instâncias:

```bash
./scripts/setup-agent.sh --list-instances
```

O seed nunca apaga registros e não substitui uma taxonomia já existente. Veja
[docs/demo-data.md](docs/demo-data.md).

Atualizações, backup, restauração e diagnóstico estão no
[runbook operacional](docs/operations.md).

## Várias instâncias, um único clone

Cada instância mantém somente configuração e credenciais em `instances/<nome>`.
Código, imagens Docker, MCP e CLI são compartilhados pelo mesmo clone. O nome do
projeto Compose, os volumes, as portas, o banco e a chave técnica permanecem
isolados.

```bash
./scripts/setup-agent.sh \
  --instance cliente-a \
  --client codex \
  --project /projetos/cliente-a

./scripts/setup-agent.sh \
  --instance cliente-b \
  --client claude \
  --project /projetos/cliente-b
```

Portas são alocadas automaticamente para instâncias novas. Use `--mongo-port`,
`--api-port` e `--ui-port` para fixá-las. Sem `--instance`, o script oferece um
seletor em terminais interativos.

Para repetir somente a configuração do cliente:

```bash
./scripts/setup-agent.sh \
  --instance cliente-a \
  --client codex \
  --project /caminho/do/projeto \
  --skip-bootstrap
```

O MCP recebe `BIAWS_ENV_FILE` e `ISSUE_WORKSPACE_ID` na configuração local do
projeto. O primeiro aponta para as credenciais e a URL da instância; o segundo
fixa a fronteira de workspace daquele projeto. Assim, projetos diferentes podem
usar workspaces diferentes da mesma instância e chave técnica. Configurações
globais do cliente não são alteradas. Codex usa `.codex/config.toml`; Claude
Code usa `.mcp.json`.

O cliente pode solicitar aprovação para usar um servidor MCP definido pelo
projeto. Revise o caminho apresentado antes de aprovar.

## Desenvolvimento local

O runtime mínimo suportado é Node.js `20.19.0`; Node.js 22 LTS é recomendado.
Copie `.env.example` para `.env`, configure MongoDB e um segredo com pelo menos
32 caracteres.

API:

```bash
cd biaws-api
npm ci
npm run bootstrap:admin
npm run dev
```

UI:

```bash
cd biaws-ui
npm ci
npm run dev
```

Validações:

```bash
cd biaws-api && npm run check && npm test
cd biaws-ui && npm run check:css && npm test && npm run build
cd biaws-mcp && npm run check && npm test
cd biaws-cli && npm run check && npm test
```

## MCP e CLI

O bootstrap preenche URL e chave no `.env` da instância. Para uma configuração
manual do CLI, crie uma chave na área da conta e defina:

```bash
export ISSUE_API_URL=http://127.0.0.1:3100
export ISSUE_API_KEY=biaws_sua_chave
export ISSUE_WORKSPACE_ID=id-do-workspace
```

Na configuração MCP, mantenha `BIAWS_ENV_FILE` apontando para o `.env` da
instância e grave `ISSUE_WORKSPACE_ID` no bloco `env` do servidor `biaws`. O
`setup-agent.sh` faz isso automaticamente.

Servidor MCP:

```bash
node "$PWD/biaws-mcp/src/index.js"
```

CLI:

```bash
node biaws-cli/src/index.js skills list
node biaws-cli/src/index.js skills status
node biaws-cli/src/index.js agent doctor codex --project /caminho/do/projeto --workspace id-do-workspace
node biaws-cli/src/index.js monitoring signal <aplicação.componente.deployment.runtime> --status healthy --source synthetic-http
```

Consulte [biaws-mcp/README.md](biaws-mcp/README.md) e
[biaws-cli/README.md](biaws-cli/README.md) para o catálogo completo. O contrato
de ingestão está em [docs/monitoring.md](docs/monitoring.md).

## Projeto e comunidade

- [Status, releases e suporte](docs/project-status.md)
- [Arquitetura](docs/architecture.md)
- [Documentos de conhecimento](docs/knowledge.md)
- [Guidelines de desenvolvimento](docs/guidelines/INDEX.md)
- [Operação e recuperação](docs/operations.md)
- [Índices e performance](docs/performance.md)
- [Como contribuir](CONTRIBUTING.md)
- [Política de segurança](SECURITY.md)
- [Código de conduta](CODE_OF_CONDUCT.md)
- [Changelog](CHANGELOG.md)

Relatos de vulnerabilidade não devem ser publicados em issues. Use o fluxo
descrito em [SECURITY.md](SECURITY.md).

## Licença

Copyright 2026 Fabiano Bondia.

Distribuído sob a [Apache License 2.0](LICENSE).
