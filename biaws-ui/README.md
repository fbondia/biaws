# Bondia Workspaces UI

UI React para administrar o catálogo técnico e consultar a base de conhecimento
exposta pelo `biaws-api`.

## Execução

Em um terminal, suba a API:

```bash
cd ../biaws-api
npm install
npm run dev
```

Em outro terminal, suba a UI:

```bash
npm install
npm run dev
```

Por padrão a UI roda em `http://127.0.0.1:4400` e usa proxy para `http://127.0.0.1:3100`.

Se precisar apontar para outra API:

```bash
VITE_ISSUE_API_URL=http://127.0.0.1:3100 npm run dev
```

## Recursos

- Catálogo de aplicações com busca, criação, edição, arquivamento e histórico
- Topologia por aplicação: componentes, repositórios, deployments e runtimes
- Inventário de servidores com referências reversas de runtimes e deployments
- Relações e filtros por aplicação e componente em issues, demandas e
  procedimentos
- Ações e áreas de navegação condicionadas às permissões do ator autenticado
- Filtros por texto, código, tipo, status e intervalo de datas
- Seleção do campo de data usado nos filtros
- Paginação
- Importação de múltiplos arquivos EML por drag-and-drop, com dry-run individual antes da gravação
- Ordenação básica
- Resumos agregados por data, semana, mês, ano, tipo e status
- Gerenciamento da taxonomia de issues com upload de JSON, rascunho local e gravação do pacote inteiro via `PUT /api/issues/taxonomy`
- Classificação de issue no diálogo de detalhes, com taxonomia principal, taxonomias secundárias e tags por grupo gravadas em `issues.classification`
- Cores por grupo de tags, filtros por tag e exibição de tags na grid de issues

Enquanto houver somente o workspace padrão, a UI o resolve automaticamente e
não apresenta um seletor de tenant. Autorização e validação das relações
continuam sendo responsabilidades da API.

## Verificação

```bash
npm test
npm run check:css
npm run build
```
