---
name: biaws-create-improvement
description: Investigar uma solicitação funcional, operacional ou técnica, estruturá-la como melhoria vinculada a uma aplicação e seus componentes e, quando solicitado, criá-la no Bondia Workspaces. Usar quando o usuário pedir para propor, estruturar, cadastrar ou criar uma melhoria a partir de ideia, issue, requisito, reunião, e-mail, incidente recorrente ou modernização.
---

# Criar melhoria

Criar uma melhoria compreensível, rastreável e pronta para planejamento. Usar o MCP `biaws`, seguir `biaws-operate-workspace` e não depender de nomes, caminhos ou componentes específicos de um produto.

## Fluxo

### 1. Interpretar a origem

Identificar problema atual, resultado esperado, usuários ou operação afetados, origem, restrições, dependências, código, prazo e estimativa fornecidos. Preservar referências a issues, mensagens, documentos e decisões.

Distinguir fatos fornecidos, fatos verificados, inferências e pontos sujeitos a validação. Não inventar responsável, aprovação, compromisso, data ou solução fechada.

### 2. Resolver o contexto operacional

1. Usar `workspaces_list` e `workspaces_get` quando o workspace não estiver inequívoco.
2. Usar `applications_list`, `applications_get` e `applications_get_context` para confirmar a aplicação.
3. Identificar componentes realmente afetados com `components_list` e `components_get`.
4. Consultar repositórios, integrações e deployments somente quando ajudarem a determinar impacto ou restrições.

Não criar a melhoria sem `applicationId`. Não associar componente apenas por semelhança de nome.

### 3. Pesquisar precedentes

Usar `demands_list` na mesma aplicação para encontrar melhorias comparáveis ou possíveis duplicatas. Consultar as mais aderentes com `demands_get`. Reutilizar o nível de detalhe, sem copiar requisitos, escopo ou estimativas.

Parar para orientação quando houver provável duplicidade ou conflito material.

### 4. Investigar fontes locais

Quando houver checkout autorizado, ler `AGENTS.md`, documentação, manifests e código relevantes. Usar `rg` para confirmar componentes, contratos, dados, integrações, testes e implantação afetados. Registrar divergências entre documentação e comportamento executável.

### 5. Elaborar a melhoria

Seguir [references/specification-standard.md](references/specification-standard.md). Produzir título orientado ao resultado, descrição curta, aplicação, componentes afetados, seções ordenadas com IDs estáveis e estimativas/datas somente quando sustentadas.

Usar o status configurado padrão omitindo `status`, salvo instrução explícita. Usar `estimatedJourneys: 0` apenas quando a melhoria ainda não estiver estimada e declarar isso na seção de esforço; nunca apresentar zero como estimativa confirmada.

### 6. Revisar e escrever

Verificar aderência, duplicidade, limites, critérios verificáveis, impactos, premissas e consistência entre `estimatedJourneys` e a especificação.

Pedidos para propor, analisar ou rascunhar autorizam somente apresentar o conteúdo. Pedido explícito para criar ou cadastrar autoriza `demands_create` sem confirmação redundante.

Após criar, chamar `demands_get`, conferir aplicação, componentes, descrição, seções e estimativa e informar ID/código, título, estado, impactos e lacunas. Após timeout ou resposta ambígua, pesquisar antes de repetir.

## Limites

- Não usar `issues_create` para representar melhoria.
- Não acessar produção ou bancos externos ao contexto autorizado.
- Não afirmar ausência de impacto sem investigar aplicação e componentes.
- Não criar tarefas nesta skill; usar `biaws-plan-improvement`.
