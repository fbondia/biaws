# Ciclo de tarefas da melhoria

Criar somente tarefas com resultado independente e evidência própria. Não transformar cada arquivo ou passo mecânico em tarefa.

## Ordem típica

1. **Validação ou decisão pendente** — somente quando uma dúvida material impedir implementação segura.
2. **Implementação** — separar por componente ou resultado validável de forma independente.
3. **Validação integrada** — separar quando exigir ambiente, equipe ou evidência distinta dos testes da implementação.
4. **Atualização de versão** — criar por componente versionado quando a política exigir nova versão após aprovação.
5. **Publicação ou deployment** — criar por artefato e destino confirmados quando for distinta da atualização de versão.
6. **Registro da publicação na topologia** — criar por deployment depois da publicação efetiva.
7. **Verificação pós-publicação** — criar quando houver checagens operacionais independentes.

Omitir categorias não aplicáveis.

## Implementação

Incluir comportamento atual e esperado, componente, repositório, contratos, compatibilidade, testes e evidências. Não prescrever arquivos não verificados.

## Versão

Criar somente com evidência de versionamento. Exigir implementação e validação concluídas, política confirmada e versão atual conhecida. Não antecipar o próximo número quando a política ou o impacto forem ambíguos.

## Publicação

Identificar componente, artefato, repositório, ambiente e deployment confirmados. Exigir evidência do processo realmente usado e do resultado. Commit, tag ou pacote local não provam deployment quando houver etapa posterior.

## Registro topológico

Criar tarefa distinta da publicação e exigir `deploymentId`, versão, revisão quando disponível, repositório, ambiente, horário efetivo e evidência.

O executor deve reler `deployments_get` e acrescentar uma entrada `deployed` ao histórico append-only de `publications` usando `deployments_update`. Nunca registrar antes da publicação nem usar entrada `planned` como substituto da tarefa.

## Modelo mínimo

```markdown
## Resultado esperado
<resultado único e verificável>

## Contexto técnico
- Aplicação: `<id e nome>`
- Componente: `<id e nome>`
- Repositório/deployment: `<id confirmado ou não informado>`

## Dependências
- `<tarefa, decisão ou evidência anterior>`

## Critérios de conclusão
- `<condição verificável>`

## Evidências esperadas
- `<teste, versão, pipeline, publicação ou registro>`
```
