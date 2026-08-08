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

Nesta versão, a retenção é indefinida e não existe índice TTL. A exclusão
automática só deve ser introduzida após uma política institucional de retenção,
evitando perda silenciosa de evidência de governança.

Há índices por entidade raiz, alvo direto, ator e data. A consulta é limitada a
200 eventos para proteger a API e a UI. Antes de liberar consultas agregadas ou
grandes volumes, devem ser definidos paginação por cursor, política formal de
retenção e arquivamento.

## Comportamento em falha

A gravação do evento é síncrona e falhas não são ignoradas. Como a alteração de
domínio e o evento ainda não usam uma transação ou outbox comum, pode ocorrer de
a alteração ser persistida e a resposta retornar erro se a auditoria falhar
logo depois. O cliente deve atualizar a entidade antes de repetir uma mutação.

Se for necessário garantir atomicidade ou alta disponibilidade da auditoria,
a evolução recomendada é uma outbox transacional no MongoDB, com processamento
idempotente e monitoramento de pendências.
