# Logging da UI

`defaultLogger` é um service independente do React e inicializado como a
primeira capacidade transversal. Consumidores registram eventos estáveis no
formato `dominio.acao.resultado`; mensagens ao usuário, analytics e auditoria
continuam em contratos separados.

O pipeline limita profundidade, chaves, arrays, strings e volume por janela. A
sanitização remove credenciais e omite payloads, headers e bodies completos
antes de qualquer transport. Erros preservam nome, mensagem, código, status,
stack e causa depois da sanitização.

O transport de console é habilitado somente pelo runtime de desenvolvimento.
Falhas síncronas ou assíncronas de transport são contidas e contabilizadas em
`getDiagnostics()`; nunca geram outro log. Novos transports devem implementar
`write(record)` e, opcionalmente, `flush()`.

O runtime de sessão acrescenta `actorId` e `workspaceId` quando autenticado e os
remove durante logout, expiração e troca de workspace. Essa integração é
explícita: o logger não importa nem depende do serviço de sessão.

## Eventos operacionais

O serviço de sessão emite por um sink opcional os eventos relevantes de
restauração, login, logout, expiração, seleção e troca de workspace. Credenciais,
e-mail, token e payload de autenticação não fazem parte desse contrato.

O adapter de bootstrap conecta as fronteiras globais `error` e
`unhandledrejection` do browser enquanto a infraestrutura está ativa e remove os
listeners no descarte. Essas fronteiras registram apenas falhas que escaparam do
fluxo local; erros já tratados devem ser registrados na camada com contexto e
não relançados apenas para produzir outro evento.

O cliente HTTP registra somente negação de acesso (`403`), timeout/rate limit
(`408`/`429`), falhas de servidor (`5xx`) e transporte/rede. O contexto contém
apenas método, path sem query string, duração, status e correlação local; corpos,
headers, params e respostas são omitidos. `401` pertence ao ciclo de sessão e
os endpoints de restauração/login/logout pertencem integralmente ao serviço de
sessão para evitar duplicação. Erros de validação/negócio esperados não geram
log operacional automático.

Navegação, renders, cliques, sucessos HTTP rotineiros e polling não são
registrados. Um consumidor de domínio só deve acrescentar outro evento quando
descrever um fato diferente, como adoção de fallback ou rollback.
