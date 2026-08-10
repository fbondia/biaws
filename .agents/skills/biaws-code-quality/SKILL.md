---
name: biaws-code-quality
description: Executar passadas incrementais de qualidade de código em projetos registrados no Bondia Workspaces, usando o MCP BIAWS para manter a melhoria e suas tarefas como memória operacional. Usar para auditar aderência a guidelines, produzir relatórios de achados, implementar refatorações priorizadas, executar sonar-analysis.sh e tratar issues Sonar Blocker ou High em ciclos sucessivos.
---

# Qualidade de código no BIAWS

Executar uma passada coerente de qualidade por invocação. Usar a melhoria e as
notas das tarefas no BIAWS como memória durável do diagnóstico, das correções e
das pendências.

## Regras operacionais

1. Ler `AGENTS.md`, quando existir, e as instruções do repositório antes de agir.
2. Usar somente as ferramentas MCP BIAWS para consultar ou atualizar a melhoria.
   Nunca acessar o banco diretamente.
3. Resolver workspace e aplicação com `workspaces_list` e `applications_list`.
   Não inventar IDs.
4. Localizar a melhoria pelo código `QA-2026-08-10`. Se estiver ausente, criar
   **Análise de Qualidade** na aplicação do projeto com as duas tarefas descritas
   abaixo. Se houver mais de um resultado, parar e pedir a escolha do registro.
5. Reler a melhoria e suas tarefas antes de cada passada. Preservar notas e
   pendências existentes; nunca substituir a memória anterior por um resumo
   menor.
6. Inspecionar `git status` antes de editar e preservar alterações não
   relacionadas. Não criar commit, push ou PR sem pedido explícito.
7. Registrar uma nota na tarefa ao fim de toda passada, inclusive quando houver
   bloqueio. Não registrar segredos, tokens, payloads reais ou logs sensíveis.

## Selecionar a próxima passada

Priorizar nesta ordem:

1. corrigir risco de perda/exposição de dados, segurança ou isolamento;
2. concluir o relatório-base de aderência;
3. tratar achados P1 e depois P2 em lotes pequenos e verificáveis;
4. tratar P3 quando estiver no mesmo escopo de uma correção necessária;
5. iniciar Sonar somente depois de concluída a etapa de aderência;
6. tratar Sonar por severidade: Blocker antes de High.

Fazer no máximo um lote coeso por passada. Se o pedido disser apenas para
analisar, não editar código. Se pedir continuidade ou correção, escolher a
próxima pendência registrada e implementar até um ponto verificável.
Achados com a mesma causa raiz podem ser tratados juntos quando formarem uma
única correção pequena e compartilharem a mesma validação.

## Tarefa 1 — Aderência às guidelines

### Análise inicial ou reavaliação

1. Ler `docs/guidelines/INDEX.md`, todas as guidelines aplicáveis e as instruções
   locais referenciadas por elas. Dar atenção especial a
   `docs/guidelines/ui-development.md` quando houver UI.
2. Mapear módulos, scripts de validação, testes e estrutura do código.
3. Verificar por evidência:
   - direção das dependências e separação entre UI, API, MCP, CLI e `shared/`;
   - autenticação, autorização, tenancy, validação, limites e auditoria;
   - hooks, efeitos, concorrência, debounce, rollback e cleanup;
   - semântica, teclado, foco, nomes acessíveis e mensagens de erro;
   - tokens, escopo CSS, cascata, breakpoints e responsividade;
   - extração e testes de lógica pura;
   - dependências, logging, contratos e documentação.
4. Executar os comandos prescritos em `docs/guidelines/change-checklist.md` para
   os módulos aplicáveis. Declarar testes ignorados e validações não executadas.
5. Produzir o relatório com:
   - achados P0–P3 em ordem de severidade;
   - arquivo e linha;
   - cenário, impacto e direção de correção;
   - panorama por área;
   - comandos executados, resultados e limitações.
6. Adicionar à tarefa uma nota com o resumo do relatório e um backlog ordenado.

### Passadas de implementação

1. Escolher o achado de maior prioridade ainda pendente e confirmar que continua
   válido no código atual.
2. Implementar a menor correção completa que preserve contratos públicos.
3. Incluir teste de regressão ou validação proporcional ao risco.
4. Executar formatação, checks, testes e build dos módulos alterados.
5. Revisar o diff e registrar na tarefa:
   - achados tratados e arquivos alterados;
   - decisões e riscos residuais;
   - validações e resultados;
   - pendências reordenadas e próxima ação recomendada.
6. Marcar a tarefa como concluída somente quando não restarem achados P0–P2,
   as validações aplicáveis passarem e limitações manuais estiverem registradas.

## Tarefa 2 — Sonar Blocker e High

Iniciar somente depois da conclusão da tarefa de aderência.

1. Localizar e ler `sonar-analysis.sh` antes de executá-lo.
2. Executar `bash sonar-analysis.sh` na raiz do projeto. Não imprimir nem copiar
   tokens do ambiente.
3. Confirmar que testes e análise terminaram; registrar falhas de infraestrutura
   separadamente de falhas do código.
4. Consultar o resultado Sonar pelo mecanismo já mantido no projeto e levantar
   issues abertas com severidade legada `BLOCKER` e/ou impacto `HIGH`, conforme
   os campos expostos pela instância. Registrar a taxonomia usada e agrupar por
   causa raiz.
5. Corrigir um lote coeso, começando por Blocker. Evitar silenciar regra ou usar
   exclusão sem justificativa técnica registrada.
6. Executar os testes afetados e repetir a análise quando viável.
7. Adicionar nota com contagens antes/depois, issues tratadas, validações,
   pendências e próxima ação.
8. Concluir a tarefa somente com zero issues abertas Blocker/High e análise final
   bem-sucedida.

## Formato da memória de execução

Adicionar notas com esta estrutura:

```markdown
## Passada AAAA-MM-DD HH:mm

- Tipo: análise | implementação | sonar
- Escopo: módulos e achados/issues tratados
- Estado inicial: resumo e contagens relevantes
- Ações: inspeções ou alterações realizadas
- Validação: comandos e resultados
- Concluído: itens encerrados nesta passada
- Pendente: backlog priorizado restante
- Próxima ação: menor passo recomendado
```

Usar `demands_add_task_note` para a nota. Reler com `demands_get` ou
`demands_list_tasks` e confirmar que a atualização ficou persistida.

## Estrutura esperada da melhoria

Criar somente se o código ainda não existir:

- título: `Análise de Qualidade`;
- código: `QA-2026-08-10`;
- descrição: ciclo incremental de auditoria, refatoração e Sonar;
- tarefa `QA-GUIDELINES`: auditar e corrigir aderência às guidelines;
- tarefa `QA-SONAR`: executar `sonar-analysis.sh` e zerar Blocker/High.

Na criação, usar especificação em Markdown que registre a ordem das etapas, os
critérios de conclusão e o uso das notas como memória. Omitir status quando o
valor vigente não tiver sido consultado.
