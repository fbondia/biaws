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
