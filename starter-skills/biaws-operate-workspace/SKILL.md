---
name: biaws-operate-workspace
description: Consultar e atualizar com segurança o contexto operacional mantido no Bondia Workspaces por meio das ferramentas MCP de workspaces, aplicações, topologia, issues, demandas, tarefas e documentos. Usar quando o usuário pedir para investigar, registrar, contextualizar, classificar ou atualizar trabalho operacional armazenado no Bondia Workspaces.
---

# Operar o Bondia Workspaces

Usar os resources e as ferramentas `biaws` de domínio; nunca acessar o MongoDB diretamente.

## Fluxo

1. Identificar o workspace e a aplicação relacionada antes de qualquer escrita.
2. Para registros conhecidos, preferir os resources `biaws://workspaces/{workspaceId}/...`; consultar os templates, seguir links de filhos e paginação. Usar tools para buscas, filtros, cálculos e escritas. Consultar o registro e o catálogo relacionado antes de inferir IDs, status, taxonomia ou tags.
3. Resumir o contexto encontrado e diferenciar fatos registrados de inferências.
4. Para consultas, responder diretamente com os IDs e estados relevantes.
5. Para escritas solicitadas, usar somente a ferramenta específica do domínio e reler o registro para verificar o resultado.

## Monitoramento passivo

- A plataforma não executa monitoramentos; agentes externos enviam a saúde de
  runtimes pelo endpoint ou por `biaws monitoring signal`.
- Ao emitir um sinal solicitado, confirmar workspace, aplicação e runtime antes
  do envio, usar `signalId` estável para idempotência e nunca incluir segredos em
  `metadata`.
- Não inferir que `GET /api/health` representa a saúde das aplicações.

## Segurança

- Não solicitar nem registrar senhas, tokens, chaves privadas, connection strings ou kubeconfig.
- Não inventar IDs de aplicação, componente, taxonomia ou tag.
- Manter `dryRun` ativo ao analisar EML; efetivar a importação somente quando o usuário pedir.
- Pedir confirmação antes de exclusões ou alterações irreversíveis quando a intenção não estiver explícita.
- Não ampliar o workspace ou a aplicação além do escopo autenticado.

## Leituras e compatibilidade

Os segmentos de entidades aceitam ID ou identificador aplicável; usar os IDs canônicos retornados para as referências seguintes. O workspace da URI precisa corresponder ao workspace configurado no MCP. Se o cliente não suportar resources, usar as tools de leitura existentes. Para classificar issues, ler a issue e o catálogo aplicável, produzir a recomendação por análise do agente e usar `issues_classify` quando a escrita estiver autorizada.
