# Organização das rotas

Cada domínio tem uma pasta e um `index.js` que cria e exporta seu router. O índice
importa funções de registro nomeadas e as chama na ordem desejada. Middlewares do
router permanecem explícitos nesse índice e conservam sua posição entre registros.
`src/app.js` monta os routers nos prefixos HTTP públicos.

Cada endpoint tem um arquivo que exporta `register<Operação>(router)`. Esse arquivo
declara método, caminho completo relativo ao router, middlewares de autorização,
handler HTTP, resposta e auditoria. A função recebe o router; não importa o índice
do domínio. A composição é explícita, sem descoberta automática de arquivos.

Por exemplo:

```text
issues/
  index.js
  listIssues.js
  getIssue.js
  createIssue.js
  updateIssue.js
  comments/
    listComments.js
    getComment.js
    createComment.js
    replaceComment.js
  attachments/
    listAttachments.js
    getAttachment.js
    createAttachment.js
```

Subpastas agrupam recursos filhos ou operações relacionadas. `helpers.js` contém
apoio exclusivo do domínio, como construção de contexto e auditoria. `shared/`
concentra mecanismos usados por múltiplos domínios. Queries, persistência e regras
de negócio continuam nos repositories e services.

Leituras granulares que alimentam resources MCP são endpoints do domínio
correspondente. `shared/resourceReadHandler.js` cuida somente de resolução de
referências, contexto autorizado e serialização JSON, Markdown ou binária.

Para adicionar um endpoint:

1. Criar o arquivo com uma função de registro nomeada e declarar suas permissões.
2. Importar e registrar a função no `index.js`, considerando a precedência de
   caminhos estáticos e parametrizados e os middlewares do router.
3. Atualizar o contrato do domínio e os testes HTTP aplicáveis.
4. Atualizar conscientemente `test/fixtures/api-route-contract.json`, que protege
   métodos, caminhos, quantidade de handlers e ordem de registro dos routers.

O teste de inventário de resources também verifica que todo caminho anunciado
pelo MCP possui uma rota GET na API.
