# Docker e proxy da instância

MCP remoto é opt-in. O Compose normal continua sem serviço MCP e sem novas
credenciais. O overlay `compose.mcp.yaml`, perfil `mcp-http`, acrescenta o
serviço, segredo dedicado e replica set MongoDB de um membro exigido pelo
provider OAuth. Habilitar em instalação existente requer backup e uma atualização
planejada pelo operador; não executar sobre uma instalação sem essa decisão.

O CLI prepara a configuração. Para uso manual, crie um arquivo privado com
pelo menos 32 caracteres aleatórios e configure BIAWS_MCP_UID/BIAWS_MCP_GID
com os IDs do proprietário do arquivo (o CLI os configura), e
configure BIAWS_MCP_SERVICE_SECRET_PATH, BIAWS_MCP_HTTP_ENABLED=true,
BIAWS_PUBLIC_URL=https://sua-instancia.example,
BIAWS_MCP_PUBLIC_URL=https://sua-instancia.example/mcp,
BIAWS_PUBLIC_SCHEME=https, origens/cookies/trusted proxies existentes.
Não use chave de administrador como segredo do serviço.

```sh
docker compose -f compose.yaml -f compose.mcp.yaml --profile mcp-http --env-file CAMINHO config --quiet
docker compose -f compose.yaml -f compose.mcp.yaml --profile mcp-http --env-file CAMINHO up -d --build --wait
```

Termine TLS no proxy HTTPS do operador, encaminhando para a UI/Nginx; domínio
e certificado não são provisionados pelo projeto. A origem pública deve ser
coerente em todos os componentes. Nginx usa o esquema canônico configurado,
preserva Host e não confia no esquema enviado por um cliente arbitrário.
O proxy externo deve preservar Host e permitir respostas MCP por streaming.

MCP não publica porta no host, usa rede interna compartilhada somente com
API/proxy, não tem rede do MongoDB, volumes de domínio nem chave administrativa.
A API valida a delegação. A UI resolve o upstream MCP via DNS Docker em runtime,
por isso inicia sem MCP quando o perfil está ausente; /mcp responde 404.
Discovery é encaminhado à API, sem fallback SPA. Readiness falha se API cair;
shutdown cancela requisições e termina em até 10s. Desabilite o recurso sem
remover o replica set ou as chaves persistidas; rollback físico de Mongo exige
procedimento próprio e backup.

Para testes locais isolados pode-se usar HTTP em loopback. Nunca declare esse
teste como evidência de acessibilidade pública ou de uma conexão ChatGPT real.
