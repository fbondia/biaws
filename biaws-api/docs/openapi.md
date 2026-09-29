# OpenAPI da API

`npm run openapi:generate` gera `openapi/openapi.json` de modo determinístico a
partir do inventário dos routers e dos contratos Zod em `src/contracts`. O mesmo
gerador alimenta `GET /api/openapi.json`, que é público e somente leitura. Execute
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
