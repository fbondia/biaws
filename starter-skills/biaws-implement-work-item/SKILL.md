---
name: biaws-implement-work-item
description: Implementar no checkout autorizado uma tarefa ou melhoria registrada no Bondia Workspaces, usando seu contexto, aplicação, componentes e repositórios, executando validações e registrando evidências. Usar quando o usuário pedir para desenvolver, corrigir, executar ou implementar uma tarefa específica ou uma melhoria; não usar para publicação ou deployment.
---

# Implementar item de trabalho

Executar uma mudança técnica rastreável e limitada ao item selecionado. Usar o MCP `biaws` para contexto operacional e seguir `biaws-operate-workspace`.

## Fluxo

### 1. Resolver o item exato

1. Localizar a melhoria com `demands_get`.
2. Usar `demands_list_tasks` e identificar a tarefa por ID, código ou título inequívoco.
3. Chamar `demands_implementation_context` para obter especificação, notas, checklist e demais tarefas.

Quando o pedido citar apenas a melhoria, respeitar as tarefas existentes e dependências. Implementar as tarefas prontas na ordem solicitada; não tratar “implementar a melhoria” como autorização para publicar ou concluir todos os registros.

### 2. Localizar o código

Usar aplicação e componentes afetados para consultar `applications_get_context`, `components_get` e `repositories_get`. Relacionar o repositório cadastrado ao checkout disponível; não escolher pasta apenas pelo nome.

Ler todos os `AGENTS.md` aplicáveis e inspecionar o estado do Git antes de editar. Preservar alterações preexistentes do usuário.

### 3. Confirmar escopo e critérios

Comparar solicitação, especificação, notas, código atual e testes. Separar requisitos confirmados, hipóteses e bloqueios. Se uma dúvida material alterar contrato, dados ou arquitetura, parar essa parte e pedir decisão.

Não ampliar o escopo para tarefas futuras de versão, publicação, registro topológico, documentação ou migração que já estejam separadas.

### 4. Implementar e validar

Fazer a menor mudança completa que satisfaça o item. Atualizar testes e documentação diretamente afetados. Executar as verificações proporcionais ao risco e registrar comandos e resultados reais.

Não mascarar testes falhos nem declarar validação que não foi executada. Distinguir falha introduzida, falha preexistente e verificação indisponível.

### 5. Registrar execução

Quando a implementação produzir resultado material, usar `demands_add_task_note` para registrar:

- resumo e comportamento entregue;
- arquivos, contratos ou componentes afetados;
- testes e resultados;
- evidências, revisão ou commit quando existentes;
- limitações, riscos e pendências reais.

Usar `demands_update_task_status` somente com um status configurado e confirmado. Marcar conclusão apenas quando critérios e validações do item estiverem satisfeitos. Se publicação fizer parte do mesmo critério e ainda não ocorreu, manter a tarefa aberta ou registrar claramente a pendência.

Após toda escrita operacional, reler a tarefa e verificar a persistência. Após timeout, reler antes de repetir.

## Entrega

Informar resultado implementado, arquivos alterados, validações, nota/status registrados e próximos itens já previstos. Não criar commit, push, release ou deployment sem pedido correspondente.

## Limites

- Não implementar tarefa ambígua ou bloqueada silenciosamente.
- Não alterar versão ou histórico de publicação como efeito colateral.
- Não acessar produção, segredos ou sistemas externos sem autorização específica.
- Não fechar a melhoria inteira; o MCP exposto não possui operação para isso.
