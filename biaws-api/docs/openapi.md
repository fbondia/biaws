# OpenAPI da API

`npm run openapi:generate` gera `openapi/openapi.json` de modo determinístico a
partir do inventário dos routers e dos contratos Zod em `src/contracts`. O mesmo
gerador alimenta `GET /api/openapi.json`, que é público e somente leitura quando
a documentação está ativa. Execute
`npm run openapi:check` para conferir o artefato versionado; o CI também executa
essa checagem. O teste `test/contracts/openapi.test.ts` compara as operações com o
inventário independente de T01, exige `operationId` único e resolve referências.

O documento usa OpenAPI 3.1 e `@asteasolutions/zod-to-openapi` 8.5.0. Organiza
operações por domínio e descreve sessão Better Auth (`biaws.session_token`) ou
chave `Authorization: Bearer biaws_...`. `X-Biaws-Workspace-Id` é informado nas
operações que podem requerer seleção de workspace; a regra real depende da
identidade e é aplicada pelo middleware. Permissões por operação/campo, limite de
requisições e regras de domínio continuam sob responsabilidade da API. As rotas
`/api/auth/*` são delegadas ao Better Auth e estão documentadas em
`docs/authentication.md`, sem serem representadas como operações BIAWS estáticas.

Uploads multipart e downloads binários são descritos por tipo de conteúdo.
Schemas Zod com transformação mostram a entrada no OpenAPI; as saídas públicas
têm schemas próprios. O gerador não suporta a recursão de `z.json()` usada para
verificar respostas genéricas em testes; o documento usa um objeto aberto nesses
casos. Refinamentos de banco, enums configuráveis, tenancy e autorização não
cabem integralmente em um schema estático. Os handlers continuam sendo a fonte
para status condicionais como importação EML e criação de versões.

O documento não contém credenciais nem exemplos com dados reais. Consultar a
documentação não autentica a operação; chamadas interativas seguem os mesmos
controles das chamadas HTTP comuns.

## Swagger UI

Abra `/api/docs/` para navegar por domínio, pesquisar operações, inspecionar
schemas e usar **Try it out**. A página e os assets são servidos pela própria API,
sem CDN. O link relativo `../openapi.json` acompanha o prefixo público configurado
no proxy; a página carrega o mesmo documento do endpoint JSON. O validador externo
fica desativado. A interface não persiste credenciais entre recargas.

`BIAWS_API_DOCS_ENABLED=true|false` controla a página e o JSON juntos. O padrão é
ativo fora de `NODE_ENV=production` e inativo em produção; habilite explicitamente
quando desejar publicar a documentação. As rotas de documentação são públicas e
somente leitura. Para operações protegidas, autentique-se pelo login Better Auth
na mesma origem (cookie de sessão) ou informe uma chave de API no botão
**Authorize**. Informe `X-Biaws-Workspace-Id` quando sua identidade acessa mais de
um workspace. **Try it out executa chamadas reais, inclusive mutações**; os
mesmos controles de autenticação, permissão, escopo, limites e auditoria da API
continuam valendo.
