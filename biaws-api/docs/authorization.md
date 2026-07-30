# Autorização por permissões

A autenticação resolve sessão ou chave de API e cria `req.actor`. Um middleware
separado verifica as permissões efetivas calculadas a partir dos grupos ativos.
Ausência ou invalidade de credencial retorna `401`; identidade válida sem
permissão retorna `403` com código `FORBIDDEN` e `requiredPermissions`.

As permissões são globais nesta versão. A assinatura interna trabalha com o ator
e pode receber contexto de recurso futuramente, sem alterar o catálogo.

## Catálogo operacional

Workspace, aplicações, componentes, repositórios, servidores, deployments e
runtimes usam permissões separadas por domínio e operação: `read`, `create`,
`update` e `archive`. Workspaces continuam limitados a `read` e `manage`, sem
criação pública de outro workspace.

Consultas reversas exigem as permissões de leitura de todos os tipos retornados.
O contexto agregado de aplicação exige simultaneamente `applications.read`,
`components.read`, `repositories.read`, `servers.read`, `deployments.read` e
`runtimes.read`. Validação de pertencimento ocorre no backend, inclusive em
consultas por ID; filtros do cliente não constituem autorização.

O grupo de sistema `administration` é sincronizado com todo o catálogo canônico
quando o repositório de acesso é inicializado. Grupos de sistema dos demais
domínios e grupos customizados não recebem permissões novas implicitamente.

## Regras por campo

- `PATCH /api/issues/:id`: `status` exige `issues.status.update`; `type` e
  quaisquer campos gerais exigem `issues.update`. Um payload misto exige ambas.
- `PUT /api/requests/:id`: `specification` exige
  `demands.specification.update`; demais campos presentes exigem
  `demands.update`.
- `PUT /api/requests/:id/tasks/:taskId`: `status` exige
  `tasks.status.update`; demais campos presentes exigem `tasks.update`.
- payloads completos exigem a união das permissões representadas por seus
  campos; clientes com permissão limitada devem enviar somente os campos que
  pretendem alterar.
- anexos possuem verificações independentes para leitura, criação, alteração de
  tags e exclusão.

Parâmetros `db` e `database` são recusados em rotas autenticadas de domínio e
administração. O banco passa a ser exclusivamente uma configuração do servidor.

## Administração de identidade

As telas usam `/api/identity/*`, que verifica permissões do workspace antes de chamar as
APIs server-side do Better Auth. O próprio componente continua exigindo a role
técnica `admin` para operações administrativas de identidade; portanto, essas
operações exigem simultaneamente a permissão do workspace correspondente e a role
técnica. Grupos e vínculos do workspace usam somente `roles.*` e `users.*`.

As rotas originais `/api/auth/admin/*` também recebem uma barreira do workspace por
operação, evitando contorno da fachada. As próprias chaves exigem
`api_keys.manage.self`; propriedade e ciclo de vida continuam validados pelo
plugin.

Para outros usuários, a administração expõe somente a revogação de todas as
sessões por `users.update`, usando `revokeUserSessions` do Better Auth. Tokens de
sessão nunca são listados na fachada. A gestão de chaves de terceiros não é
exposta nesta versão: `api_keys.manage.all` permanece reservada até existir uma
operação administrativa do plugin que preserve claramente o escopo por
proprietário, sem acesso ao segredo ou ao hash.

## Bootstrap e recuperação

Execute novamente `npm run bootstrap:admin` com as variáveis de bootstrap. Se um
administrador técnico ativo já existir, nenhuma identidade é criada, mas seu
vínculo com o grupo de sistema `administration` é restaurado. Se não existir, a
identidade e o vínculo são criados. O comando é local, não expõe rota HTTP e
continua idempotente.

Esse procedimento deve ser executado antes de implantar a Fase 4 em uma base
existente, para evitar que o administrador técnico possua sessão válida mas
nenhuma permissão do workspace.

## Clientes e UI

A UI oculta áreas sem permissão de leitura, limita as ações administrativas e
de chaves e desabilita alterações rápidas de issues incompatíveis com o ator.
Uma resposta `403` continua sendo tratada como autoridade final e informa as
permissões ausentes. MCP e CLI preservam `401` como `UNAUTHENTICATED` e `403`
como `FORBIDDEN`.
