# Autorização por workspace e aplicação

## Modelo

Identidade continua sob responsabilidade do Better Auth. O Bondia Workspaces
mantém grupos de negócio e vínculos separados:

- `permissionGroups.workspaceId`: workspace proprietário do grupo;
- `permissionGroups.scope.type`: `workspace` ou `applications`;
- `permissionGroups.scope.applicationIds`: aplicações explícitas quando o tipo
  for `applications`;
- `workspaceMemberships`: um vínculo por `{ userId, workspaceId }`, com os grupos daquele
  workspace.

O modelo atual de grupos permanece suficiente. Separar identidade, roles e role
bindings adicionaria entidades sem eliminar duplicação relevante neste estágio:
o documento `workspaceMemberships` já funciona como binding e o grupo já representa a
role. Essa decisão deve ser reavaliada se surgirem grupos reutilizáveis entre
workspaces, deny rules ou delegação administrativa.

Permissões são classificadas como:

- `workspace`: somente grupos com alcance integral podem concedê-las;
- `application`: podem ser limitadas a aplicações;
- `hybrid`: procedimentos e documentos gerais exigem alcance de workspace,
  enquanto os associados respeitam o conjunto de aplicações.

`servers.read` permanece uma permissão de workspace. Por isso hostname e
endereços não receberam uma permissão adicional nesta fase: grupos limitados a
aplicações não podem consultar servidores.

## Seleção do workspace

Clientes enviam:

```http
X-Biaws-Workspace-Id: <workspace-id>
```

O cabeçalho pode ser omitido quando o ator possui exatamente um workspace. Com
mais de um, rotas protegidas retornam `400 WORKSPACE_REQUIRED`. Um workspace sem
vínculo retorna `403 WORKSPACE_FORBIDDEN`.

O ator de `GET /api/auth/me` contém `workspaceId`, `workspaces`,
`permissionScopes`, grupos e permissões do workspace corrente. A UI persiste a
seleção localmente; MCP e CLI usam `ISSUE_WORKSPACE_ID`.

Filtros de query, body ou argumentos MCP nunca são usados como prova de acesso.
O servidor substitui o workspace pelo contexto autenticado e intersecta
aplicações solicitadas com o escopo da permissão. Recursos fora do escopo
retornam `404`, evitando enumeração por ID.

## Política de isolamento

- listas, agregações e consultas por ID incluem o workspace resolvido;
- permissões funcionais e escopo de aplicação são avaliados em conjunto;
- anexos consultam primeiro a entidade raiz no escopo;
- auditoria filtra `metadata.workspaceId` e `metadata.applicationId`;
- configurações de workspace — taxonomia, listas de opções, coleções de
  procedimentos e skills — possuem chave composta por workspace;
- a API é a autoridade; controles da UI servem apenas para apresentação.

## Administração global

A role técnica `admin` recebe capacidades de plataforma separadas das permissões
de negócio: `platform.workspaces.manage` e `platform.audit.read`. Elas autorizam
somente as rotas `/api/platform/*`, que não exigem um workspace corrente. Ser
administrador global não concede acesso automático a chamados, melhorias ou
outros dados operacionais dos workspaces.

A criação global provisiona os grupos de sistema do novo workspace e associa um
administrador inicial. Grupos recebem identidades próprias por workspace. O
workspace padrão não pode ser arquivado e o último administrador local não pode
ser removido nem perder o grupo de Administração.
