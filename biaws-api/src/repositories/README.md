# Organização dos repositories

Repositories são agrupados pelo domínio que mantém seus dados e invariantes.
A divisão dos arquivos segue responsabilidades coesas; funções pequenas e
relacionadas permanecem juntas.

```text
requests/
  index.ts
  queries.ts
  mutations.ts
  normalization.ts
  options.ts
  references.ts
  indexes.ts
  ordering.ts
  journeys.ts
  specification.ts
  legacyMigration.ts
  resources.ts
  notes/
    normalization.ts
    queries.ts
    mutations.ts
  tasks/
    normalization.ts
    queries.ts
    mutations.ts
    notes.ts
    attachments.ts
```

As pastas de issues e documentos separam suas consultas e mutações de
normalização, classificação, referências, comentários, revisões e observações.
`catalog/` distingue workspaces e aplicações. `deployments/` distingue o deployment,
suas publicações e seus runtimes. `home/` separa configuração, catálogo de widgets,
métricas de issues e tarefas, saúde e composição do dashboard. `monitoring/` reúne
eventos, templates, perfis de metadados, monitores ativos e execução com leases.

## Dependências e API pública

- `index.ts` declara explicitamente as operações públicas do domínio consumidas
  por rotas, services e scripts; não reexporta indiscriminadamente helpers privados.
- Módulos internos importam diretamente o módulo responsável pela operação,
  evitando depender do próprio `index.ts` ou criar ciclos por composição.
- Normalização e filtros não dependem de mutações. Consultas compõem os dados dos
  filhos; mutações usam essa composição para conservar o contrato do agregado.
- Índices, acesso às coleções e caches de inicialização mantêm uma única instância
  no módulo responsável. As opções configuráveis de melhorias permanecem em
  `requests/options.ts`, com os mesmos valores compartilhados e carregamento.
- `shared/` contém contexto de conhecimento, referências, apoio de topologia e
  metadados de resources usados por mais de um domínio. Regras específicas ficam
  no domínio correspondente.
- Persistência continua exclusiva da API. Autorização e tenancy continuam
  aplicadas nas consultas e nas invariantes existentes.

## Resources e compatibilidade

`issues/resources.ts`, `requests/resources.ts` e `documents/resources.ts` leem
partes dos respectivos agregados. Helpers em `shared/resourceReads.ts` cuidam de
paginação, contexto da resposta e metadados públicos de arquivos, sem consultar
agregados de domínio. Arquivos de tarefa continuam validando o vínculo pelo módulo
`requests/tasks/attachments.ts`.

Os consumidores usam os novos caminhos de módulos; não há arquivos de passagem
com os nomes antigos. Contratos HTTP, schemas MCP, IDs, identificadores, auditoria
e estrutura persistida permanecem compatíveis. A migração legada que já era
executada durante leituras de melhorias continua em `requests/legacyMigration.ts`.

Para validar alterações, executar formatação, sintaxe e testes da API. A suíte HTTP
e MongoDB cobre os contratos dos agregados, autorização, isolamento, índices,
concorrência e recursos filhos. O teste de contrato de rotas protege os métodos,
caminhos e a precedência dos 246 endpoints existentes.

Os imports relativos no TypeScript usam extensão `.js` para resolver corretamente no ESM compilado.
