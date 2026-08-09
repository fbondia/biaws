# Contrato de desenho do monitoramento

## Identidade do alvo

Registrar:

```text
Workspace: <id e nome>
Aplicação: <id, key e nome>
Componente: <id, key e nome>
Deployment: <id, key, ambiente e versão atual>
Runtime: <id, key, tipo e endpoint sanitizado>
Referência de emissão: <UUID estável ou caminho completo>
Confiança: <alta, média ou baixa>
Evidências: <catálogo e arquivos>
```

Preferir UUID quando mudanças de identificadores forem prováveis. O caminho `<aplicação>.<componente>.<deployment>.<runtime>` é legível, mas precisa ser atualizado quando qualquer key mudar.

## Perguntas de desenho

1. Qual decisão operacional este monitoramento deve permitir?
2. Qual falha ou degradação precisa ser percebida e em quanto tempo?
3. Qual fonte observa o comportamento: HTTP, processo, fila, banco, log, métrica, arquivo, cloud API ou outra?
4. A posição do emissor é autoritativa para concluir indisponibilidade?
5. Quais condições distinguem saudável, degradado, indisponível, parado e desconhecido?
6. Quais dependências devem aparecer no diagnóstico sem determinar sozinhas a saúde?
7. Onde e com qual identidade a ferramenta será executada?
8. Quem agenda, atualiza, observa e desativa a ferramenta?

## Mapeamento de estados

| Estado | Usar quando |
| --- | --- |
| `healthy` | A observação é recente, válida e satisfaz as condições normais. |
| `degraded` | O runtime responde, mas desempenho, capacidade ou dependência relevante viola um limiar confirmado. |
| `unavailable` | Uma observação autoritativa confirma que o runtime não presta o serviço esperado. |
| `stopped` | Há evidência explícita de parada intencional; não inferir de timeout. |
| `unknown` | A ferramenta não consegue concluir, os dados estão antigos ou a falha pode ser do ponto de observação. |

Definir precedência quando mais de uma condição ocorrer. Separar “probe falhou” de “alvo falhou”.

## Confiabilidade

Definir intervalo, timeout menor que o intervalo, quantidade de tentativas, backoff, jitter e janelas de confirmação. Usar histerese ou sucessos/falhas consecutivos quando necessário para evitar flapping.

Gerar `signalId` determinístico por fonte e evento ou janela de observação. Repetir o mesmo ID em retries; não gerar um ID novo a cada tentativa.

Usar o instante real da observação em `observedAt`. Sinais fora de ordem permanecem no histórico, mas não devem substituir saúde mais recente.

## Dados enviados

- `status` e `source`: obrigatórios.
- `message`: resumo curto e humano.
- `metadata`: dimensões pequenas, pesquisáveis, escalares ou arrays de escalares.
- `payload`: diagnóstico estruturado necessário à investigação.
- `metadataProfile`: usar somente perfil existente e compatível; omitir quando não confirmado.

Enviar o mínimo útil. Nunca enviar credenciais, headers de autorização, corpo sensível, dados pessoais desnecessários ou valores brutos de configuração.

## Seleção de tecnologia

Dar preferência, nesta ordem, à escolha explícita do usuário, à linguagem do componente, ao toolchain operacional já implantado e à opção com menor custo de manutenção. Avaliar disponibilidade no alvo, bibliotecas HTTP/observabilidade, empacotamento, testes, scheduler e política de dependências.

Apresentar pelo menos a alternativa recomendada e uma alternativa relevante quando houver trade-off real.

## Modelo da proposta

```markdown
### Alvo sugerido
<hierarquia, IDs, evidências e confiança>

### O que será observado
<fonte, condição normal, falhas detectadas e limites>

### Política de estados
<regras, precedência e tratamento de desconhecido>

### Ferramenta proposta
<linguagem, arquitetura, arquivos, dependências e configuração>

### Execução e envio
<scheduler, intervalo, timeout, retries, signalId e contrato BIAWS>

### Validação e operação
<testes, dry-run, logs, implantação, rollback e manutenção>

### Decisões pendentes
<somente escolhas materiais>
```
