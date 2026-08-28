# Documentos de conhecimento

O Bondia Workspaces mantém regras de negócio, decisões arquiteturais, guidelines,
features, referências técnicas e procedimentos em uma única coleção de
documentos. O campo `documentType` é um discriminador obrigatório e imutável;
ele define validação, template, metadados específicos e ciclo de vida.

## Tipos e ciclos de vida

| Tipo                    | Finalidade                                                     | Estados                                                      |
| ----------------------- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| `business-rule`         | Condições e comportamentos esperados do domínio                | `draft`, `active`, `retired`, `archived`                     |
| `architecture-decision` | Escolhas técnicas, contexto, alternativas e consequências      | `proposed`, `accepted`, `rejected`, `superseded`, `archived` |
| `guideline`             | Diretrizes e padrões de desenvolvimento                        | `draft`, `published`, `deprecated`, `archived`               |
| `feature`               | Descrição funcional e técnica aprofundada de uma capacidade    | `draft`, `published`, `deprecated`, `archived`               |
| `technical-reference`   | Arquitetura atual, contratos, schemas, protocolos e mecanismos | `draft`, `published`, `deprecated`, `archived`               |
| `procedure`             | Instruções operacionais reutilizáveis                           | `draft`, `published`, `deprecated`, `archived`               |

Regras, decisões e features exigem uma aplicação. Guidelines, referências
técnicas e procedimentos também podem existir no escopo geral do workspace.
Componentes somente podem ser associados quando houver uma aplicação.

Para guidelines, `details.scope` define o contexto: `workspace` não aceita
`applicationId`, `application` exige a aplicação e `component` exige também ao
menos um item em `affectedComponentIds`.

## Contrato

Todos os documentos compartilham um `identifier` técnico opcional e editável,
título, resumo curto, Markdown, contexto, coleção, referências, origem, datas de
revisão, autoria e auditoria. O identificador é único dentro do workspace e usa
letras minúsculas, números e hífens simples. Campos específicos ficam em
`details`, validados por tipo:

- regra: `ruleCode` e `effectiveFrom`;
- decisão: `decidedAt`;
- guideline: `scope` e `enforcement`;
- feature: `maturity`;
- referência técnica: `referenceKind`.

Procedimentos não possuem campos adicionais em `details`; sua estrutura é
definida pelo template Markdown do tipo.

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
replicação para múltiplos workspaces. Replicar exige um identificador. Quando
não há correspondência no destino, a API cria uma cópia limpa com o tipo e o
conteúdo da origem. Quando há correspondência, preserva tipo, ID, contexto,
classificação, referências, estado e histórico do destino, substituindo somente
título, resumo e Markdown. A
permissão `documents.*` é híbrida: pode abranger todo o workspace ou aplicações
selecionadas.

O MCP expõe `document_types_list`, `documents_search`, `documents_get`,
`documents_create`, `documents_update` e `documents_add_observation`.
`document_types_list` devolve o catálogo oficial de tipos, estados, contexto e
campos específicos. `documents_create` usa um schema discriminado por tipo para
recusar combinações inválidas antes da chamada HTTP. `knowledge_context_load`
carrega documentos vigentes — regras ativas, decisões aceitas e demais tipos
publicados — aplicáveis à aplicação ou componente. Listagens e o contexto
agregado omitem o Markdown; o conteúdo completo é carregado sob demanda.
