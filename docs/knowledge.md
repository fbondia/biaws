# Documentos de conhecimento

O Bondia Workspaces mantém regras de negócio, decisões arquiteturais, guidelines,
features, referências técnicas, procedimentos, textos livres e catálogos em uma
única coleção de documentos. O campo `documentType` é um discriminador obrigatório;
ele define validação, template, metadados específicos e ciclo de vida. A edição
comum não altera esse campo; trocas exigem a operação explícita de conversão.

## Tipos e ciclos de vida

| Tipo                    | Finalidade                                                     | Estados                                                      |
| ----------------------- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| `business-rule`         | Condições e comportamentos esperados do domínio                | `draft`, `active`, `retired`, `archived`                     |
| `architecture-decision` | Escolhas técnicas, contexto, alternativas e consequências      | `proposed`, `accepted`, `rejected`, `superseded`, `archived` |
| `guideline`             | Diretrizes e padrões de desenvolvimento                        | `draft`, `published`, `deprecated`, `archived`               |
| `feature`               | Descrição funcional e técnica aprofundada de uma capacidade    | `draft`, `published`, `deprecated`, `archived`               |
| `technical-reference`   | Arquitetura atual, contratos, schemas, protocolos e mecanismos | `draft`, `published`, `deprecated`, `archived`               |
| `procedure`             | Instruções operacionais reutilizáveis                          | `draft`, `published`, `deprecated`, `archived`               |
| `free-text`             | Texto Markdown livre, sem modelo predefinido                   | `draft`, `published`, `deprecated`, `archived`               |
| `catalog`               | Elementos com título e descrição Markdown                      | `draft`, `published`, `deprecated`, `archived`               |

Regras, decisões e features exigem uma aplicação. Guidelines, referências
técnicas, procedimentos, textos livres e catálogos também podem existir no escopo
geral do workspace.
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
- referência técnica: `referenceKind`;
- catálogo: `items`, uma lista ordenada de até 500 elementos com `id`, `title` e
  `description` (Markdown), além de `parentId` opcional para aninhamento. O título
  tem até 240 caracteres e a descrição é opcional; o ID estável é gerado
  quando omitido. `hideDescription` permite ocultar a descrição de cada item sem
  apagar o conteúdo salvo. O item pai deve pertencer ao mesmo catálogo. Ciclos são
  recusados e a árvore permite até 20 níveis.

Procedimentos não possuem campos adicionais em `details`; sua estrutura é
definida pelo template Markdown do tipo. Textos livres também não possuem
metadados específicos e começam com o Markdown em branco, sem seções obrigatórias.
Nos dois novos tipos, o resumo pode ser omitido: ele é derivado do conteúdo ou,
para um catálogo vazio, do título.

O catálogo permite adicionar, editar e remover elementos na aba **Conteúdo**.
Novos itens e subitens entram no topo de seu nível. O botão ao lado direito do
campo de digitação do título de cada item permite ocultar ou exibir sua descrição
opcional. A escolha
também se aplica à leitura e preserva o texto salvo. A exportação Markdown mantém
esse conteúdo.
Cada elemento pode ser expandido ou contraído independentemente, tanto na leitura
quanto na edição. Arraste pela alça para ordenar; solte sobre o título de outro
item para aninhar ou nas faixas entre itens para mudar de posição ou nível.
Os botões de organização oferecem as mesmas ações por teclado. A ordem dos
irmãos segue a lista `items`, e `parentId` define a árvore. Remover um elemento
remove também seus descendentes do rascunho. Salvar persiste a nova estrutura. O Markdown do documento é uma introdução opcional; o conteúdo
dos elementos fica em `details.items` e acompanha as revisões. A exportação
Markdown, o recurso de conteúdo e o PDF incluem todos os elementos, mesmo
contraídos na tela.

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

## Conversão de documentos

No cabeçalho do diálogo de detalhes, **Trocar tipo de documento** fica ao lado
das ações de exportação e replicação, para usuários com permissão de atualização.
O diálogo permite escolher o tipo de destino e descartar os dados adicionais do
tipo anterior ou incorporá-los em uma seção no rodapé do Markdown. Para catálogos,
essa escolha inclui todos os itens e seus descendentes.

As alterações pendentes são salvas antes da operação. Converter preserva ID,
identificador, conteúdo, anexos, referências e histórico, inicializa os metadados
específicos do destino e ajusta o estado ao ciclo de vida do novo tipo. Quando
necessário, o diálogo exige uma aplicação. Documentos arquivados precisam ser
restaurados antes da conversão.

Ao escolher **Catálogo**, pode-se converter o próprio documento (seu Markdown
vira a introdução) ou incorporá-lo como item de um catálogo existente, no mesmo
workspace. Na incorporação, o título e o conteúdo viram um item raiz; o documento
original é preservado. O item contém um link para o original, onde permanecem os
anexos e o histórico. Referências Markdown a anexos passam a apontar para esse
documento, sem compartilhar arquivos entre permissões diferentes.

A rota `POST /api/knowledge/documents/:id/convert` exige `documents.update` na
origem e no destino. O corpo contém `targetType`, `additionalData` (`append` ou
`discard`) e, para incorporação, `mode: "catalog-item"` e `targetCatalogId`.
`applicationId` e `affectedComponentIds` podem adequar o contexto da conversão.
`expectedUpdatedAt` protege a versão de origem; a escrita usa comparação de
versão para recusar alterações concorrentes. Toda mudança gera revisão e auditoria.
Incorporar novamente o mesmo documento no mesmo catálogo é recusado para evitar
duplicação em retentativas.

## Arquivos no Markdown

Depois de salvar o documento, envie seus anexos pela aba **Arquivos**. No editor
do conteúdo ou de uma observação, o seletor **Imagem** insere uma imagem no corpo
do texto, e **Anexo** insere um link de download para qualquer arquivo:

```markdown
![Captura de tela](attachment:id-da-imagem)
[Manual em PDF](attachment:id-do-anexo)
```

As referências usam o ID do arquivo e funcionam na leitura do documento,
na prévia do editor e nas observações. As imagens também aceitam referências
por nome (`[anexo: captura.png]`) ou CID, desde que identifiquem um único anexo.
O acesso ao conteúdo exige a permissão `documents.attachments.read` e usa a API
autenticada no workspace atual. Outros arquivos são carregados somente ao
acionar o download. Referências ausentes, ambíguas ou sem permissão de leitura
permanecem como texto.

## API, MCP e contexto

As rotas HTTP ficam sob `/api/knowledge/documents` e oferecem listagem, criação,
leitura, atualização, arquivamento, movimentação, revisões, observações e
replicação para múltiplos workspaces. Replicar exige um identificador. Quando
não há correspondência no destino, a API cria uma cópia limpa com o tipo e o
conteúdo da origem. Quando há correspondência, preserva tipo, ID, contexto,
classificação, referências, estado e histórico do destino, substituindo somente
título, resumo e Markdown. Entre catálogos, os elementos também são substituídos.
Ao replicar um catálogo para um documento de outro tipo, os elementos são
convertidos em seções Markdown, preservando o tipo do destino. A
permissão `documents.*` é híbrida: pode abranger todo o workspace ou aplicações
selecionadas.

O MCP expõe `document_types_list`, `documents_search`, `resources/read` de `biaws://workspaces/{workspaceId}/documents/{documentId}`,
`documents_create`, `documents_update` e `documents_add_observation`.
`document_types_list` devolve o catálogo oficial de tipos, estados, contexto e
campos específicos. `documents_create` usa um schema discriminado por tipo para
recusar combinações inválidas antes da chamada HTTP. `knowledge_context_load`
carrega documentos vigentes — regras ativas, decisões aceitas e demais tipos
publicados — aplicáveis à aplicação ou componente. Listagens e o contexto
agregado omitem o Markdown e as descrições dos elementos de catálogos; o conteúdo
completo é carregado sob demanda.
