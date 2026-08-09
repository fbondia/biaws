---
name: biaws-contextualize-improvement
description: Consultar e explicar a situação atual de uma melhoria registrada no Bondia Workspaces, reunindo escopo, especificação, tarefas, checklist, jornadas, prazos, notas, aplicação e componentes afetados. Usar quando o usuário pedir contexto, panorama, situação, status, resumo executivo ou contexto técnico de uma melhoria; operar somente em leitura.
---

# Contextualizar melhoria

Produzir uma visão factual, atual e rastreável. Usar somente ferramentas de leitura do MCP `biaws` e seguir `biaws-operate-workspace`.

## Fluxo

1. Resolver o código ou ID da melhoria. Quando houver apenas nome parcial, usar `demands_list`; não escolher silenciosamente entre resultados ambíguos.
2. Chamar `demands_get` e tratar a resposta como fonte principal para cadastro, especificação, checklist, jornadas, tarefas e notas.
3. Complementar somente quando necessário:
   - `demands_list_tasks` para filtrar ou conferir tarefas;
   - `demands_deadlines` para prazo e atraso na data de referência;
   - `demands_implementation_context` para contexto voltado à execução;
   - `applications_get_context` para explicar aplicação, componentes, repositórios, integrações e deployments afetados;
   - `demands_journey_calendar` para comparar a melhoria com um período mais amplo.
4. Aplicar [references/context-report.md](references/context-report.md).
5. Responder primeiro à pergunta do usuário e incluir somente o contexto adicional necessário.

## Qualificação da informação

Separar fatos registrados, cálculos derivados e leitura da situação. Usar o status oficial das tarefas e o campo `done` do checklist. Notas podem provar uma execução ou revelar divergência, mas não alteram sozinhas esses estados.

## Entrega

Começar com uma síntese de duas ou três frases. Depois apresentar somente os blocos úteis entre situação, escopo, tarefas, checklist, jornadas, histórico, topologia afetada e pontos de atenção. Indicar a data de referência ao mencionar prazo ou atraso.

Resumir especificações e notas extensas, preservando IDs, códigos, versões, ambientes e evidências necessários à rastreabilidade.

## Limites

- Não criar, atualizar, excluir ou adicionar notas.
- Não acessar produção, bancos ou servidores externos para preencher lacunas.
- Não transformar previsão em compromisso nem planejamento em execução efetiva.
- Não afirmar conclusão quando status, tarefas, checklist ou evidências divergirem.
