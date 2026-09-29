# Contratos HTTP da API

`src/contracts/routers.ts` associa os 16 routers protegidos aos prefixos públicos.
`collectRouteContracts` cria um contrato Zod para cada uma das 245 operações,
identificadas por método e caminho. Cada contrato contém `params`, `query`, `body`
e `response`. Os parâmetros são extraídos dos segmentos `:nome` do caminho.

A validação de entrada roda no último handler da rota, depois dos middlewares de
autorização. O corpo já normalizado por Zod segue para o handler. Erros Zod de
`query` retornam 400; erros de `params` e `body` retornam 422, com `code` público
`BAD_REQUEST` e uma lista limitada a caminho, código e mensagem. O schema de
criação de issue mantém a coerção legada de título e texto e a mesma mensagem para
campos obrigatórios. Operações sem regra de transporte estável usam um objeto
aberto, para preservar campos desconhecidos, `null`, strings vazias e enums
configurados pelo workspace.

A normalização compartilhada de texto preserva valores escalares, datas e IDs
MongoDB, além das listas já aceitas pelos filtros legados. Objetos sem uma
representação textual de domínio são rejeitados com 422, em vez de gravar ou
consultar o texto `[object Object]`. Na criação de issues, essa rejeição mantém
o formato Zod de erro por campo. Schemas abertos preservam os campos adicionais
da API.

Os tipos `IssueCreateInput` e `IssueCreateOutput` mostram a diferença entre o
payload recebido e os campos transformados. Os demais contratos seguem o mesmo
padrão conforme as regras forem extraídas das normalizações legadas. Regras que
dependem de MongoDB, autorização, tenancy, unicidade, opções dinâmicas ou estado
anterior continuam nos repositories e services. Refinamentos desse tipo não são
representáveis integralmente por um schema estático ou por OpenAPI.

Respostas não são revalidadas em produção, evitando custo e alteração da resposta
após efeitos de escrita. Os testes validam respostas reais de issues e a projeção
pública de segredos. O schema de segredos é estrito e recusa `versions` e
`locator`, campos internos da persistência. Para operações ainda sem projeção
específica, o contrato de resposta aceita um objeto com valores JSON, mas recusa
instâncias BSON, `Date` e buffers não serializados. A serialização e as projeções
existentes continuam sob responsabilidade dos handlers e repositories.

Valide com `npm run typecheck`, `npm test` e `npm run test:compiled` usando MongoDB
sintético para as integrações. `test/contracts/zodRouteContracts.test.ts` confere o
inventário completo, coerção, erro HTTP e sanitização dos segredos.
