# Code review

O objetivo da revisão é encontrar riscos concretos e confirmar que a mudança é
compreensível, testável e operável. Estilo automatizável deve ser resolvido pelas
ferramentas, não dominar a revisão humana.

## Ordem de revisão

1. Entenda o problema, o resultado esperado e o escopo do diff.
2. Identifique módulos, contratos e documentos afetados.
3. Revise segurança, tenancy e compatibilidade antes de detalhes internos.
4. Verifique comportamento, erros, concorrência e efeitos colaterais.
5. Avalie testes e documentação.
6. Execute ou confirme as validações proporcionais ao risco.

## Severidade

| Nível | Significado                                                                   |
| ----- | ----------------------------------------------------------------------------- |
| P0    | perda/exposição de dados, falha de segurança grave ou indisponibilidade ampla |
| P1    | bug provável em fluxo comum, quebra de contrato ou isolamento                 |
| P2    | risco de manutenção, cobertura incompleta ou comportamento de borda relevante |
| P3    | melhoria opcional de clareza, consistência ou ergonomia                       |

Tamanho de arquivo, preferência de nome e estilo não são automaticamente P1/P2.
Explique o comportamento ou risco que torna o achado relevante.

## Checklist global

- o diff resolve o problema declarado sem ampliar desnecessariamente o escopo;
- nomes e estrutura seguem as guidelines;
- não há duplicação importante ou dependência nova sem justificativa;
- erros preservam causa internamente e são seguros externamente;
- mudanças comportamentais possuem testes;
- documentação relacionada foi revisada;
- não há segredo, dado real, dump, EML ou artefato gerado;
- migração, compatibilidade e rollback foram considerados.

## API e dados

- permissão correta em toda rota;
- `workspaceId` e escopo de aplicações derivados do ator;
- referências cruzadas validadas no mesmo tenant;
- payload normalizado e limitado;
- listagens paginadas e ordenadas deterministicamente;
- índice acompanha filtro/ordenação;
- concorrência, idempotência e unicidade tratadas;
- mutação auditada;
- resposta não expõe BSON ou detalhes internos.

## UI

- estados de loading, vazio, erro e sucesso;
- efeito e cleanup corretos;
- respostas assíncronas não sobrescrevem estado mais novo;
- teclado, foco, semântica e layout mobile;
- regra pura separada de JSX quando melhora teste/manutenção;
- permissão na UI é UX, com enforcement correspondente no backend;
- CSS usa tokens, escopo e cascata previstos.

## MCP e CLI

- tool/comando representa operação intencional;
- schema, help, defaults e limites correspondem ao comportamento;
- `--json` é estável e não se mistura com texto humano;
- erro HTTP útil é preservado sem segredo;
- paths e pacotes locais são validados;
- documentação e testes acompanham novo contrato.

## Como escrever um achado

Um achado acionável contém:

- arquivo e linha;
- cenário que ativa o problema;
- impacto observável;
- correção ou direção de correção viável.

Exemplo:

```text
[P1] Filtrar a atualização pelo workspace efetivo

O update usa apenas o ID público. Uma identidade do workspace A que descubra o
ID de um registro do workspace B pode alterá-lo. Inclua workspaceId no filtro e
adicione um teste de negação entre tenants.
```

Evite comentários vagos como “refatore”, “adicione validação” ou “isso pode dar
problema” sem cenário e impacto.

## Resultado da revisão

Apresente primeiro os achados em ordem de severidade. Depois registre dúvidas,
lacunas de teste e resumo. Se não houver achados, diga isso explicitamente e
mencione riscos residuais ou validações não executadas.
