# Replicação entre workspaces

Skills, documentos, grupos de permissões e listas de opções usam o mesmo fluxo
de replicação para até 20 workspaces por requisição. A UI apresenta seleção
múltipla e o backend valida cada destino separadamente, registra auditoria no
workspace que recebeu a cópia e devolve sucesso ou falha por destino.

## Contrato

As rotas de replicação recebem:

```json
{
  "destinationWorkspaceIds": ["workspace-a", "workspace-b"]
}
```

O workspace atual não pode ser informado e IDs repetidos são eliminados. O
campo singular legado `destinationWorkspaceId` permanece aceito. Requisições em
lote retornam `201` quando todos os destinos concluem e `207` quando existe ao
menos uma falha:

```json
{
  "summary": { "total": 2, "succeeded": 1, "failed": 1 },
  "results": [
    {
      "workspace": { "id": "workspace-a", "name": "Workspace A" },
      "status": "created",
      "resource": { "type": "document", "id": "document-copy" }
    },
    {
      "workspace": { "id": "workspace-b", "name": "Workspace B" },
      "status": "failed",
      "error": {
        "code": "DESTINATION_DOCUMENT_CREATE_FORBIDDEN",
        "message": "Você não possui permissão para criar documentos gerais neste workspace",
        "statusCode": 403
      }
    }
  ]
}
```

Uma falha não desfaz cópias concluídas em outros destinos. A UI permite repetir
somente os destinos que falharam.

Nas listagens de documentos e skills, checkboxes permitem selecionar vários
itens de origem e abrir uma única ação **Replicar**. A versão atual de cada
skill é usada; documentos sem identificador não podem ser selecionados. O
resultado da operação em massa é consolidado por workspace, com a quantidade de
itens concluídos e os nomes e motivos das falhas parciais.

## Permissões e regras por recurso

| Recurso             | Leitura na origem   | Permissão no destino                     | Regra de cópia                                                                                                                   |
| ------------------- | ------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Skill               | `skills.read`       | `skills.publish`                         | publica a mesma versão na raiz; nunca sobrescreve versão existente                                                               |
| Documento           | `documents.read`    | `documents.create` ou `documents.update` | cria quando o identificador não existe; quando existe, substitui somente título, resumo e Markdown, preservando o contexto local |
| Grupo de permissões | `roles.read`        | `roles.manage`                           | não copia membros; grupos de sistema usam `systemKey` e grupos personalizados são criados ou substituídos pelo identificador     |
| Lista de opções     | `option_lists.read` | `option_lists.manage`                    | substitui explicitamente a configuração da mesma chave; não altera registros existentes                                          |

Documentos e grupos personalizados podem ser salvos sem identificador, mas não
podem ser replicados enquanto ele não for definido. O identificador é editável,
único por workspace e segue o formato das chaves do catálogo: letras minúsculas,
números e hífens simples. Alterá-lo permite associar ou separar manualmente as
entidades correspondentes entre workspaces.

Novos documentos são criados no escopo geral e sem coleção, classificação ou
referências. Quando já existe um documento com o mesmo identificador, seu tipo,
ID interno, contexto, classificação, referências, estado, histórico e demais
metadados locais são preservados; somente título, resumo e Markdown são
atualizados.

Em grupos com escopo de aplicações, a API mapeia as aplicações pela chave
técnica. O destino falha sem criar ou ampliar o grupo quando alguma aplicação
correspondente não existe ou está inativa.

Listas de opções exigem `conflictPolicy: "replace"` no payload para tornar a
substituição explícita. Skills continuam sem sobrescrever versões existentes.
