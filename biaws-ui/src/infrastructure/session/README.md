# Sessão da UI

O módulo separa quatro responsabilidades:

- `httpAdapter.js` encapsula endpoints de autenticação, seleção persistida de
  workspace e a integração estreita com o cliente HTTP;
- `service.js` normaliza as transições `initializing`, `anonymous`,
  `authenticated`, `expired` e `error` sem depender do React;
- `SessionProvider.jsx` publica o estado e as operações pelo hook `useSession`;
- `runtime.js` conecta a instância padrão ao lifecycle do bootstrap;
- `scopedState.js` restaura os catálogos mutáveis aos defaults antes de outro
  escopo de sessão ser apresentado.

O Context permanece privado ao provider. Componentes não acessam storage,
cookies, tokens nem eventos globais de autenticação. Um `401` recebido pelo
cliente HTTP chama diretamente o callback instalado pelo adapter.

O runtime associa somente `actorId` e `workspaceId` ao logger já inicializado e
remove esse contexto quando o estado deixa de ser autenticado. A sessão recebe
o logger como dependência opcional do bootstrap; o logger continua utilizável
sem sessão e não importa este módulo.

O service publica eventos operacionais por um sink opcional, mantendo o contrato
de logging fora da sua implementação. São cobertos início/resultado de login e
logout, expiração, restauração inesperadamente falha, workspace persistido
rejeitado, troca concluída/revertida e resultado concorrente descartado. O sink
é best effort: sua falha nunca altera uma transição de sessão.

Durante a migração, o estado autenticado mantém `actor` como contrato de
compatibilidade da aplicação. Permissões, perfil e preferências continuam sendo
consumidores/dados funcionais externos ao lifecycle da sessão; o service não os
resolve nem os persiste. Logout, expiração e troca de workspace retiram a árvore
autenticada de renderização, descartando seu estado local antes de outro escopo
ser apresentado. Trocas concorrentes seguem `latest wins`: somente a operação
vigente pode publicar estado ou reverter a seleção para o último workspace cuja
restauração foi confirmada.

Testes unitários usam `testing.js`, que oferece um adapter falso sem importar o
runtime HTTP.
