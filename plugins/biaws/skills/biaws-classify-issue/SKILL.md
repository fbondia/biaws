---
name: biaws-classify-issue
description: Analisar e aplicar, quando solicitado, classificação de uma issue BIAWS com a taxonomia e tags atuais da aplicação.
---

# Classificar uma issue

Use `issues_get` com código/ID confirmado. Identifique aplicação, classificação
atual, comentários e metadados úteis dos anexos. Não substitua uma issue por
uma descrição livre.

Busque `issues_get_classification_catalog` da aplicação com `flatten: true`.
Use `issues_suggest_taxonomy` como ajuda lexical e valide os IDs na árvore
retornada; não trate o score como decisão. Consulte precedentes com
`issues_search` ou `issues_by_taxonomy` se a ambiguidade for material.

Escolha o nó válido mais específico que represente o assunto predominante.
Use secundários para assuntos distintos, sem redundância entre ancestral e
descendente. Selecione tags apenas dos grupos retornados e com evidência.
Explique lacunas em vez de inventar opções.

Para análise ou sugestão, apresente recomendação, IDs/rótulos, justificativa,
confiança e diferenças sem gravar. Se o usuário já pediu para aplicar, use
`issues_classify` sem outra aprovação redundante. Monte o estado completo:
a ferramenta substitui a classificação. Preserve summary e valores fora do
escopo; explicite remoções relevantes. Releia `issues_get` e compare a gravação.
Em timeout, releia antes de repetir.

Não altere status, tipo, conteúdo, comentários ou anexos durante classificação.
Siga também as regras de operação da skill biaws-operate-workspace incluída.
