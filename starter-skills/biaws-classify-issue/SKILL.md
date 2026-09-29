---
name: biaws-classify-issue
description: Analisar e classificar uma issue existente no Bondia Workspaces usando a taxonomia e os grupos de tags vigentes da aplicação relacionada. Usar quando o usuário pedir para classificar, categorizar, revisar, corrigir ou aplicar assuntos e tags a uma issue; separar recomendação de escrita e gravar somente quando houver pedido explícito.
---

# Classificar issue do Bondia Workspaces

Usar as ferramentas MCP `biaws` e as regras de segurança de `biaws-operate-workspace`. Basear a classificação no registro atual e no catálogo obtido durante a execução.

## Fluxo

1. Obter o workspace configurado e o ID ou identificador da issue. Ler `biaws://workspaces/{workspaceId}/issues/{issueId}` com `resources/read`; seguir os links retornados e usar os IDs canônicos. Não substituir uma issue existente por uma descrição livre.
2. Identificar o workspace, a aplicação relacionada e a classificação atual.
3. Ler `biaws://workspaces/{workspaceId}/applications/{applicationId}/classification-catalog`, usando a aplicação da issue, para obter a taxonomia e os grupos de tags aplicáveis.
4. Ler `/comments` e `/files` da issue quando necessários à análise; percorrer a paginação quando houver mais itens relevantes. Considerar título, descrição, comentários e metadados úteis de anexos. Dar mais peso ao problema, à solicitação e à causa confirmada do que a assinaturas, citações automáticas ou hipóteses descartadas.
5. Produzir a sugestão por análise semântica do próprio agente, usando o catálogo vigente. O servidor não solicita sampling nem consulta uma LLM. Não usar a sugestão lexical legada como etapa da classificação.
6. Quando a ambiguidade for material, pesquisar precedentes com `issues_search` ou `issues_by_taxonomy`. Usá-los como evidência secundária, não como regra.
7. Montar e apresentar a recomendação antes de qualquer escrita.

## Taxonomia e tags

- Escolher como principal o nó válido mais específico que represente o assunto dominante e o resultado principal.
- Usar assuntos secundários somente para temas distintos e materialmente tratados.
- Evitar combinar ancestral e descendente quando o descendente já expressar o assunto.
- Não escolher por mera coincidência lexical nem inventar IDs.
- Selecionar tags somente quando houver evidência para a dimensão do grupo.
- Respeitar os pares tag-grupo retornados pelo catálogo e omitir grupos sem evidência.
- Recomendar deixar um campo vazio quando nenhuma opção for aderente e apontar a lacuna do catálogo.

## Resultado da análise

Informar código e título, classificação atual, recomendação completa com IDs e rótulos, justificativa, alternativas rejeitadas, confiança e diff entre o estado atual e o proposto.

## Escrita e verificação

Tratar pedidos de analisar, revisar ou sugerir como somente leitura. Chamar `issues_classify` apenas quando o usuário pedir explicitamente para aplicar, salvar, gravar ou atualizar a classificação.

Antes de gravar, montar o estado completo porque a ferramenta substitui a classificação: enviar principal, secundários e tags propostos; preservar o `summary` atual e valores fora do escopo; usar `updatedBy: "biaws-classify-issue"`.

Depois da escrita, reler os resources da issue e de sua `/classification`, comparar o estado persistido com o payload e relatar sucesso somente se forem iguais. Após timeout ou resposta ambígua, reler antes de tentar novamente.

## Limites

- Não alterar status, tipo, conteúdo, comentários ou anexos.
- Não ocultar valores atuais que seriam removidos.
- Não gravar IDs ausentes do catálogo obtido na execução.
- Não afirmar confiança alta quando a conclusão depender apenas de palavras isoladas.

## Compatibilidade

Se o cliente não suportar resources, usar `issues_get` e `issues_get_classification_catalog` para obter os mesmos dados e executar a mesma análise. A permissão de escrita segue o pedido do usuário, inclusive uma autorização já fornecida na conversa; não pedir confirmação novamente quando a gravação já estiver autorizada.
