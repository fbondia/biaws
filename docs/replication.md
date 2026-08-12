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

## Permissões e regras por recurso

| Recurso              | Leitura na origem | Permissão no destino | Regra de cópia |
| -------------------- | ----------------- | -------------------- | -------------- |
| Skill                | `skills.read`     | `skills.publish`     | publica a mesma versão na raiz; nunca sobrescreve versão existente |
| Documento            | `documents.read`  | `documents.create`   | cria cópia limpa sem coleção, aplicação, classificação ou referências |
| Grupo de permissões  | `roles.read`      | `roles.manage`       | não copia membros; grupos de sistema atualizam o correspondente e grupos personalizados recusam nome existente |
| Lista de opções      | `option_lists.read` | `option_lists.manage` | substitui explicitamente a configuração da mesma chave; não altera registros existentes |

Permissões de destino precisam ter escopo integral de workspace. Em grupos com
escopo de aplicações, a API mapeia as aplicações pela chave técnica. O destino
falha sem criar ou ampliar o grupo quando alguma aplicação correspondente não
existe ou está inativa.

Listas de opções exigem `conflictPolicy: "replace"` no payload para tornar a
substituição explícita. Skills e grupos personalizados preservam a política de
não sobrescrever conflitos.
