# Validação integrada da API — API-REVIEW-T06

Revisão validada: `a70433e` (T01–T05), seguida da correção de sanitização de
anexos desta tarefa. Execução em 2026-09-29, com Node 22 no container e MongoDB
8.0.20 descartável em `127.0.0.1:37127`. Os testes usam
`BIAWS_INTEGRATION_MONGO_URI=mongodb://127.0.0.1:37127/biaws_test` e
`BIAWS_HTTP_INTEGRATION=1`; cada integração cria um banco com UUID próprio. Não
foi usado o banco operacional. Logs detalhados ficaram em `/tmp/api-review-t06-*`
durante a execução local, sem credenciais reais.

| Camada                        | Comando                                        | Resultado                             |
| ----------------------------- | ---------------------------------------------- | ------------------------------------- |
| TypeScript                    | `npm run typecheck`                            | passou, zero diagnósticos             |
| Formatação                    | `npm run format:check`                         | passou                                |
| OpenAPI                       | `npm run openapi:check`                        | artefato determinístico atualizado    |
| Unidade                       | `npm run test:unit`                            | 212 passaram, 0 falharam, 0 ignorados |
| MongoDB                       | `npm run test:integration`                     | 7 passaram, 0 falharam, 0 ignorados   |
| HTTP                          | `npm run test:http`                            | 2 passaram, 0 falharam, 0 ignorados   |
| Suíte fonte após correção     | `npm test`                                     | 221 passaram, 0 falharam, 0 ignorados |
| Suíte compilada após correção | `npm run test:compiled`                        | 221 passaram, 0 falharam, 0 ignorados |
| Integração MCP/API            | `node scripts/test-integration.mjs` na raiz    | 1 passou                              |
| CLI                           | `npm test` em `biaws-cli`                      | 81 passaram, 0 ignorados              |
| UI                            | `npm test` em `biaws-ui`                       | 189 passaram, 0 ignorados             |
| Documentação                  | `node scripts/check-documentation.mjs` na raiz | passou                                |

O inventário congelado em T01 é comparado aos 246 contratos Zod e às operações
do OpenAPI. As jornadas HTTP exercitam sessão, chave de API, negação por permissão,
escopo de workspace/aplicação, identificadores e códigos, paginação, conflitos,
auditoria e monitoramento. Os testes Mongo cobrem isolamento, idempotência do seed
e criação concorrente de issue. A leitura de resources verifica aliases,
relações pai/filho e ausência de metadados internos. Esta tarefa acrescentou
upload multipart HTTP de anexo de tarefa, download dos mesmos bytes e evento de
auditoria; o teste detectou que a resposta de upload incluía o local de
armazenamento. `attachmentService` agora remove `storage` da projeção pública
`uploaded`, mantendo a referência internamente para persistência e download.

A imagem foi construída com
`docker build -f docker/api.Dockerfile -t biaws-api-review-t06 .` após a
correção. Um container com `NODE_ENV=production`, issue storage temporário e
MongoDB sintético respondeu: `GET /api/health` 200, `/api/openapi.json` 200,
`/api/docs/` 200 e `/api/issues` sem sessão 401. O bootstrap compilado criou o
administrador sintético e o workspace padrão; `seed:demo` concluiu na base
descartável. O container foi encerrado e os bancos `biaws_t06_smoke` e
`biaws_t06_final_smoke` foram removidos nominalmente. A imagem local não foi
publicada. O Compose completo não foi iniciado nesta tarefa; os fluxos de sessão
e API key foram exercitados pelas jornadas HTTP e o runtime distribuído pela
imagem compilada.
