# MCP HTTP

## Executar

`npm run start:http` ou `biaws-mcp-http` inicia a entrada HTTP. `biaws-mcp`
continua usando stdio. Configure uma URL pública HTTPS terminando no caminho
do recurso (normalmente `/mcp`), a URL interna da API e um segredo dedicado do
serviço compartilhado com o endpoint de delegação da API.

Variáveis:

- `BIAWS_MCP_PUBLIC_URL`: recurso público (default loopback apenas para desenvolvimento).
- `BETTER_AUTH_URL` ou `BIAWS_PUBLIC_URL`: origem pública do issuer.
- `BIAWS_API_URL`: API interna; não recebe URL de argumentos de tools.
- `BIAWS_MCP_SERVICE_SECRET_FILE`: arquivo privado preferencial para o segredo
  do serviço; `BIAWS_MCP_SERVICE_SECRET` é alternativa de ambiente privado.
- `BIAWS_MCP_HTTP_HOST` / `BIAWS_MCP_HTTP_PORT`: default `127.0.0.1:3120`.
- `BIAWS_MCP_MAX_REQUEST_BYTES`: default 16 MiB, teto 64 MiB.
- `BIAWS_MCP_MAX_IN_FLIGHT`: default 32, teto 256.
- `BIAWS_MCP_REQUESTS_PER_MINUTE`: default 600 por endereço de conexão.

O limite por endereço usa o peer de rede, sem confiar em X-Forwarded-For;
clientes atrás do mesmo proxy compartilham esse limite. A API mantém suas
próprias verificações e limites por identidade.

O servidor usa `createMcpHandler` do SDK 2.2.0 e o adapter Node oficial 2.0.0
(versionado separadamente, com peer compatível). Atende a era 2025 via fallback
stateless e 2026-07-28. GET/DELETE do recurso respondem 405; nenhuma sessão MCP
ou Redis é necessária. Host e Origin são validados; Origin ausente é permitido
para clientes de servidor. O proxy deve preservar o Host público e streaming.

Sem token, POST responde 401 com `WWW-Authenticate` apontando para discovery.
A validação do token e a emissão da credencial delegada são feitas pelo servidor
de autorização da própria instância em `/api/auth/mcp/delegate`. Somente essa
credencial interna entra no contexto das operações de domínio.

`/health/live` confirma o processo; `/health/ready` verifica a API. SIGINT e
SIGTERM cancelam operações e encerram conexões com limite de cinco segundos.
Health não comprova que um usuário tem acesso a um workspace.

## Validação HTTP

`npm test -- infrastructure/http` cobre protocolo, autenticação, identidade e
negações. Para testar sockets/adapter Node em portas locais descartáveis:
`BIAWS_MCP_HTTP_INTEGRATION=1 node --test dist/test/infrastructure/http/httpNodeServerIntegration.test.js`.

## Contexto de identidade

O modo HTTP exige um contexto autenticado por requisição com token delegado
da API e workspace. `runWithRequestContext` preserva essa identidade em
contextos aninhados de tools, logs e cancelamento; o AsyncLocalStorage isola
requisições concorrentes. Tokens não são colocados em process.env nem logs.

O cliente HTTP, o índice de resources e os resource links consultam a mesma
identidade. Sem ela, uma requisição marcada como HTTP falha com
`MCP_HTTP_UNAUTHENTICATED`, sem aproveitar credenciais locais de stdio.

No modo stdio dedicado, `BIAWS_API_KEY` e `BIAWS_WORKSPACE_ID` continuam sendo
o fallback de configuração. A URL interna da API é configuração do serviço,
não um argumento de tool ou uma preferência de usuário remoto.

Teste de concorrência: `npm test -- infrastructure/http` dentro de `biaws-mcp`.
O teste intercala duas identidades e confere headers, resources, links,
contexto aninhado e ausência de vazamento após concluir a chamada.
