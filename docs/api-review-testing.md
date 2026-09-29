# Referência de testes API-REVIEW-T01

A reorganização preserva os 211 testes da referência anterior: 202 unitários e
9 integrações. `biaws-api/test/fixtures/test-migration-map.json` relaciona os
arquivos originais aos destinos. Nenhum cenário foi removido ou duplicado.

Os 22 testes de `topologyRepository.test.js` foram distribuídos entre components,
repositories, servers, deployments, runtimes, monitoring e catalog. A jornada
HTTP de topologia continua sendo uma única operação de teste, com setup/teardown
explícitos e etapas extraídas em `test/catalog/http`. As etapas dependentes usam
um contexto passado pela própria jornada; não dependem de testes anteriores.
As asserções e os payloads foram preservados. A fixture `api-route-contract.json`
continua congelando métodos, paths, middlewares e precedência das rotas.

## Execução

Em `biaws-api`:

```bash
npm test
npm test -- deployments
npm run test:unit
npm run test:integration
npm run test:http
BIAWS_INTEGRATION_MONGO_URI=mongodb://127.0.0.1:37127/biaws_test BIAWS_HTTP_INTEGRATION=1 npm test
```

A descoberta é recursiva e inclui arquivos `.test.ts` e `.test.js`, excluindo fixtures
e etapas auxiliares. `test:integration` seleciona MongoDB; `test:http` seleciona
as jornadas HTTP. A flag `BIAWS_HTTP_INTEGRATION=1` habilita a jornada completa de
sessão/API key. A URI habilita as outras integrações. Testes ignorados são
reportados pelo runner e não constituem validação integrada.

Cada integração usa um banco `biaws_test_<UUID>` exclusivo e restaura o ambiente
no teardown. Configurações externas de nome de banco não são usadas para limpeza.
O HTTP usa portas efêmeras e arquivos em diretórios temporários próprios.
Identidades e credenciais dos testes são sintéticas.

## Contratos de referência

Além do inventário estrutural, as jornadas exercitam autenticação por sessão e
API key, permissão negativa, isolamento de workspace/aplicação, ID/código,
paginação, conflitos, auditoria e concorrência. As leituras de resources verificam
hierarquia e aliases; topologia verifica relações, monitoring, templates e
execuções; issues verificam comentários e criação concorrente. Essa referência
permanece executável durante as migrações TypeScript/Zod.
