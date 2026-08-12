# Bootstrap da infraestrutura

O bootstrap somente inicializa e compõe capacidades. Regras de logging, sessão
e mensagens permanecem nos respectivos diretórios e podem receber adapters
substitutos em testes.

## Ordem

1. `logging`: inicializa primeiro e não depende da sessão;
2. `session`: restaura a identidade antes da aplicação;
3. `messages`: prepara feedback e loading transversal;
4. `AccessibilityProvider` → `LoadingProvider` → `AuthGate`;
5. aplicação e providers de domínio.

As capacidades de bootstrap são declaradas na ordem em que inicializam. Uma
falha não impede capacidades independentes de inicializar. Falhas não críticas
produzem o estado `degraded`; falhas críticas produzem `failed`. Dependências
declaradas por `dependsOn` são bloqueadas quando a capacidade requerida falha.

O `InfrastructureProvider` não publica um contexto agregado. Cada capacidade
mantém seu próprio contrato, lifecycle e eventual integração com React.

Nesta etapa, os adapters padrão de `session` e `messages` são placeholders de
lifecycle: eles estabelecem contratos substituíveis, mas ainda não controlam os
fluxos reais. `AuthGate` continua responsável pela sessão até `CLEAN-02`, e
`LoadingProvider` continua responsável pelo loading até `CLEAN-03`.

No descarte, todas as capacidades inicializadas recebem uma tentativa em ordem
reversa, mesmo quando uma delas falha. O executor agrega essas falhas em um
`AggregateError`; o provider captura a rejeição e pode encaminhá-la por
`onDisposeError` sem interromper os demais cleanups.
