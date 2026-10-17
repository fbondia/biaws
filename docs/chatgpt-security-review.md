# Revisão explícita de segurança — CHATGPT-PLUGIN/P15

Escopo: OAuth/contas, delegação, tenancy, MCP HTTP, interface de consentimento,
CLI, proxy/Docker e empacotamento. Revisão do código pelo executor, acompanhada
de testes; não representa certificação externa nem revisão do catálogo.

## Fronteiras revisadas

| Fronteira             | Verificação e resultado                                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login e consentimento | Conta/sessão existentes; query assinada, PKCE S256, escolha de workspace acessível, recusa e proteção de Origin                                                            |
| Token externo → MCP   | Issuer, assinatura/chaves, audience, expiração, cliente, scopes e concessão; token de outra instância rejeitado                                                            |
| MCP → API             | Segredo dedicado identifica o serviço; token opaco interno com hash/TTL e audience própria; nunca encaminha o token externo às rotas de domínio                            |
| Identidade e tenancy  | Contexto por requisição; duas concessões da mesma conta, outros usuários, aplicações e duas instâncias; permissões atuais são reavaliadas                                  |
| Privilégios           | mcp:read impede escrita; privilégios de plataforma e secrets.value não são delegados; rotas de conta exigem sessão                                                         |
| Revogação/refresh     | Revogação imediata da concessão, banimento e retirada de workspace; rotação e rejeição de replay de refresh                                                                |
| CIMD                  | Fetch Node do provider exige HTTPS, resolve todos os IPs, rejeita endereços não públicos e fixa conexão; sem redirects, com timeout/limite de resposta no provider         |
| Proxy e transporte    | TLS local com CA privada validada, Host/Origin preservados, clientes oficiais nas duas eras, limites de corpo/concorrência/rate limit e shutdown                           |
| Containers            | MCP sem porta publicada, MongoDB, volumes de domínio ou chave administrativa; apenas rede API/proxy e segredo dedicado                                                     |
| Logs e auditoria      | Access log sem query/referer; não registra bodies/headers sensíveis; auditoria preserva usuário e IDs da concessão/cliente; credenciais sintéticas não apareceram nos logs |
| Bundle                | Allowlist de arquivos, paths/referências, ausência de symlinks, schemas e detector adicional de segredos; runtime local não é incluído nas skills remotas                  |

A biblioteca mantém validação criptográfica local das próprias chaves e fetches
CIMD isolados. O teste de transporte CIMD rejeita HTTP, loopback, RFC1918 e
metadata link-local antes de abrir conexão. A revisão confirmou DNS pinning,
bloqueio de redirect e limites no código da dependência fixada 1.7.6.
Não se realizou autenticação como o cliente real ChatGPT: essa evidência é P16.

## Correções realizadas nesta revisão

- proxy-addr 2.0.7 → 2.0.8: removido achado crítico
  [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h).
- Atualizadas dependências transitivas compatíveis da UI para remover avisos de
  DOMPurify/KaTeX. Audit de runtime da API, MCP, UI e CLI e audit das ferramentas
  privadas do plugin terminaram sem vulnerabilidades reportadas.
- Erros criptográficos JOSE e retirada de workspace são normalizados como
  invalid_token/401; falhas de infraestrutura permanecem indisponibilidade e
  falha de credencial do serviço não é tratada como insuficiência de scope.
- API inicializa OAuth/índices antes de anunciar readiness quando habilitado.
  Flags inválidas falham na inicialização.
- Nginx usa access log com método/path/status, sem query strings nem referer.

## Evidências locais

- API: 254 testes completos passaram, incluindo MongoDB e HTTP.
- MCP: suíte de 166 testes passou com sockets habilitados; novo teste adicional
  de rate limit/concorrência também passou.
- UI: 239 testes e build passaram após as atualizações de segurança.
- CLI: 103 testes passaram em P11; seus fontes não mudaram nesta revisão.
- Plugin: dois testes de portabilidade, determinismo e rejeição de payload
  passaram em P14.
- P11 executou backup/restore criptografado real em Docker: segredo privado,
  origem do destino preservada, concessões invalidadas ao mudar domínio,
  snapshot removido e serviços retomados.
- scripts/chatgpt/docker-integration.mjs monta duas instâncias exclusivas com
  dados sintéticos, TLS → Nginx → MCP → API → MongoDB, usa o cliente oficial e
  remove seus containers/volumes ao terminar. Cobre as fronteiras da tabela.

Comandos reproduzíveis:

```sh
BIAWS_CHATGPT_DOCKER_TEST=1 node scripts/chatgpt/docker-integration.mjs
BIAWS_MCP_HTTP_INTEGRATION=1 npm --prefix biaws-mcp test
npm --prefix plugins test
```

Para este host, o teste Docker usou
BIAWS_CHATGPT_TEST_MONGO_IMAGE=mongo:7.0. A imagem MongoDB8 do projeto não executa
no kernel disponível (SERVER-121912). O Compose do produto permanece em 8.0 e a
CI foi preparada para replica set e integração com essa imagem; essa execução
remota não ocorreu neste checkout. TLS local não prova acessibilidade pública.

## Limites e observações

A criação concorrente com IDs automáticos de issues revelou um conflito 409
preexistente no gerador de códigos. O ensaio de isolamento fornece IDs únicos
explícitos para não confundir esse conflito com autenticação/tenancy; o gerador
não foi alterado nesta melhoria. Clientes devem tratar conflitos de domínio.

O teste de replay de código usa uma autorização separada: o provider invalida
a família de refresh comprometida. Isso não deve ser confundido com falha de
refresh da conexão normal.

A validação do bundle usa o perfil de schema documentado em
[plugins/README.md](../plugins/README.md). Instalação/jornada real no ChatGPT,
verificação de domínio, elegibilidade de URLs por cliente, scan do portal,
publicações npm/catálogo e atualização de instalações permanecem externas.

## Revisão complementar

A revisão completa posterior, com correções e novas evidências, está em
[chatgpt-review.md](chatgpt-review.md). A execução atual passou com API254
(e compilada254), UI239, MCP167 sem skips, CLI108 e plugin5; a integração TLS
em duas instâncias foi repetida. Consulte os
[passos externos](chatgpt-external-actions.md) antes de publicar ou implantar.
