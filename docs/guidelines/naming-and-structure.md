# Nomenclatura e estrutura

Estas convenções descrevem o padrão predominante do BIAWS. Consistência local é
preferível a renomeações amplas sem benefício funcional.

## JavaScript e JSX

| Elemento                | Convenção                                                         | Exemplo                              |
| ----------------------- | ----------------------------------------------------------------- | ------------------------------------ |
| variável, função e hook | `camelCase`                                                       | `loadRequests`, `useCatalogOptions`  |
| componente React        | `PascalCase`                                                      | `IssueDetailsDialog`                 |
| constante de módulo     | `UPPER_SNAKE_CASE`                                                | `REQUEST_SAVE_DEBOUNCE_MS`           |
| classe CSS              | `camelCase` com prefixo de domínio                                | `requestDetailSelected`              |
| arquivo de componente   | `PascalCase.jsx`                                                  | `RequestDetails.jsx`                 |
| hook                    | `use` + `PascalCase` no nome exportado, arquivo em `camelCase.js` | `useRequestsView.js`                 |
| modelo/utilitário       | `camelCase.js`                                                    | `requestUtils.js`, `catalogModel.js` |
| teste                   | sufixo `.test.js`                                                 | `catalogModel.test.js`               |

Use exports nomeados para módulos de domínio. `index.js` ou `index.jsx` pode ser
o ponto público de uma pasta, mas não deve virar um barrel indiscriminado.

## API e dados

- coleções MongoDB: `lowerCamelCase` plural, centralizadas em
  `biaws-api/src/database/collectionNames.js`;
- IDs públicos: sufixo `Id`, como `workspaceId` e `applicationId`;
- listas de IDs: sufixo `Ids`;
- datas persistidas: sufixo `At` e valor `Date` quando controlado pela API;
- booleanos: nomes que expressem predicado, como `includeArchived` ou
  `createdIssue`;
- factories: prefixo `create`;
- normalizadores: prefixo `normalize`;
- builders sem efeito colateral: prefixo `build`;
- funções que exigem existência/permissão: prefixo `require` ou `assert`;
- listagens paginadas: preferir `{ items, meta }`.

Não use `_id` do MongoDB como contrato público quando o domínio possui `id`.
Normalize valores BSON antes de responder ao cliente.

## HTTP, MCP e CLI

- caminhos HTTP usam substantivos plurais e `kebab-case` quando têm mais de uma
  palavra;
- permissões usam `<domínio>.<ação>`, por exemplo `issues.read`;
- ferramentas MCP usam `snake_case` com domínio primeiro, como `issues_search`;
- eventos de log usam `snake_case`, como `http_request_failed`;
- comandos CLI usam palavras minúsculas e hífen em opções longas;
- variáveis de ambiente do produto usam `BIAWS_` ou o prefixo legado
  explicitamente documentado `ISSUE_`.

Evite criar um terceiro nome para o mesmo conceito. Se o contrato legado e a
marca atual divergirem, documente a compatibilidade em vez de fazer uma troca
parcial.

## Documentação

- arquivos Markdown usam `kebab-case.md`;
- `README.md` é reservado ao ponto de entrada de um diretório ou módulo;
- títulos e texto são escritos em português, salvo contratos que precisem
  permanecer em inglês;
- nomes de código permanecem entre crases e não são traduzidos;
- exemplos nunca contêm credenciais ou dados operacionais reais;
- diagramas Mermaid são preferidos para fluxos que não ficam claros em texto.

## Estrutura de componentes

Quando um componente crescer, prefira:

```text
FeatureView/
├── index.jsx
├── components/
│   └── FeaturePanel.jsx
├── hooks/
│   └── useFeatureView.js
└── model.js
```

- `index.jsx` compõe a tela e define sua API pública;
- `components/` contém partes visuais com responsabilidade própria;
- `hooks/` coordena estado e efeitos;
- `model.js` contém transformações puras;
- estilos seguem a arquitetura descrita em `biaws-ui/src/styles/README.md`.

Não crie todos esses arquivos antecipadamente. Extraia uma responsabilidade
quando ela existir e puder ser nomeada.
