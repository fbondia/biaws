---
name: biaws-release-improvement
description: Concluir a entrega de uma melhoria do Bondia Workspaces por meio das tarefas autorizadas de atualização de versão, publicação ou deployment e registro da publicação efetiva na topologia. Usar quando o usuário pedir para versionar, publicar, implantar, fazer release ou registrar uma versão publicada; exige evidência real e alvos inequívocos.
---

# Entregar e registrar melhoria

Tratar versionamento, publicação e registro topológico como etapas distintas. Usar o MCP `biaws`, seguir `biaws-operate-workspace` e executar efeitos externos somente quando o pedido os autorizar.

## Fluxo

### 1. Confirmar prontidão

Usar `demands_get`, `demands_list_tasks` e `demands_implementation_context`. Confirmar que implementação e validações exigidas estão concluídas por status e evidências, não apenas por texto otimista em uma nota.

Identificar a tarefa exata de versão, publicação ou registro. Parar diante de bloqueio, validação ausente ou divergência material.

### 2. Resolver os alvos

Confirmar aplicação, componente, repositório, artefato, ambiente e deployment com `applications_get_context`, `components_get`, `repositories_get`, `deployments_list` e `deployments_get`.

Não inferir ambiente ou deployment pelo nome do diretório. Para múltiplos destinos, tratar cada publicação separadamente.

### 3. Atualizar versão

Ler `AGENTS.md`, política de versionamento, manifests, changelog e pipeline do repositório. Determinar a próxima versão somente quando a política e o impacto forem claros. Se houver escolha material entre patch, minor, major ou esquema próprio, pedir decisão.

Alterar todos os arquivos de versão coerentes e executar verificações do projeto. Não criar commit, tag ou push sem autorização.

### 4. Publicar ou implantar

Executar somente o mecanismo real e autorizado do projeto. Confirmar versão, revisão, repositório, ambiente e alvo antes da operação. Capturar horário efetivo e evidência do resultado.

Não tratar build local, commit, tag ou upload intermediário como deployment concluído quando houver etapa posterior. Em falha, não registrar publicação `deployed`.

### 5. Registrar na topologia

Registrar somente depois da publicação bem-sucedida:

1. chamar `deployments_get` imediatamente antes da escrita;
2. verificar se já existe publicação `deployed` com a mesma versão e revisão;
3. chamar `deployments_record_publication` com `version`, `revision`, `repositoryId`, `status: "deployed"`, `publishedAt` efetivo e descrição concisa;
4. chamar `deployments_get` novamente e verificar a nova entrada e os campos materializados de versão, revisão e data.

Não enviar `recordedAt` ou `recordedBy` na nova entrada; o servidor os registra. Não criar entrada `planned` para representar intenção futura. Após timeout, reler antes de repetir para evitar duplicidade.

### 6. Atualizar a rastreabilidade

Adicionar notas às tarefas de versão, publicação e registro com as evidências correspondentes. Atualizar cada status somente com valor configurado e confirmado e apenas quando o resultado daquela tarefa estiver completo.

Se uma única tarefa misturar todas as etapas, registrar claramente quais ocorreram. Não afirmar que a melhoria inteira foi fechada, pois o MCP exposto não possui essa operação.

## Saída

Informar versão anterior e nova, revisão, componente, repositório, ambiente, deployment, evidência da publicação, entrada topológica criada e estado das tarefas. Distinguir com clareza ações executadas, pendentes e não autorizadas.

## Limites

- Não publicar sem pedido explícito e alvo inequívoco.
- Não inventar número de versão, revisão, horário, ambiente ou evidência.
- Não sobrescrever nem remover histórico de publicações.
- Não registrar sucesso após falha parcial ou validação inconclusiva.
- Não expor tokens, chaves, strings de conexão ou dados secretos de pipelines.
