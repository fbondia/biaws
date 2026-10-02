# Auditoria funcional

## Objetivo

A trilha funcional identifica quem criou, alterou ou excluiu informações de
negócio, quando isso ocorreu e quais campos foram modificados. Ela atende
principalmente à governança operacional; eventos técnicos de login, sessão e
chaves permanecem fora desta primeira entrega.

## Modelo

Os eventos são armazenados em `auditEvents` e contêm:

- `actor`: identificador, nome, e-mail e método de autenticação;
- `action`: ação funcional estável;
- `target`: tipo, identificador e rótulo do elemento alterado;
- `rootType` e `rootId`: entidade principal em cuja linha do tempo o evento aparece;
- `occurredAt`: instante da alteração;
- `expiresAt`: data de expiração, presente somente quando a retenção é finita;
- `summary`: descrição curta;
- `changes`: caminhos dos campos com valores anterior e novo;
- `metadata`: contexto funcional adicional sanitizado.

Os documentos principais de issues, melhorias, procedimentos e conhecimento também preservam
`createdAt`, `createdBy`, `updatedAt` e `updatedBy` para consultas diretas. A
trilha de eventos é a fonte detalhada das alterações.

## Eventos instrumentados

| Domínio       | Eventos                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| Issues        | criação, atualização, mudança de status, classificação, taxonomia, comentário inicial e importação EML |
| Melhorias     | criação, atualização, reordenação e exclusão                                                           |
| Anotações     | inclusão, atualização e exclusão em melhorias e tarefas                                                |
| Tarefas       | criação, atualização, mudança de status e exclusão                                                     |
| Procedimentos | criação, atualização e exclusão                                                                        |
| Documentos    | criação, atualização, arquivamento, movimentação e observações                                         |
| Anexos        | inclusão, alteração de tags e exclusão em issues, melhorias e procedimentos                            |
| Skills        | publicação e descontinuação                                                                            |

Leituras não são auditadas nesta fase, pois não mudam a responsabilidade
funcional pelo conteúdo.

## Consulta e autorização

`GET /api/audit/:entityType/:entityId` retorna até 100 eventos por padrão e no
máximo 200. Os tipos aceitos são `issue`, `demand`, `task`, `procedure`,
`taxonomy` e `skill`.

Não existe acesso administrativo global à coleção por essa rota. O usuário deve
possuir a permissão de leitura da entidade correspondente. Eventos de tarefas
aparecem tanto no histórico da melhoria raiz quanto no histórico da própria
tarefa.

## Proteção e limites

- senhas, tokens, conteúdo Base64 de arquivos e campos técnicos de autoria/data
  não são copiados para as diferenças;
- strings são limitadas a 4.000 caracteres, arrays a 50 itens e objetos a seis
  níveis;
- anexos registram metadados, nunca o conteúdo binário;
- valores completos são mantidos apenas dentro desses limites para permitir a
  identificação funcional do que mudou.

## Retenção, índices e volume

A retenção é configurada por instância em `BIAWS_AUDIT_RETENTION_DAYS`, um inteiro
entre 0 e 3650. O padrão é `0`, que mantém a retenção indefinida. Um valor positivo
faz cada novo evento receber `expiresAt = occurredAt + dias de retenção`, usando
intervalos de 24 horas. O índice `audit_expiration` sobre `expiresAt`, com
`expireAfterSeconds: 0`, permite ao MongoDB excluir os documentos vencidos em
segundo plano. A exclusão não é instantânea e não arquiva o conteúdo.

Auditoria e monitoramento compartilham o cálculo de expiração. Monitoramento
usa `receivedAt` e uma política por runtime; auditoria usa `occurredAt` e a
política da instância. Documentos sem `expiresAt` não expiram.

Alterar a variável e recriar a API aplica a política aos novos eventos. Para
atribuir ou recalcular `expiresAt` do histórico existente, execute
[`scripts/recalculate-audit-retention.sh`](../../scripts/recalculate-audit-retention.sh).
Sem `--apply`, o script apenas inspeciona o banco, sem criar índices nem atualizar
documentos. Com `--apply`, recalcula em lotes de 500 registros e preserva
`occurredAt`. Datas ausentes ou que não sejam BSON Date são contadas em
`invalidOccurredAt` e ignoradas quando a retenção é positiva. Com retenção `0`,
remove `expiresAt` de todos os registros que ainda existam, inclusive daqueles
com data inválida.

O script é repetível e pode ser usado após alterações da política, inclusive
redução, ampliação ou desativação da retenção. Eventos já vencidos podem ser
excluídos durante a aplicação; aumentar o prazo não recupera eventos removidos.
Antes de aplicar, confira as contagens e faça backup. Veja os comandos e limites
em [`docs/operations.md`](../../docs/operations.md#retenção-de-auditoria).

Há índices por entidade raiz, alvo direto, ator e data. A consulta é limitada a
200 eventos para proteger a API e a UI. Antes de liberar consultas agregadas ou
grandes volumes, devem ser definidos paginação por cursor, política formal de
arquivamento.

## Comportamento em falha

A gravação do evento é síncrona e falhas não são ignoradas. Como a alteração de
domínio e o evento ainda não usam uma transação ou outbox comum, pode ocorrer de
a alteração ser persistida e a resposta retornar erro se a auditoria falhar
logo depois. O cliente deve atualizar a entidade antes de repetir uma mutação.

Se for necessário garantir atomicidade ou alta disponibilidade da auditoria,
a evolução recomendada é uma outbox transacional no MongoDB, com processamento
idempotente e monitoramento de pendências.
