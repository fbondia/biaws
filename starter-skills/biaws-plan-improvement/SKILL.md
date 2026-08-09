---
name: biaws-plan-improvement
description: Decompor uma melhoria existente do Bondia Workspaces em tarefas pequenas, verificáveis e ordenadas, incluindo implementação, validação, atualização de versão, publicação e registro da publicação na topologia quando aplicáveis. Usar quando o usuário pedir para planejar, detalhar, criar, cadastrar, revisar ou completar as tarefas de uma melhoria.
---

# Planejar tarefas da melhoria

Transformar a melhoria em plano executável sem duplicar trabalho nem inventar topologia, ambientes ou políticas de versão. Usar o MCP `biaws` e seguir `biaws-operate-workspace`.

## Fluxo

### 1. Confirmar a melhoria

Resolver código ou ID com `demands_list`, chamar `demands_get` e usar `demands_implementation_context` quando for útil. Não planejar melhoria inexistente ou ambígua.

### 2. Reunir contexto técnico

1. Confirmar aplicação e componentes afetados.
2. Usar `applications_get_context`, `components_get`, `repositories_get` e `deployments_list` conforme necessário.
3. Quando houver checkout autorizado, respeitar `AGENTS.md` e inspecionar documentação, manifests, pipelines, arquivos de versão, código e testes.
4. Distinguir fatos, inferências e decisões pendentes.

Não criar tarefa de versão, publicação ou topologia sem evidência do componente, repositório e deployment correspondentes.

### 3. Reconciliar tarefas existentes

Usar `demands_list_tasks` e comparar resultado, componente e critério de conclusão. Classificar cada necessidade como já coberta, parcialmente coberta, nova ou bloqueada. Não criar duplicata apenas porque o título difere e não excluir tarefas existentes.

### 4. Elaborar o plano

Aplicar [references/task-lifecycle.md](references/task-lifecycle.md). Cada tarefa deve ter título no infinitivo, `situation` curta, descrição com origem e limites e especificação com componente/repositório, dependências, critérios, validações e evidências.

Omitir `status` para usar o padrão configurado quando não houver valor confirmado. Usar código e datas somente quando fornecidos ou exigidos por convenção comprovada. Registrar dependências na especificação, pois não há campo próprio.

### 5. Apresentar ou criar

Pedidos para planejar, sugerir, revisar ou detalhar autorizam somente apresentar o plano e o diff. Pedidos explícitos para criar, cadastrar ou completar tarefas autorizam `demands_create_task`.

Antes de cada criação, reler a lista quando houver risco de concorrência. Depois, verificar código, título, situação, descrição e especificação. Após timeout, pesquisar antes de repetir. Em falha parcial, parar, informar o que foi criado e não tentar rollback por exclusão.

## Saída

Informar tarefas preservadas, novas e bloqueadas; ordem e dependências; aplicação, componentes, repositórios, deployments e ambientes confirmados; tarefas de implementação, validação, versão, publicação e registro topológico; e IDs efetivamente criados.

## Limites

- Não implementar código, alterar versão, publicar artefatos ou atualizar deployments.
- Não criar publicação planejada na topologia para representar intenção futura.
- Não inventar ambiente, versão, responsável, prazo ou aprovação.
- Não marcar tarefas como concluídas durante o planejamento.
