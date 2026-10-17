---
name: biaws-create-improvement
description: Investigar e estruturar uma melhoria vinculada à aplicação BIAWS e cadastrá-la quando o pedido autorizar.
---

# Criar uma melhoria

Identifique problema, resultado esperado, origem, usuários afetados, restrições,
dependências e critérios verificáveis. Separe fatos fornecidos, fatos consultados,
inferências e decisões pendentes. Não invente responsável, aprovação ou data.

Confirme aplicação e componentes com `applications_list`,
`applications_get_context` e `components_list`. O workspace vem da conexão.
Consulte `demands_list` para detectar duplicatas e leia as aderentes com
`demands_get`. Ambiguidade material precisa de orientação antes de cadastrar.
Use documentos/contexto MCP disponíveis e fontes fornecidas pelo usuário;
não suponha acesso a repositórios, shell ou banco.

Estruture objetivo, escopo, impactos/evidências, considerações, esforço e plano
de entregas. Use IDs estáveis nas seções de especificação. Inclua aplicação e
somente componentes realmente afetados. Se não houver estimativa, declare
pendente; use estimatedJourneys: 0 somente quando exigido pelo contrato, sem
descrevê-lo como esforço zero.

Pedidos para propor ou rascunhar autorizam apresentar. Pedido para criar ou
cadastrar autoriza `demands_create` sem nova confirmação. Omitir status usa o
padrão configurado. Não use issue para representar melhoria. Releia
`demands_get` após criar e confira aplicação, componentes, seções e estimativas.
Em resposta ambígua/timeout, pesquise antes de repetir. Planejamento de tarefas
é tratado pela skill biaws-plan-improvement incluída.
