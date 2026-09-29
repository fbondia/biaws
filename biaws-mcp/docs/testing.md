# Testes do MCP

Fontes e testes são TypeScript em modo estrito. O build remove `dist` e compila
ambos; o runner descobre recursivamente apenas `dist/test/**/*.test.js`, ordena
os arquivos e passa cada caminho uma única vez ao runner nativo do Node.
Fixtures e helpers não são executados como casos de teste.

- `test/domains`: catálogo/topologia, issues/taxonomia/comentários, melhorias,
  conhecimento, monitoramento, arquivos, coleções e segredos.
- `test/infrastructure`: HTTP, SDK/protocolo/stdio, catálogo geral, validação,
  ambiente e diagnóstico.
- `test/resources`: descoberta, itens, coleções, classificação, arquivos, links,
  workspace, erros e cancelamento.
- `test/helpers`: cliente SDK, refinamentos de fixtures e logger de captura.

Os antigos arquivos agregadores foram divididos por responsabilidade. Fixtures
locais exportam dados e funções explicitamente; as funções que substituem fetch
e ambiente sempre restauram os valores ao terminar, inclusive em erro.
Cada arquivo pode executar sem depender da ordem dos outros.

```bash
npm run check
npm test
npm test -- domains/demands
npm test -- infrastructure/http
npm test -- resources/resources-validation.test.js
node scripts/run-tests.mjs --list
npm run release:check
```

O contrato entre o catálogo MCP e as rotas GET da API é testado separadamente
na [suíte de integração entre módulos](../../test/integration/README.md).
Na raiz do repositório, execute `node scripts/test-integration.mjs` com as
dependências dos dois módulos instaladas. A suíte interna do MCP permanece
independente da API.

Filtros são trechos do caminho relativo em `dist/test`; nenhum resultado gera
erro, evitando execução silenciosa de uma seleção vazia. O inventário de T02 e
a suíte reorganizada de T03 têm os mesmos 118 casos, sem perdas ou duplicações.
