# API-REVIEW-T07 — análise Sonar da API

Análise da árvore de código de 2026-09-29 no projeto [BIAWS-API](http://localhost:9000/dashboard?id=BIAWS-API), SonarQube 26.5.0.122743. A análise processada `df861262-a290-4637-95c4-f993aad375af` terminou com `SUCCESS` após a correção dos achados High. O Quality Gate permanece **ERROR**: os security hotspots novos têm 0% de revisão, abaixo dos 100% exigidos. Não há issues abertas Blocker ou de impacto High. A análise foi enviada antes do commit da T07, quando o HEAD ainda era `d256930`; a nota da tarefa no BIAWS registra a revisão e a análise posteriores ao commit.

## Preparação e execução

- `sonar-project.properties.example` versiona a configuração sem credencial: versão 0.8.0, `src` e `test/**/*.test.ts`, exclusão de `dist` e `coverage`, e importação de `coverage/lcov.info`. As configurações locais ignoradas pelo Git continuam fornecendo os tokens dos quatro projetos.
- `npm run test:coverage` gera LCOV com o test runner do Node. O arquivo é ignorado pelo Git. Nesta execução, o LCOV registra 26.518 de 40.189 linhas cobertas (65,98%); o Sonar exibe 66,5% conforme seu próprio cálculo.
- `bash sonar-analysis.sh` executou testes e scanners de API, UI, CLI e MCP, verificando o status de cada módulo. Os quatro scanners concluíram com `ANALYSIS SUCCESSFUL`. A API passou em 222 testes de fonte e 222 testes compilados com MongoDB sintético e integração HTTP; o teste novo executa a classificação de status no MongoDB real. Typecheck, formatação, contrato OpenAPI e checagem de diff também passaram.

## Achados e Quality Gate

| Indicador da API                                                                |                                      Resultado |
| ------------------------------------------------------------------------------- | ---------------------------------------------: |
| Issues abertas Blocker ou impacto High                                          | 12 antes das correções; **0** após a reanálise |
| Issues abertas totais                                                           |                  443, de impacto Low ou Medium |
| Bugs / vulnerabilidades / code smells                                           |                                    0 / 1 / 442 |
| Issues por qualidade de software: confiabilidade / segurança / manutenibilidade |                                   34 / 1 / 442 |
| Security hotspots                                                               |                                4; 0% revisados |
| Cobertura Sonar                                                                 |                                          66,5% |
| Duplicação total / duplicação de código novo                                    |                    2,3% / 2,26131% (limite 3%) |

As condições de Blocker, High e duplicação de código novo estão **OK**. A condição `new_security_hotspots_reviewed` está **ERROR** (0% contra 100%). O token de análise do projeto recebe HTTP 403 ao consultar os detalhes dos hotspots, e a interface local exige login; a revisão requer uma identidade Sonar com acesso apropriado. O gate não deve ser apresentado como aprovado. A vulnerabilidade Medium remanescente é `typescript:S2068` em `src/auth/authorizationMiddleware.ts:301`; deve ser examinada junto com os hotspots por alguém com acesso de revisão.

Os 12 achados High iniciais eram oito exports mutáveis (`typescript:S6861`) em `src/repositories/requests/options.ts`, dois trechos de complexidade (`typescript:S3776`) em `src/repositories/monitoring/templates/resultValidator.ts` e `src/routes/shared/taskAttachmentHandler.ts`, um callback de `map` (`typescript:S7727`) em `src/repositories/monitoring/templates/legacyEvaluator.ts` e uma chave `then` de `$switch` MongoDB (`typescript:S7739`) em `src/repositories/monitoring/events/summary.ts`. Os exports foram reunidos em um objeto de opções com acesso dinâmico, os trechos complexos foram extraídos, o callback passou a encaminhar seus argumentos explicitamente, e o `$switch` foi substituído por `$indexOfArray` com fallback para `unknown`. Nenhuma regra foi excluída ou suprimida.

Próxima ação: revisar os quatro security hotspots no Sonar com uma conta habilitada, avaliar o achado Medium de segurança e confirmar o Quality Gate após a revisão. Dívida Low/Medium adicional permanece fora do critério Blocker/High desta tarefa.
