# Operação, atualização e recuperação

Este runbook cobre a implantação Docker Compose suportada para avaliação e
ambientes pequenos. O projeto continua em estágio alpha: faça backup antes de
toda atualização e não use dados críticos sem definir armazenamento externo,
monitoramento e uma política própria de recuperação.

## Selecionar uma instância

Instâncias criadas pelo setup ficam em `instances/<nome>`. Para executar
as operações comuns, use os scripts gerados para a instância:

```bash
instances/meu-projeto/start.sh
instances/meu-projeto/stop.sh
instances/meu-projeto/backup-mongo.sh
instances/meu-projeto/restore-mongo.sh backups/biaws-<data>.archive.gz
```

O primeiro executa `up -d --wait`; o segundo executa `stop` e preserva
containers, volumes e bind mounts. Argumentos adicionais são encaminhados ao
comando Compose, por exemplo `instances/meu-projeto/start.sh --build`.
Os dois últimos executam o backup lógico e o restore do MongoDB no container da
instância correta.

Cada instância executa um container MongoDB próprio. `MONGO_PORT`, no `.env`,
define apenas a porta publicada no host; a comunicação entre API e MongoDB usa
sempre `mongo:27017` na rede interna do Compose. O setup reserva portas externas
distintas para impedir colisões entre instâncias.

Para outros comandos Compose, informe sempre o arquivo e o projeto
correspondentes:

```bash
docker compose \
  --env-file instances/meu-projeto/.env \
  --project-name biaws-meu-projeto \
  ps
```

Nos exemplos abaixo, substitua `docker compose` por esse prefixo quando estiver
operando uma instância nomeada. Isso impede comandos acidentais contra volumes
de outra instância.

## Componentes persistentes

Uma recuperação completa depende de dois conjuntos de dados:

- MongoDB: identidades, sessões, autorizações, catálogo, conhecimento e
  auditoria;
- volumes de anexos: `issue-files`, `request-files` e `procedure-files`;
- cofre local: `secret-files`, contendo apenas versões criptografadas;
- chave mestra do cofre: `.secrets-master-key`, mantida fora do volume.

O backup do banco sem os volumes, ou dos volumes sem o banco, é incompleto.
Pause escritas durante a cópia para manter referências e arquivos consistentes.
O cofre sem sua chave mestra é irrecuperável; cofre e chave devem ser copiados
para destinos protegidos diferentes.

Por padrão, o Compose cria volumes nomeados gerenciados pelo Docker. Instâncias
configuradas com `--storage-dir` ou com as opções específicas do setup usam bind
mounts e registram estes caminhos em `instances/<nome>/.env`:

```text
BIAWS_MONGO_DATA_PATH=/srv/biaws/meu-projeto/mongo
BIAWS_ISSUE_FILES_PATH=/srv/biaws/meu-projeto/issues
BIAWS_REQUEST_FILES_PATH=/srv/biaws/meu-projeto/requests
BIAWS_DOCUMENT_FILES_PATH=/srv/biaws/meu-projeto/documents
BIAWS_SECRET_FILES_PATH=/srv/biaws/meu-projeto/secrets
BIAWS_SECRETS_KEY_PATH=/srv/keys/biaws-meu-projeto.key
```

Use `docker compose config` para confirmar os mounts efetivos antes de iniciar
uma instância importante. Caminhos vazios selecionam os volumes nomeados.

## Backup do MongoDB

O script gerado cria um arquivo compactado com timestamp e seu checksum
SHA-256. Sem argumento, o destino é `instances/<nome>/backups`; para usar outro
diretório, informe-o como primeiro argumento:

```bash
instances/meu-projeto/backup-mongo.sh
instances/meu-projeto/backup-mongo.sh /srv/backups/biaws
```

O container `mongo` precisa estar ativo. Se o dump falhar, o arquivo temporário
é removido e não é publicado como backup válido.

O equivalente manual é:

Crie um diretório protegido e registre checksums:

```bash
mkdir -p backups
docker compose exec -T mongo mongodump \
  --db=biaws \
  --archive \
  --gzip > backups/biaws.archive.gz
shasum -a 256 backups/biaws.archive.gz
```

Copie os volumes de anexos com a ferramenta de snapshot do seu ambiente. Em
Docker local, uma opção explícita por volume é:

```bash
docker run --rm \
  --volume biaws_issue-files:/source:ro \
  --volume "$PWD/backups:/backup" \
  alpine tar -C /source -czf /backup/issue-files.tar.gz .
```

Repita para `biaws_request-files`, `biaws_procedure-files` e
`biaws_secret-files`. O prefixo dos
volumes acompanha `COMPOSE_PROJECT_NAME`; confirme os nomes com
`docker volume ls` antes de executar.

Quando a instância usa bind mounts, copie ou tire snapshot dos cinco diretórios
informados no `.env`, preservando permissões, timestamps e checksums. O
`mongodump` continua recomendado para uma cópia lógica e portável do banco;
copiar apenas o diretório físico do MongoDB enquanto ele está ativo não produz
um backup consistente.

Guarde banco, volumes, checksums, versão da aplicação e `.env` sanitizado no
mesmo conjunto de recuperação. Preserve a chave do cofre em outro sistema de
backup, com controle de acesso próprio. Nunca versione segredos, a chave mestra
ou a senha inicial.

## Restauração ensaiada

Para restaurar na própria instância, use o script gerado:

```bash
instances/meu-projeto/restore-mongo.sh \
  instances/meu-projeto/backups/biaws-<data>.archive.gz
```

Quando o arquivo `.sha256` correspondente existir, o script valida sua
integridade. Em seguida, solicita o nome da instância antes de executar o
restore com `--drop`. Em execução não interativa, `--yes` é obrigatório; ele
deve ser usado apenas quando a automação tiver uma confirmação externa.

Para um ensaio isolado, restaure primeiro em um projeto e banco separados:

```bash
COMPOSE_PROJECT_NAME=biaws-restore-test docker compose up -d mongo
docker compose exec -T mongo mongorestore \
  --archive \
  --gzip \
  --drop < backups/biaws.archive.gz
```

Restaure os quatro volumes correspondentes, disponibilize separadamente a
chave mestra correta do cofre, suba API e UI e valide:

1. `GET /api/health`;
2. login de um administrador;
3. leitura de uma aplicação, issue, melhoria e procedimento;
4. download de pelo menos um anexo de cada domínio utilizado;
5. isolamento por workspace e aplicação;
6. totais e registros recentes de auditoria.
7. leitura de metadata e reveal controlado de um segredo de teste, quando o
   cofre estiver em uso.

Só substitua o ambiente original após essa validação. Um backup não ensaiado
não deve ser tratado como recuperação garantida.

## Atualização

Sequência recomendada:

1. publique uma janela sem escritas;
2. faça backup do MongoDB e dos volumes;
3. revise `CHANGELOG.md`;
4. construa as novas imagens;
5. suba os serviços e execute o smoke test;
6. mantenha o backup até o fim da janela de observação.

```bash
docker compose stop ui api
docker compose build
docker compose up -d
curl --fail http://127.0.0.1:3100/api/health
```

## Rollback

Se apenas o código falhar, volte às imagens anteriores e preserve os campos
novos: leitores antigos os ignoram. Não tente remover manualmente IDs de
workspace, aplicação ou topologia.

Se os dados forem alterados incorretamente:

1. interrompa API e UI;
2. restaure MongoDB e volumes em um ambiente separado;
3. valide referências e anexos;
4. altere a configuração para o conjunto restaurado;
5. mantenha o conjunto com falha isolado para diagnóstico.

Não use `mongorestore --drop` contra o banco original sem um backup verificado
e uma janela de indisponibilidade aprovada.

## Limites operacionais

- páginas HTTP: 25 itens por padrão e no máximo 100;
- contexto agregado de aplicação: no máximo 100 itens por coleção;
- auditoria por consulta: no máximo 200 eventos;
- escopo de um grupo: no máximo 250 aplicações;
- JSON: 4 MiB por padrão;
- anexo: 50 MiB por padrão;
- metadata de runtime: 16 KiB, 25 chaves e sem campos com semântica de segredo.
- sinais de monitoramento: páginas de até 100; retenção por runtime com padrão
  de 10 dias e índice TTL sobre `expiresAt`. Use `monitoringRetentionDays: 0`
  somente quando houver necessidade explícita de histórico permanente.

O rate limiting possui três camadas independentes:

- rotas protegidas: 300 requisições por 60 segundos por usuário ou API key,
  persistidas no MongoDB na coleção `apiRateLimits`;
- endpoints do Better Auth: 100 requisições por 10 segundos por IP e rota,
  além das regras mais restritivas do próprio Better Auth para login e troca de
  senha;
- API keys: 1.000 requisições por 3.600 segundos por chave, persistidas no
  documento da própria chave.

Os valores são defaults e podem ser alterados pelas variáveis
`ISSUE_API_RATE_LIMIT_*`, `BETTER_AUTH_RATE_LIMIT_*` e
`ISSUE_API_KEY_RATE_LIMIT_*` documentadas no `.env.example`. O setup aceita as
opções equivalentes `--api-rate-limit-*`, `--auth-rate-limit-*` e
`--api-key-rate-limit-*`. Ao executar o bootstrap, uma chave técnica válida é
preservada, sua cota é reconciliada com a configuração atual e a janela de
consumo é reiniciada.

Melhorias, issues, procedimentos e catálogo têm paginação no backend. A UI de
melhorias carrega 25 registros por página. Ajuste os limites de corpo/anexo pelas
variáveis documentadas em `.env.example`, considerando memória, proxy e storage.
No ambiente Docker, `ISSUE_API_MAX_ATTACHMENT_BYTES` configura o mesmo limite
na API e no Nginx; mantenha o proxy externo alinhado quando houver outra camada.

Para um smoke test do receptor passivo, envie um sinal com `signalId` exclusivo,
repita o mesmo envio e confirme respostas `201` e `200` com `created: false`.
Depois, consulte `monitoring signals <runtime-uuid-ou-caminho>` e a área
Monitoramento na UI.

## Logs e correlação

O executor ativo emite logs JSON separados com `service` igual a
`biaws-monitor-executor`. Os eventos incluem IDs do monitor e da execução,
atraso, retry e perda de lease, mas não incluem a configuração recebida nem a
evidência produzida. Consulte `/metrics` e `/health/ready` na porta interna
`3110` para distinguir indisponibilidade da API, atraso e falha do provider.

Quando o executor for escalado, cada réplica deve possuir
`BIAWS_MONITOR_EXECUTOR_ID` distinto (hostname e PID são usados por padrão).
Dimensione também a cota da chave técnica para a soma de polls, renovações e
publicações de todas as réplicas; respostas `429` acionam backoff, mas uma cota
permanentemente inferior à carga mantém a readiness indisponível.
Para pausar aquisições, defina `BIAWS_MONITOR_EXECUTOR_ENABLED=false` e recrie
somente o serviço. Para rollback, remova o profile ou reduza as réplicas a zero;
os leases em andamento expiram na API e podem ser retomados posteriormente sem
remover configurações ou histórico.

Antes de habilitar providers, configure as políticas locais documentadas em
`biaws-monitor-executor/README.md`. Hosts REST e scripts shell não declarados são
recusados. Monte o diretório de scripts como somente leitura e execute o
container sem privilégios adicionais; segredos entram apenas pelas variáveis
mapeadas em `BIAWS_MONITOR_REFERENCE_ENV_MAP`, nunca na configuração do monitor.

A API emite um objeto JSON por linha. Eventos de ciclo de vida usam
`server_started` e `server_shutdown_*`; cada chamada não relacionada ao health
check gera `http_request_completed` com método, caminho sem query string, grupo
da rota, status, duração, tamanho da resposta e, quando autenticada, IDs do ator
e workspace.

Erros funcionais `4xx` geram `http_request_rejected`. Falhas inesperadas geram
`http_request_failed`, incluindo stack e causas somente no log da API. A
resposta `500` não contém esses detalhes: use o `requestId` retornado no corpo e
no header `X-Request-Id` para localizar o evento correspondente.

Os logs de acesso não incluem body, query string, cookies, chaves, tokens ou
e-mail. Trate os IDs, caminhos e detalhes internos dos erros como dados
operacionais e aplique controle de acesso e retenção ao coletor de logs.
Health checks são omitidos por padrão; defina
`ISSUE_API_LOG_HEALTH_REQUESTS=true` somente quando precisar diagnosticá-los.

Em chamadas distribuídas, encaminhe um `X-Request-Id` com até 128 caracteres
alfanuméricos ou os sinais `.`, `_`, `:` e `-`. Valores ausentes ou inválidos
são substituídos por um UUID.

## Anexos

O provider `local` valida chaves contra traversal e aplica autorização antes da
leitura. Os metadados persistem o contexto de workspace/aplicação, mas os
caminhos físicos legados ainda não possuem esse namespace. Para múltiplas
réplicas, substitua o provider local por object storage antes de escalar.

Após restauração ou movimentação, compare uma amostra de checksums e confirme
que nenhum arquivo é acessível a partir de outro workspace.

## Auditoria

Eventos são sanitizados, limitados em profundidade, comprimento e quantidade de
itens. Senhas, tokens, conteúdo binário e campos operacionais não são gravados
como diferenças. A escrita ainda é síncrona e não transacional com a mutação de
domínio; monitore divergências e volume da coleção `auditEvents`.

Não existe retenção automática para auditoria funcional. Defina retenção,
exportação e requisitos legais antes de uso prolongado.

## Diagnóstico rápido

`agent doctor` informa falha de autenticação

: execute `./scripts/bootstrap.sh` para validar ou recriar a chave técnica e
depois repita `node biaws-cli/src/index.js agent doctor codex|claude --project
<diretório>`. A chave possui validade definida pela política de autenticação e
é mantida somente no `.env` local.

`WORKSPACE_REQUIRED`

: envie `X-Biaws-Workspace-Id` quando a identidade tiver acesso a mais de um
workspace. No MCP, execute novamente `./scripts/configure.sh --client
codex|claude --project <diretório> --env-file <arquivo-local> --workspace
id-do-workspace` para gravar a seleção na configuração local do projeto. Em
execuções diretas do CLI, use `--workspace` ou `ISSUE_WORKSPACE_ID`.

`WORKSPACE_FORBIDDEN` ou recurso não encontrado

: confirme o workspace selecionado, os grupos ativos e o escopo de aplicações.
Recursos fora do escopo retornam `404` para evitar enumeração.

`agent doctor` informa falha em `configuration`

: reaplique `./scripts/configure.sh --client codex|claude --project <diretório>
--env-file <arquivo-local> --workspace id-do-workspace`. Use `--force` somente
para substituir uma configuração `biaws` anterior que não era gerenciada pelo
CLI. Instalações antigas podem conter `ISSUE_WORKSPACE_ID` no `.env` da
instância; `setup-server.sh` remove essa variável legada.

Login funciona, mas a UI perde a sessão

: alinhe `BIAWS_PUBLIC_URL`, `BIAWS_TRUSTED_ORIGINS`, protocolo e host. Cookies
seguros exigem HTTPS fora do ambiente local. Defina
`BETTER_AUTH_SECURE_COOKIES=true` quando `BIAWS_PUBLIC_URL` usar HTTPS; o
Compose usa `false` somente como padrão explícito para localhost.

Rate limit informa que não encontrou o IP

: publique a API atrás de um proxy que sobrescreva `X-Forwarded-For` e restrinja
acesso direto ao origin. O Nginx incluído já envia esse header. Não aceite
headers encaminhados diretamente de clientes não confiáveis.

Seed falha ou encontra conflito

: execute `npm run seed:demo` novamente. Ele é idempotente e sempre cria listas,
taxonomia e coleções dentro do workspace padrão. Conflitos manuais de chaves
devem ser resolvidos sem excluir dados existentes.

API não inicia

: verifique `docker compose logs api`, acesso de escrita aos volumes,
`BETTER_AUTH_SECRET` com ao menos 32 caracteres e conectividade com MongoDB.

Anexo existe no MongoDB, mas não abre

: confirme o volume correto, o provider configurado e a presença da chave
física. Não altere manualmente a chave armazenada no documento.

Consulta ficou lenta

: use o roteiro de [índices e planos de consulta](performance.md), registre
`totalDocsExamined`, `totalKeysExamined`, `nReturned` e o índice vencedor antes
de adicionar novos índices.
