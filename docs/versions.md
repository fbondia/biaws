# Versionamento dos componentes

Os componentes Node.js do BIAWS têm versões independentes. A fonte canônica
de cada uma é o `package.json` do próprio componente, mas nem toda versão tem o
mesmo significado operacional:

| Componente               | Pacote                | Uso da versão                                          |
| ------------------------ | --------------------- | ------------------------------------------------------ |
| `biaws-api`              | privado               | metadado npm e versão do documento OpenAPI             |
| `biaws-ui`               | privado               | metadado npm do componente; não é exposto pelo bundle  |
| `biaws-mcp`              | público (`biaws-mcp`) | pacote npm e versão anunciada no handshake MCP         |
| `biaws-cli`              | público (`biaws`)     | pacote npm e versão da ferramenta de administração     |
| `biaws-monitor-executor` | privado               | metadado npm do componente; não é exposto pelo runtime |

`shared` e a raiz do repositório não têm versão própria. O arquivo
`shared/package.json` é privado e não possui o campo `version`; o
`package.json` da raiz está vazio.

## Manifesto da instalação

O arquivo `release.json` na raiz define a release da plataforma, independente
da versão do CLI. Seu contrato contém:

- `schemaVersion`: formato do manifesto, atualmente `1`;
- `version`: versão SemVer da release, usada em `BIAWS_VERSION`, no health da API
  e nos labels OCI;
- `deploymentRevision`: inteiro positivo que deve aumentar quando Compose,
  Dockerfiles, bootstrap, migrações ou configuração de implantação mudarem;
- `components`: versões de `biaws-api`, `biaws-ui` e `biaws-monitor-executor`,
  sincronizadas com os respectivos `package.json`.

Ao alterar a versão de um desses componentes, atualize também sua entrada em
`release.json`. O CLI, o setup e a CI rejeitam manifestos divergentes dos pacotes:

```bash
node scripts/release-manifest.mjs check
```

Cada release distribuída deve receber uma nova `version`. A detecção também
compara cada componente e `deploymentRevision`, portanto uma alteração nesses
campos exige atualização mesmo se a versão geral tiver sido mantida. O CLI e o
MCP são ferramentas distribuídas separadamente e não integram esse manifesto.
Executores externos mantêm seu processo de publicação e atualização próprio.

Após o setup ou update concluir com sucesso, o manifesto aplicado é gravado em
`instances/<instancia>/release.json`. `update --check` compara esse snapshot com
o manifesto do checkout e mostra as diferenças; a ordem das chaves não importa.
Instâncias sem snapshot são legadas e exigem uma atualização, mesmo que seu
`BIAWS_VERSION` coincida. Manifestos inválidos geram erro, não são ignorados.
Com manifestos iguais, o update não cria backup nem reconstrói; `--force`
permite repetir a implantação. Não há comparação de commits nem `git pull`.

O update continua reconstruindo a instalação completa e inclui o executor
local se ele já existir no projeto Compose, mesmo sem ativar novamente o
profile. O executor opcional ausente só é iniciado quando seu profile é
habilitado. `setup --skip-bootstrap` não registra uma release aplicada. O restore
invalida o snapshot, pois restaura dados e configuração, não imagens: execute
update no checkout desejado para reconciliar a instalação.

## Regra geral

Use [Semantic Versioning](https://semver.org/lang/pt-BR/): `patch` para correção
compatível, `minor` para funcionalidade compatível e `major` para mudança
incompatível. Enquanto um componente estiver em `0.x`, trate mudanças
incompatíveis como uma decisão explícita de release e documente a migração.

Não edite apenas o primeiro campo `version` do `package-lock.json`. A versão do
projeto também aparece em `packages[""]`. A partir da raiz do repositório, o
modo preferido de atualizar os dois arquivos é:

```bash
cd <componente>
npm version <nova-versao> --no-git-tag-version
cd ..
```

O comando não cria commit nem tag. Caso o `package.json` já tenha sido alterado
manualmente, regenere o lock com `npm install --package-lock-only` dentro do
componente e confira as duas posições:

```bash
node -e 'const p=require("./<componente>/package.json"); const l=require("./<componente>/package-lock.json"); if (p.version !== l.version || p.version !== l.packages[""].version) process.exit(1)'
```

Antes de alterar arquivos, procure referências fixas à versão antiga. Isso
evita confundir versões de exemplos de domínio com a versão do componente:

```bash
rg -n --hidden --glob '!**/node_modules/**' --glob '!.git/**' \
  --glob '!**/package-lock.json' '<versao-antiga>' .
```

Atualize `CHANGELOG.md` quando a release representar uma mudança pública. Não
substitua números que sejam apenas dados de exemplo, versões de dependências,
versões de templates, skills ou publicações do catálogo.

## API (`biaws-api`)

Arquivos obrigatórios:

- `biaws-api/package.json`;
- `biaws-api/package-lock.json`, tanto `version` na raiz quanto
  `packages[""].version`;
- `info.version` no gerador `biaws-api/src/contracts/openapi.ts`;
- `biaws-api/openapi/openapi.json`, regenerado com `npm run openapi:generate`;
- `sonar.projectVersion` em `biaws-api/sonar-project.properties.example` e a
  referência correspondente em `biaws-api/docs/api-review-sonar.md`.

A versão independente da API é exposta no documento OpenAPI quando a
documentação está habilitada. O endpoint
`/api/health` não lê `biaws-api/package.json`: ele devolve `BIAWS_VERSION`,
recebida pelo serviço `api` em `compose.yaml`. Essa variável representa a
**release da plataforma**, definida pelo manifesto, e não a versão independente
do pacote da API. Portanto, não altere `.env.example`, `compose.yaml` ou testes
de `BIAWS_VERSION` ao fazer somente um bump da API. Atualize a entrada
`components.biaws-api` do manifesto.

A API usa TypeScript estrito e executa JavaScript compilado em produção,
inclusive nos comandos de bootstrap, seed e migração. O build emite
`dist/biaws-api/src`; `npm run check` verifica a tipagem sem emitir arquivos.

Validação do componente (com MongoDB de teste disponível):

```bash
cd biaws-api
export BIAWS_INTEGRATION_MONGO_URI=mongodb://127.0.0.1:27017/biaws_release_test
export BIAWS_HTTP_INTEGRATION=1
npm ci
npm run format:check
npm run check
npm run openapi:check
npm run build
npm test
npm run test:compiled
npm audit --omit=dev --audit-level=high
```

`npm run test:compiled` recompila fontes e testes e executa a suíte compilada.
Sem as variáveis acima, as integrações MongoDB e a jornada HTTP não são
exercitadas integralmente. Use um banco exclusivo para os testes.

Como a API é empacotada por `docker/api.Dockerfile`, valide também a imagem
quando houver release/deploy do componente:

```bash
docker compose --env-file instances/<instancia>/.env \
  --project-name biaws-<instancia> build api
docker compose --env-file instances/<instancia>/.env \
  --project-name biaws-<instancia> config --quiet
```

Mudanças de integração, bootstrap, seed ou configuração exigem o smoke de
Compose descrito mais adiante.

## UI (`biaws-ui`)

Arquivos obrigatórios:

- `biaws-ui/package.json`;
- `biaws-ui/package-lock.json`, nas duas posições de versão do projeto.

Não existe versão fixada no código da UI. Assim como na API, o label
`org.opencontainers.image.version` de `compose.yaml` usa a release da plataforma
(`BIAWS_VERSION`), não `biaws-ui/package.json`. Um bump isolado da UI não exige
alterar Compose nem os exemplos de versões presentes nos testes de catálogo;
atualize `components.biaws-ui` em `release.json`.

Validação do componente:

```bash
cd biaws-ui
npm ci
npm run format:check
npm run check:css
npm test
npm run build
npm audit --audit-level=high
```

O bundle é construído por `docker/ui.Dockerfile`. Para uma release/deploy,
valide também:

```bash
docker compose --env-file instances/<instancia>/.env \
  --project-name biaws-<instancia> build ui
docker compose --env-file instances/<instancia>/.env \
  --project-name biaws-<instancia> config --quiet
```

## MCP (`biaws-mcp`)

O MCP possui mais de uma cópia intencional da versão. Atualize em conjunto:

- `biaws-mcp/package.json` e `biaws-mcp/package-lock.json`;
- `SERVER_VERSION` em `biaws-mcp/src/version.ts`;
- as expectativas da versão em
  `biaws-mcp/test/infrastructure/protocol/index-stdio.test.ts` e
  `biaws-mcp/test/infrastructure/protocol/mcpServer-discovery.test.ts`;
- `sonar.projectVersion` em `biaws-mcp/sonar-project.properties.example` e a
  referência correspondente em `biaws-mcp/docs/releasing.md`;
- exemplos fixados como `biaws-mcp@<versao>` em `README.md`, `QUICKSTART.md` e
  `biaws-mcp/README.md`, se existirem;
- `MCP_PACKAGE_VERSION` em `biaws-cli/src/commands/agent.js`, pois o CLI grava
  uma referência npm exata na configuração dos agentes.

O script `biaws-mcp/scripts/verify-package.mjs` compara o manifesto, o lock e
`SERVER_VERSION`. O verificador de documentação
`scripts/check-documentation.mjs` compara as referências `biaws-mcp@...` com o
manifesto. O verificador do pacote CLI compara `MCP_PACKAGE_VERSION` com o
manifesto local do MCP. Esses scripts são verificadores: não mude suas regras
durante um bump normal.

O MCP também usa TypeScript estrito. `npm run release:check` verifica
formatação e tipagem, compila, executa os testes e verifica o pacote.
`npm pack` recompila pelo hook `prepack`; o tarball contém `dist/src` e
o bootstrap `bin/biaws-mcp.js`, sem fontes TypeScript, testes ou compilador.
O smoke do tarball usa o cliente oficial para verificar handshake e descoberta
nas duas eras do protocolo, conforme `biaws-mcp/docs/releasing.md`.

Execute:

```bash
cd biaws-mcp
npm ci
npm run release:check
npm audit --omit=dev --audit-level=high
cd ..
node scripts/check-documentation.mjs
cd biaws-cli
npm run release:check
```

O último comando é necessário mesmo sem alterar a versão do próprio CLI,
porque valida o acoplamento entre CLI e MCP. O dry-run oficial, que repete o
`release:check` e mostra o conteúdo do tarball, é:

```bash
./scripts/publish-biaws-mcp.sh
```

Antes de publicar, instale o tarball em um prefixo temporário e faça o
handshake descrito em `biaws-mcp/docs/releasing.md`. Publique o MCP antes de
publicar qualquer versão do CLI que o referencie:

```bash
./scripts/publish-biaws-mcp.sh --publish
```

O modo `--publish` exige autenticação npm, árvore Git limpa e uma versão ainda
inexistente no registry.

## CLI (`biaws-cli`)

Arquivos obrigatórios:

- `biaws-cli/package.json`;
- `biaws-cli/package-lock.json`, nas duas posições de versão do projeto.

O oclif lê a versão do próprio `package.json`, portanto não há outra constante
da versão do CLI para editar. Não confunda `MCP_PACKAGE_VERSION`, em
`biaws-cli/src/commands/agent.js`, com a versão do CLI: ela só muda quando muda
a versão do MCP instalada nos projetos.

A versão do CLI é independente da release da plataforma. Um bump do CLI não
faz uma instalação precisar de atualização. Setup e update usam `release.json`
da raiz selecionada por `--root`/`BIAWS_ROOT`; depois do sucesso, gravam sua
`version` em `BIAWS_VERSION` e seu conteúdo no snapshot da instância.
Não substitua manualmente `BIAWS_VERSION=unknown` em `.env.example`.

Valide o pacote e a instalação empacotada:

```bash
cd biaws-cli
npm ci
npm run release:check
npm audit --omit=dev --audit-level=high
cd ..
./scripts/publish-biaws-cli.sh
```

O CI também executa o tarball em Node.js 20.19 e 22, em Linux e macOS, e confere
`biaws/<versao>` na saída de `biaws --version`. O ensaio manual equivalente e o
exercício operacional de release estão em `biaws-cli/docs/releasing.md`.

Se a nova versão for implantar mudanças da plataforma, faça backup e atualize
uma instância de teste:

```bash
biaws admin instance update <instancia> --check --root "$PWD"
biaws admin instance update <instancia> --root "$PWD"
curl --fail --silent "http://127.0.0.1:<porta-api>/api/health"
```

Depois das validações e somente com a versão do MCP referenciada já disponível
no npm, publique com:

```bash
./scripts/publish-biaws-cli.sh --publish
```

## Executor (`biaws-monitor-executor`)

Arquivos obrigatórios:

- `biaws-monitor-executor/package.json`;
- `biaws-monitor-executor/package-lock.json`, nas duas posições de versão do
  projeto;
- `components.biaws-monitor-executor` em `release.json`.

Não há constante de versão no runtime nem teste com a versão do pacote. O
serviço local em `compose.yaml` é construído diretamente do checkout e não fixa
uma tag. O Compose de executores externos (`docker/monitoring.compose.yaml`)
recebe a imagem por `BIAWS_MONITOR_EXECUTOR_IMAGE`; portanto, quando a imagem for
publicada em um registry, construa e publique uma tag igual à nova versão e
atualize essa variável no ambiente de implantação. O repositório não contém
uma tag de registry fixa para alterar.

O helper `scripts/manage-monitoring-workspaces.sh` usa a tag local
`biaws-monitor-executor:<instancia>`, deliberadamente vinculada à instância e
não à versão do pacote. Não mude o script em um bump normal; execute `build`
para reconstruir a tag antes de reiniciar os executores.

Validação:

```bash
cd biaws-monitor-executor
npm ci
npm run format:check
npm run check
npm test
npm audit --omit=dev --audit-level=high
cd ..
docker compose --env-file instances/<instancia>/.env \
  --project-name biaws-<instancia> --profile active-monitoring \
  build monitor-executor
./scripts/manage-monitoring-workspaces.sh --instance <instancia> build
```

Para alterações que afetem a integração com a API, execute também os testes da
API com MongoDB e o smoke do profile `active-monitoring` documentado em
`docs/active-monitoring-operations.md`.

## Release com vários componentes

Quando uma mudança atravessar módulos, faça os bumps independentes necessários
na mesma alteração e valide todos os consumidores. A ordem recomendada é:

1. escolher as versões e atualizar `CHANGELOG.md`;
2. atualizar manifestos, locks, constantes, testes e exemplos descritos acima,
   incluindo `release.json` quando a instalação mudar;
3. executar `node scripts/check-documentation.mjs` e
   `node scripts/release-manifest.mjs check`;
4. executar as validações de cada componente alterado;
5. executar `npm run release:check` no MCP e no CLI se qualquer um deles ou o
   vínculo MCP/CLI tiver mudado;
6. executar o smoke de Compose quando API, UI, executor, bootstrap ou contratos
   entre componentes tiverem mudado;
7. publicar primeiro `biaws-mcp` e depois `biaws`;
8. publicar/taguear imagens privadas conforme o processo do ambiente e só então
   atualizar a instância.

O smoke completo usado pela CI parte de um checkout limpo, executa
`scripts/setup-local.sh`, verifica `/api/health` e a UI, sobe o profile
`active-monitoring` e consulta readiness e métricas do executor. Para mudanças
de release ou Compose, reproduza esse fluxo em uma instância descartável antes
do deploy.

## Checklist final

- [ ] manifesto de release sincronizado e revisão de implantação atualizada quando aplicável;
- [ ] `package.json`, `package-lock.json` e `packages[""]` têm a mesma versão;
- [ ] referências fixas encontradas por `rg` foram classificadas e atualizadas
      quando pertencem ao componente;
- [ ] versão do gerador OpenAPI e artefato regenerado acompanham o bump da API;
- [ ] `SERVER_VERSION`, testes de handshake/descoberta e documentação foram atualizados no
      bump do MCP;
- [ ] `MCP_PACKAGE_VERSION` aponta para uma versão do MCP que será publicada
      antes do CLI;
- [ ] `CHANGELOG.md` registra mudanças públicas e migrações;
- [ ] verificações do componente e `node scripts/check-documentation.mjs`
      passaram;
- [ ] tarballs públicos foram inspecionados com os scripts de dry-run;
- [ ] imagens foram reconstruídas e o smoke de Compose foi executado quando
      aplicável;
- [ ] a versão em `/api/health` e nos labels foi conferida para releases da
      plataforma;
- [ ] publicação e deploy foram feitos apenas depois dos testes, com rollback
      definido.
