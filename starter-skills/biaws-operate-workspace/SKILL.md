---
name: biaws-operate-workspace
description: Consultar e atualizar com segurança o contexto operacional mantido no Bondia Workspaces por meio das ferramentas MCP de workspaces, aplicações, topologia, issues, demandas, tarefas e procedimentos. Usar quando o usuário pedir para investigar, registrar, contextualizar, classificar ou atualizar trabalho operacional armazenado no Bondia Workspaces.
---

# Operar o Bondia Workspaces

Usar as ferramentas `biaws` de domínio; nunca acessar o MongoDB diretamente.

## Fluxo

1. Identificar o workspace e a aplicação relacionada antes de qualquer escrita.
2. Consultar o registro e o catálogo relacionado antes de inferir IDs, status, taxonomia ou tags.
3. Resumir o contexto encontrado e diferenciar fatos registrados de inferências.
4. Para consultas, responder diretamente com os IDs e estados relevantes.
5. Para escritas solicitadas, usar somente a ferramenta específica do domínio e reler o registro para verificar o resultado.

## Segurança

- Não solicitar nem registrar senhas, tokens, chaves privadas, connection strings ou kubeconfig.
- Não inventar IDs de aplicação, componente, taxonomia ou tag.
- Manter `dryRun` ativo ao analisar EML; efetivar a importação somente quando o usuário pedir.
- Pedir confirmação antes de exclusões ou alterações irreversíveis quando a intenção não estiver explícita.
- Não ampliar o workspace ou a aplicação além do escopo autenticado.
