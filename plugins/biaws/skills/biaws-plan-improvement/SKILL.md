---
name: biaws-plan-improvement
description: Decompor uma melhoria BIAWS existente em tarefas verificáveis e ordenadas e registrar o planejamento autorizado.
---

# Planejar uma melhoria

Resolva a melhoria e leia `demands_get`, `demands_list_tasks` e, quando útil,
`demands_implementation_context`. Confirme aplicação/componentes e evidências
de repositório/deployment por `applications_get_context` e listas de topologia.

Reutilize tarefas existentes; compare códigos, resultados, dependências e notas
antes de acrescentar. Cada tarefa deve produzir resultado independente e
verificável, com contexto, critérios, dependências e evidência esperada.
Separe implementação, validação integrada, versão, publicação e registro
topológico apenas quando aplicáveis. Não transforme cada arquivo em uma tarefa.

Pedidos para planejar ou detalhar autorizam proposta. Se o usuário pedir para
criar/registrar as tarefas, use `demands_create_task` ou atualização específica
sem aprovação redundante. Não invente prazo, responsável, estimativa ou número
de versão. Omitir status usa o padrão configurado. Releia as tarefas após cada
escrita e confira escopo, ordem e critérios. Em timeout, releia antes de repetir.

Tarefas de publicação precisam de artefato e destino confirmados; não inferir
deployment por nome. Código/commit/build local não provam publicação.
Registros topológicos de publicação exigem evidência real e leitura prévia do
deployment. A skill só planeja; não executa código, publica nem muda status de
execução por intenção. Siga biaws-operate-workspace incluída.
