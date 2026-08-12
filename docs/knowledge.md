# Documentos de conhecimento

O Bondia Workspaces mantém regras de negócio, decisões arquiteturais, guidelines,
features e referências técnicas em uma única coleção de documentos. O campo
`documentType` é um discriminador obrigatório e imutável; ele define validação,
template, metadados específicos e ciclo de vida.

## Tipos e ciclos de vida

| Tipo                    | Finalidade                                                     | Estados                                                      |
| ----------------------- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| `business-rule`         | Condições e comportamentos esperados do domínio                | `draft`, `active`, `retired`, `archived`                     |
| `architecture-decision` | Escolhas técnicas, contexto, alternativas e consequências      | `proposed`, `accepted`, `rejected`, `superseded`, `archived` |
| `guideline`             | Diretrizes e padrões de desenvolvimento                        | `draft`, `published`, `deprecated`, `archived`               |
| `feature`               | Descrição funcional e técnica aprofundada de uma capacidade    | `draft`, `published`, `deprecated`, `archived`               |
| `technical-reference`   | Arquitetura atual, contratos, schemas, protocolos e mecanismos | `draft`, `published`, `deprecated`, `archived`               |

Regras, decisões e features exigem uma aplicação. Guidelines e referências
técnicas também podem existir no escopo geral do workspace. Componentes somente
podem ser associados quando houver uma aplicação.

## Contrato

Todos os documentos compartilham título, resumo curto, Markdown, contexto,
coleção, referências, origem, datas de revisão, autoria e auditoria. Campos
específicos ficam em `details`, validados por tipo:

- regra: `ruleCode` e `effectiveFrom`;
- decisão: `decidedAt`;
- guideline: `scope` e `enforcement`;
- feature: `maturity`;
- referência técnica: `referenceKind`.

`source.mode` distingue conteúdo `native` de conteúdo canônico em `repository`.
Nesse segundo caso, `repositoryId` e `path` são obrigatórios. O Markdown permite
manter uma representação consultável, mas a origem declara onde a manutenção
canônica acontece.

## Organização, relações e governança

Todos os tipos compartilham uma árvore de coleções. Assim, uma coleção de
assunto pode reunir a feature, suas regras, decisões, guidelines e referências.

Relações apontam diretamente para outro documento do mesmo workspace:

```json
{
  "targetDocumentId": "id-do-documento",
  "relationship": "supported-by"
}
```

Auto-referências, duplicatas e alvos fora do escopo autorizado são recusados.
`definedAt`, `lastReviewedAt`, `nextReviewAt` e `reviewedBy` distinguem vigência
conceitual das datas técnicas. Cada alteração cria uma revisão imutável;
observações são append-only.

## API, MCP e contexto

As rotas HTTP ficam sob `/api/knowledge/documents` e oferecem listagem, criação,
leitura, atualização, arquivamento, movimentação, revisões, observações e
replicação para múltiplos workspaces. A replicação cria uma cópia limpa somente
com tipo, título, resumo e Markdown; contexto, classificação e referências não
são transportados. A
permissão `documents.*` é híbrida: pode abranger todo o workspace ou aplicações
selecionadas.

O MCP expõe `documents_search`, `documents_get`, `documents_create`,
`documents_update` e `documents_add_observation`. `knowledge_context_load`
carrega documentos vigentes — regras ativas, decisões aceitas e demais tipos
publicados — aplicáveis à aplicação ou componente. Listagens e o contexto
agregado omitem o Markdown; o conteúdo completo é carregado sob demanda.
