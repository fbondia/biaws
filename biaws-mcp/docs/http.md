# MCP HTTP

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
