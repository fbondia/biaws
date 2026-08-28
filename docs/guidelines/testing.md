# Testes

Testes devem proteger comportamento e invariantes, não reproduzir a estrutura
interna da implementação. Use `node:test` e `node:assert` enquanto não houver uma
decisão explícita de trocar o runner.

## Camadas

| Camada             | Objetivo                    | Exemplos                                         |
| ------------------ | --------------------------- | ------------------------------------------------ |
| unitária           | função pura e regra isolada | normalização, filtros, permissões, modelos de UI |
| integração MongoDB | persistência e concorrência | índices, paginação, isolamento, unicidade        |
| integração HTTP    | contrato completo da API    | autenticação, permissão, status, auditoria       |
| contrato MCP/CLI   | interface programática      | schema, dispatch, argumentos, erro HTTP          |
| Compose smoke      | instalação reproduzível     | bootstrap, seed idempotente, health e UI         |
| E2E de browser     | jornada crítica do usuário  | login, CRUD principal e negação de acesso        |

Não substitua uma camada barata por um teste E2E lento. Use a camada mais baixa
que observa o comportamento e acrescente integração quando a fronteira fizer
parte do risco.

## Regras gerais

- arquivos terminam em `.test.js` e ficam em `test/` do módulo;
- nomes descrevem cenário e resultado esperado;
- dados de teste são sintéticos e reconhecíveis;
- testes não dependem de ordem ou estado deixado por outro teste;
- relógio, IDs, filesystem e transporte devem ser injetáveis quando causarem
  não determinismo;
- não use sleeps para sincronização se houver um evento ou condição observável;
- teste resultado público, persistência relevante e efeitos colaterais;
- um bug corrigido deve receber teste que falharia antes da correção.

## API e MongoDB

Para mudanças multi-tenant, cubra pelo menos:

1. operação permitida no workspace/aplicação corretos;
2. identidade sem permissão;
3. tentativa de acessar outro workspace ou aplicação fora do escopo;
4. paginação/limite quando a operação lista dados;
5. auditoria quando a operação é uma mutação relevante.

Quando houver concorrência ou idempotência, teste duas execuções equivalentes e
confirme o resultado persistido, não apenas os status retornados.

Use `BIAWS_INTEGRATION_MONGO_URI` e flags de integração previstas pelo projeto.
Cada teste deve limpar ou isolar somente os dados que criou.

## UI

Mantenha regras puras fora de JSX para testar:

- normalização de payload;
- ordenação e filtros;
- builders de estado;
- totais e estados derivados;
- compatibilidade de modelos persistidos.

Enquanto não houver harness de DOM, build e `check:css` não substituem inspeção
de teclado, foco e layout. Registre a validação manual no pull request para
mudanças interativas.

## MCP e CLI

Para MCP, cubra:

- tool presente em `tools/list`;
- JSON Schema com obrigatórios e limites corretos;
- dispatch para o handler esperado;
- tradução de argumentos para request HTTP;
- propagação segura de falhas.
- timeout e cancelamento sem bloquear chamadas concorrentes;
- erro funcional via `isError: true` e erro JSON-RPC com código numérico.

Para CLI, cubra parsing, defaults, modo `--json`, paths e resultado/exit code.
Isole filesystem em diretório temporário e nunca use configuração real do
desenvolvedor.

## E2E prioritário

A futura suíte de browser deve começar pequena e estável:

1. bootstrap/login/logout;
2. autorização negativa e troca de workspace;
3. criar e atualizar uma issue;
4. criar melhoria e tarefa;
5. consultar/criar documento;
6. publicar e instalar uma skill;
7. criar entidades básicas de topologia.

Use ações semânticas e seletores acessíveis. Dados devem ser criados pela API ou
por fixtures idempotentes, nunca depender de um banco pessoal.

## Matriz de mudança

| Mudança              | Mínimo esperado                                                |
| -------------------- | -------------------------------------------------------------- |
| helper/model puro    | teste unitário                                                 |
| repository           | unitário da normalização + integração MongoDB                  |
| rota                 | integração HTTP positiva e negativa                            |
| permissão/escopo     | testes de autorização e isolamento                             |
| tool MCP             | schema, service e dispatch                                     |
| comando CLI          | parsing e comportamento do comando                             |
| script/bootstrap     | teste isolado ou Compose smoke                                 |
| UI visual/interativa | modelo unitário quando aplicável + build/CSS + inspeção manual |

## Comandos de validação

Execute apenas os módulos afetados durante o desenvolvimento e todos os
aplicáveis antes do pull request:

```bash
cd biaws-api && npm run format:check && npm run check && npm test
cd biaws-ui && npm run format:check && npm run check:css && npm test && npm run build
cd biaws-mcp && npm run format:check && npm run check && npm test
cd biaws-cli && npm run format:check && npm run check && npm test
```

O smoke completo de instalação é exercitado pela CI. Execute-o localmente quando
a mudança afetar Compose, bootstrap, seed, configuração ou integração entre
módulos.
