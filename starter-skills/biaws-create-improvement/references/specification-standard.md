# Padrão da especificação de melhoria

Criar cada seção como item de `specificationSections` com `id` estável, `title`, conteúdo Markdown e `order` sequencial. Preferir `default-1` a `default-6` para as seções padrão.

## 1. Objetivo

Explicar problema, público ou operação afetada e resultado esperado. Evitar histórico longo e decisão técnica não validada.

## 2. Escopo de Atuação

Separar itens no escopo e fora do escopo. Tratar incertezas como premissas ou validações pendentes.

## 3. Impacto no Sistema

Montar a matriz dinamicamente a partir da topologia:

| Aplicação/componente/recurso | Impacto | Evidência |
| --- | --- | --- |
| `<item confirmado>` | `<efeito concreto>` | `<fonte ou caminho>` |

Considerar componentes, repositórios, dados, infraestrutura, integrações, segurança, observabilidade, documentação e operação somente quando aplicáveis. Não manter linhas fixas de um produto nem usar apenas rótulos baixo/médio/alto.

## 4. Considerações

Registrar premissas, dependências, compatibilidade, riscos, rollback, segurança, observabilidade, decisões pendentes e evidências esperadas. Omitir itens genéricos.

## 5. Esforço

Apresentar jornadas somente quando houver base suficiente. Separar etapas relevantes, indicar premissas e garantir que o total seja igual a `estimatedJourneys`.

Não impor percentuais ou fases específicos de um workspace. Se ainda não houver estimativa, declarar `Estimativa pendente` e usar `estimatedJourneys: 0` apenas para o contrato de criação.

## 6. Plano de Entregas

Descrever resultados verificáveis e sua ordem de dependência em nível de entrega. Não substituir o planejamento detalhado de tarefas. Usar fases somente quando reduzirem risco ou permitirem validação incremental.

## Seções adicionais

Adicionar apenas quando necessárias, por exemplo: Contexto Atual, Regras de Negócio, Alterações Técnicas, Integrações, Migração de Dados, Segurança, Observabilidade, Critérios de Aceite, Transição ou Rollback.

Usar requisitos testáveis, nomes confirmados e referências rastreáveis. Marcar hipóteses com `avaliar`, `validar` ou `premissa`.
