---
name: biaws-contextualize-improvement
description: Explicar situação, escopo, tarefas, checklist, evidências e topologia de uma melhoria BIAWS, somente em leitura.
---

# Contextualizar uma melhoria

Resolva o código/ID com `demands_list` quando necessário e leia `demands_get`.
Use essa resposta como fonte principal para especificação, checklist, jornadas,
tarefas e notas. Complemente apenas o que ajuda a responder: `demands_list_tasks`,
`demands_deadlines`, `demands_implementation_context`,
`applications_get_context` ou `demands_journey_calendar`.

Comece pelo que o usuário perguntou. Separe status oficial, evidência nas notas,
cálculos derivados e inferências. Uma nota de execução não muda o status da
tarefa nem marca o checklist. Não declare conclusão quando essas fontes divergem.
Informe data de referência ao interpretar prazo e atraso.

Preserve códigos/IDs e referências relevantes. Aponte lacunas sem preenchê-las
com acesso a servidores, banco ou arquivos locais. Esta skill não cria, altera,
exclui ou adiciona notas. Siga a skill biaws-operate-workspace incluída.
