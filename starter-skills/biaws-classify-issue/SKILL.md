---
name: biaws-classify-issue
description: Analisar e classificar uma issue existente no Bondia Workspaces usando a taxonomia e os grupos de tags vigentes da aplicação relacionada. Usar quando o usuário pedir para classificar, categorizar, revisar, corrigir ou aplicar assuntos e tags a uma issue; separar recomendação de escrita e gravar somente quando houver pedido explícito.
---

# Classificar issue do Bondia Workspaces

Usar as ferramentas MCP `biaws` e as regras de segurança de `biaws-operate-workspace`. Basear a classificação no registro atual e no catálogo obtido durante a execução.

## Fluxo

1. Exigir o código ou ID da issue e chamar `issues_get`. Não substituir uma issue existente por uma descrição livre.
2. Identificar o workspace, a aplicação relacionada e a classificação atual.
3. Chamar `issues_get_classification_catalog` com `applicationId` quando disponível e `flatten: true`. Usar `procedures_get_classification_catalog` apenas como fallback compatível e informar o fallback.
4. Considerar título, descrição, comentários e metadados úteis de anexos. Dar mais peso ao problema, à solicitação e à causa confirmada do que a assinaturas, citações automáticas ou hipóteses descartadas.
5. Chamar `issues_suggest_taxonomy` como busca auxiliar. Validar cada sugestão contra a árvore atual; não tratar score lexical como decisão.
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

Depois da escrita, chamar `issues_get`, comparar o estado persistido com o payload e relatar sucesso somente se forem iguais. Após timeout ou resposta ambígua, reler antes de tentar novamente.

## Limites

- Não alterar status, tipo, conteúdo, comentários ou anexos.
- Não ocultar valores atuais que seriam removidos.
- Não gravar IDs ausentes do catálogo obtido na execução.
- Não afirmar confiança alta quando a conclusão depender apenas de palavras isoladas.
