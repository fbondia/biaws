# Organização das rotas

Cada domínio tem uma pasta e um `index.ts` que cria e exporta seu router. O índice
importa funções de registro nomeadas e as chama na ordem desejada. Middlewares do
router permanecem explícitos nesse índice e conservam sua posição entre registros.
`src/app.ts` monta os routers nos prefixos HTTP públicos.

Cada endpoint tem um arquivo que exporta `register<Operação>(router)`. Esse arquivo
declara método, caminho completo relativo ao router, middlewares de autorização,
handler HTTP, resposta e auditoria. A função recebe o router; não importa o índice
do domínio. A composição é explícita, sem descoberta automática de arquivos.

Por exemplo:

```text
issues/
  index.ts
  listIssues.ts
  getIssue.ts
  createIssue.ts
  updateIssue.ts
  comments/
    listComments.ts
    getComment.ts
    createComment.ts
    replaceComment.ts
  attachments/
    listAttachments.ts
    getAttachment.ts
    createAttachment.ts
```

Subpastas agrupam recursos filhos ou operações relacionadas. `helpers.ts` contém
apoio exclusivo do domínio, como construção de contexto e auditoria. `shared/`
concentra mecanismos usados por múltiplos domínios. Queries, persistência e regras
de negócio continuam nos repositories e services.

Leituras granulares que alimentam resources MCP são endpoints do domínio
correspondente. `shared/resourceReadHandler.ts` cuida somente de resolução de
referências, contexto autorizado e serialização JSON, Markdown ou binária.

Para adicionar um endpoint:

1. Criar o arquivo com uma função de registro nomeada e declarar suas permissões.
2. Importar e registrar a função no `index.ts`, considerando a precedência de
   caminhos estáticos e parametrizados e os middlewares do router.
3. Atualizar o contrato do domínio e os testes HTTP aplicáveis.
4. Atualizar conscientemente `test/fixtures/api-route-contract.tson`, que protege
   métodos, caminhos, quantidade de handlers e ordem de registro dos routers.

O teste de inventário de resources também verifica que todo caminho anunciado
pelo MCP possui uma rota GET na API.

Os imports relativos no TypeScript usam extensão `.js` para resolver corretamente no ESM compilado.
