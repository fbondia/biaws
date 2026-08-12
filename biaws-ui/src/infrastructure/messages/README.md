# Mensagens e feedback

`MessagesProvider` publica um contrato transversal pequeno por `useMessages`:

- `info`, `success`, `warning` e `error` exibem feedback descartável em uma
  região `aria-live`;
- `startLoading` devolve um handle idempotente e `run` sempre encerra somente a
  operação que iniciou, preservando retorno e erro;
- loading bloqueante impede interação; `{ blocking: false }` apresenta apenas
  status de segundo plano;
- `confirm` e `prompt` são assíncronos e serializados. Seus textos são opções do
  chamador, permitindo tradução sem alterar a infraestrutura;
- prompts limpam o valor ao trocar/fechar o diálogo. Senhas devem usar
  `inputType: "password"` e um `autoComplete` apropriado.

O provider usa os diálogos modais reconhecidos pelo `AccessibilityProvider`,
que centraliza foco inicial, contenção por Tab, cancelamento por Escape e retorno
do foco. O botão de cancelar recebe o foco inicial em confirmações destrutivas.

As camadas transversais seguem os tokens `--z-preview` <
`--z-message-dialog` < `--z-loading` < `--z-notice`. Assim, uma confirmação
aberta dentro de qualquer modal consumidor permanece operável, o loading
bloqueante cobre a confirmação durante a operação e notices continuam visíveis.
O teste DOM usa `jsdom` somente em desenvolvimento para validar essa integração
contra os estilos reais, sem impacto no bundle da aplicação.

Chamadas HTTP usam `defaultMessagesService` diretamente para que loading exista
fora do React. Componentes usam somente `useMessages`; nenhuma camada converte
erros técnicos em sucesso ou os captura dentro de `run`.

Testes podem criar uma instância isolada por `createMessagesTestService`, sem
timers reais nem estado compartilhado.
