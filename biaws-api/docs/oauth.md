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

Encaminhe ao auth handler os endpoints RFC de `/.well-known/`, incluindo as
variantes com path de issuer/resource, além de `/api/auth/*`. O proxy deve
preservar origem/protocolo públicos e não devolver o HTML da SPA para discovery.

Não armazenar chaves/tokens no plugin. O banco persistido pertence ao backup
protegido da instância; restaurar em outra URL/issuer exige nova vinculação.

Contrato e limites: [arquitetura](../../docs/chatgpt-architecture.md) e
[distribuição](../../docs/chatgpt-distribution.md).
