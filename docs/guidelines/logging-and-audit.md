# Logging e auditoria

Logging técnico e auditoria funcional têm finalidades diferentes. Uma operação
pode precisar dos dois, mas um não substitui o outro.

| Mecanismo           | Pergunta respondida                     | Público principal            |
| ------------------- | --------------------------------------- | ---------------------------- |
| log técnico         | o que ocorreu nesta execução e por quê? | operação e desenvolvimento   |
| auditoria funcional | quem alterou qual recurso de negócio?   | administração e conformidade |

## Logging estruturado

A API escreve um objeto JSON por linha. Use o logger comum em código de runtime;
`console.*` é reservado à implementação do logger e à saída intencional de
scripts/CLI.

Cada evento contém automaticamente:

- `timestamp`;
- `level`;
- `service`;
- `event`.

Inclua quando aplicável:

- `requestId`;
- `actorId` e `authenticationMethod`;
- `workspaceId` e `applicationId`;
- ID do agregado afetado;
- `statusCode`, `durationMs` e contagens;
- resultado de retry, fallback ou idempotência.

Não inclua contexto apenas porque está disponível. Cada campo aumenta exposição,
volume e custo de retenção.

## Nomes e severidade

Eventos usam `snake_case` e descrevem um fato, por exemplo:

- `http_request_completed`;
- `http_request_rejected`;
- `http_request_failed`;
- `server_started`.

| Nível   | Uso                                             |
| ------- | ----------------------------------------------- |
| `info`  | ciclo normal relevante ou conclusão             |
| `warn`  | rejeição esperada, fallback ou estado degradado |
| `error` | falha inesperada ou indisponibilidade           |

Não eleve todo `4xx` a erro operacional. Também não reduza falhas `5xx` a uma
mensagem genérica sem exceção no log interno.

## Correlação e erros

- preserve um `X-Request-Id` válido recebido ou gere UUID;
- propague o ID em chamadas distribuídas sob controle do sistema;
- registre a exceção serializada somente no log interno;
- retorne `requestId` na resposta de erro para suporte;
- preserve `cause` ao encapsular exceções;
- stack e detalhes de banco/storage nunca entram na resposta pública.

## Dados proibidos

Nunca registre:

- senha, token, cookie, chave de API ou connection string;
- header `Authorization`;
- corpo completo de request ou query string sem seleção explícita;
- EML, conteúdo de anexo ou payload binário;
- dados pessoais desnecessários;
- metadata com semântica de segredo.

Use a sanitização central, mas não trate redaction como autorização para logar
payloads completos. Prevenção na origem é a primeira barreira.

## Auditoria funcional

Registre auditoria para:

- criação, alteração, arquivamento ou remoção de agregado;
- mudanças de identidade, grupo, permissão ou chave;
- importações efetivas;
- comentários, tarefas e anexos quando fizerem parte do histórico do domínio;
- publicação de artefato ou mudança operacional relevante.

O evento deve identificar:

- ator;
- ação;
- `target` e, para filhos, `root`;
- resumo legível;
- estado anterior/posterior ou delta sanitizado;
- metadata mínima para localizar workspace, aplicação e agregado.

Não registre auditoria de dry run. Registre somente depois de a mutação ter sido
confirmada. Se auditoria e mutação não forem transacionais, não esconda a
limitação.

## Observabilidade de novos fluxos

Ao adicionar integração, job futuro ou processamento assíncrono, defina antes:

- eventos de início, conclusão e falha;
- ID estável de execução/idempotência;
- duração e contagens úteis;
- política de retry e como cada tentativa aparece no log;
- quais dados serão deliberadamente omitidos;
- sinal ou métrica que indica degradação.

## Checklist

- [ ] evento tem nome estável e nível correto
- [ ] request e agregado podem ser correlacionados
- [ ] exceção original está no log interno
- [ ] nenhum segredo ou payload completo é registrado
- [ ] resposta pública está sanitizada
- [ ] mutação relevante possui auditoria
- [ ] dry run não produz auditoria de alteração
