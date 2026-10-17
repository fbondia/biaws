# OAuth para MCP

O provider fica desabilitado por padrão. Habilite `BIAWS_MCP_HTTP_ENABLED=true`
somente após preparar MongoDB como replica set (ou mongos). A inicialização
recusa standalone e aquece os índices do adapter antes de atender requisições
transacionais. Isso é uma alteração de provisionamento, não uma conversão
automática de instalações existentes.

`BETTER_AUTH_URL` define a origem pública de autenticação. O issuer é
`<origem>/api/auth` e `BIAWS_MCP_PUBLIC_URL` define o recurso protegido, com
default `<origem>/mcp`. As URLs exigem HTTPS, exceto loopback de desenvolvimento,
e não aceitam credenciais, query ou fragmento. Configure-as explicitamente
quando UI, API e MCP tiverem origens diferentes.

A composição usa JWT, MCP provider e CIMD fixados na versão 1.7.6. O provider
usa códigos com PKCE, consentimento, refresh com replay estrito e persistência
de chaves. DCR e grants de máquina estão desabilitados. O endpoint de JWT de
sessão `/token` também fica desabilitado. Os scopes são `mcp:read`, `mcp:write`
e `offline_access`; essa lista não substitui a autorização por domínio.

Cada fluxo usa uma concessão própria em `oauthGrants`, vinculada a usuário,
sessão de origem, cliente e parâmetros OAuth (incluindo state e PKCE). A
escolha de workspace não fica em uma variável global nem no workspace atual
do navegador. Concessões preparadas expiram em dez minutos; a primeira emissão
de token fixa a autorização. Uma concessão já usada não pode trocar workspace.

Os tokens recebem `biaws_grant_id` e `biaws_workspace_id` somente após o
provider validar sua continuação assinada e consentimento. Renovação revalida a
concessão e as permissões atuais. A API limita os scopes às permissões atuais,
remove permissões de plataforma e mantém `oauth-delegated` distinto de sessão.
Leitura não concede escrita; OAuth não permite revelar valores de segredos.
O ator de auditoria mantém usuário, método e identificadores de cliente/concessão.

## Credencial de domínio delegada

`POST /api/auth/mcp/delegate` recebe `subject_token` e exige um segredo próprio
do serviço no header `X-Biaws-Mcp-Service-Secret`. Configure-o por
`BIAWS_MCP_SERVICE_SECRET_FILE` (preferível) ou ambiente privado
`BIAWS_MCP_SERVICE_SECRET`, com pelo menos 32 caracteres. Não reutilize a chave
mestra nem uma API key administrativa. O endpoint é uma ponte interna e não um
grant OAuth de máquina exposto ao ChatGPT.

O provider valida o token externo; a ponte verifica audience, scopes,
usuário/cliente/workspace e concessão ativa. Retorna uma credencial opaca
`biaws_dlg_*`, distinta do token OAuth, válida por no máximo 60 segundos e nunca
além da expiração original. Somente o hash fica no banco, com índice TTL.

As rotas de domínio aceitam essa credencial, revalidando concessão, usuário e
permissões a cada chamada. Um workspace diferente no header é rejeitado. O
access token destinado ao MCP não é uma credencial das rotas de domínio.
Revogar a concessão invalida também credenciais internas ainda não expiradas.

Encaminhe ao auth handler os endpoints RFC de `/.well-known/`, incluindo as
variantes com path de issuer/resource, além de `/api/auth/*`. O proxy deve
preservar origem/protocolo públicos e não devolver o HTML da SPA para discovery.

Não armazenar chaves/tokens no plugin. O banco persistido pertence ao backup
protegido da instância; restaurar em outra URL/issuer exige nova vinculação.

Contrato e limites: [arquitetura](../../docs/chatgpt-architecture.md) e
[distribuição](../../docs/chatgpt-distribution.md).
