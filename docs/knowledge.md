# Regras de negócio e decisões arquiteturais

O Bondia Workspaces mantém conhecimento normativo em dois recursos tipados, em
vez de adicionar um campo genérico de documentação ao catálogo:

- **regras de negócio** descrevem condições e comportamentos esperados do
  domínio;
- **decisões arquiteturais** registram escolhas técnicas e suas razões.

Os dois recursos exigem uma aplicação, podem apontar para zero ou mais
componentes da mesma aplicação e armazenam o conteúdo principal em Markdown.
Metadados de contexto, estado, datas e relações permanecem estruturados.

## Organização e ciclo de vida

Cada tipo possui uma árvore independente de coleções do workspace. As coleções
são livres e servem apenas à organização escolhida pelo operador.

Regras usam `draft`, `active`, `retired` e `archived`. Decisões usam `proposed`,
`accepted`, `rejected`, `superseded` e `archived`. Registros arquivados não são
excluídos e deixam de aparecer nas consultas padrão.

`definedAt`, `lastReviewedAt`, `nextReviewAt` e `reviewedBy` distinguem a
vigência conceitual das datas técnicas `createdAt` e `updatedAt`. Cada alteração
material cria uma revisão imutável; a trilha funcional registra o ator e as
mudanças. Observações são registros append-only e não alteram o Markdown
normativo.

## Relações

`references` liga regras e decisões da mesma aplicação:

```json
{
  "targetType": "architecture-decisions",
  "targetId": "id-da-decisao",
  "relationship": "supported-by"
}
```

O relacionamento é descritivo e permanece flexível. Auto-referências,
duplicatas e alvos fora da aplicação ou do escopo autorizado são recusados.

## API e MCP

As rotas HTTP ficam sob:

- `/api/knowledge/business-rules`;
- `/api/knowledge/architecture-decisions`.

Cada tipo oferece listagem, criação, leitura, atualização, arquivamento,
movimentação entre coleções, revisões e observações. As permissões
`business_rules.*` e `architecture_decisions.*` têm escopo por aplicação.

O MCP expõe ferramentas de busca, leitura, criação, atualização e observação
para cada tipo. `knowledge_context_load` carrega regras `active` e decisões
`accepted` por aplicação e componente, com Markdown opcional. O contexto
agregado da aplicação inclui resumos desses dois grupos.
