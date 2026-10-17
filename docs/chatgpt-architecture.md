# Integração direta do ChatGPT

Decisão de CHATGPT-PLUGIN/P01. A instância continua sendo dona de seus usuários,
dados e autorização. O MCP HTTP é um serviço opcional que usa a API HTTP e
preserva a entrada stdio. Não introduz acesso ao MongoDB no MCP.

## Autenticação e delegação

- Compor Better Auth com `jwt`, `@better-auth/mcp` e `@better-auth/cimd`;
  `mcp()` já é o provider OAuth: não adicionar outro `oauthProvider()`.
- Fixar todos os pacotes da família em 1.7.6, inclusive `oauth-provider`.
  Resolver peers por faixa trouxe core/provider 1.7.10 incompatíveis com os
  peers exatos de 1.7.6. Não usar `--force` ou `--legacy-peer-deps`.
- Usar authorization code com PKCE S256 e CIMD com transporte Node seguro.
  DCR permanece desabilitado por padrão. O SDK 2.2.0 permite HTTP stateless
  moderno e fallback stateless para a era 2025, preservando a entrada stdio.
- O issuer deriva da URL pública da API/auth; o recurso é a URL pública `/mcp`.
  Não construir nenhum deles a partir de headers enviados pelo cliente.
- Cada concessão persistida pertence a usuário, cliente e workspace. As
  permissões são resolvidas novamente na API e intersectadas com os scopes.
- O provider fornece `getOAuthProviderState()`: a seleção pode ser vinculada
  à query OAuth assinada de cada fluxo, sem gravar workspace global na sessão
  do navegador. `postLogin.consentReferenceId` deve carregar a concessão, não
  confiar no workspace atual da UI.
- A credencial recebida pelo MCP tem audience `/mcp`. A API deverá emitir uma
  credencial curta própria de delegação, vinculada à concessão e destinada às
  rotas de domínio. Não encaminhar o access token externo como credencial de
  domínio. Não há suporte a token exchange assumido implicitamente.
- OAuth/delegação não é uma sessão da UI e não habilita revelação de segredos.

## Persistência

O adapter MongoDB com `client` ativa transações. A implantação OAuth deve usar
replica set; habilitar somente em standalone não atende ao contrato. Atualizar
o código de provisionamento não autoriza converter instâncias existentes.

O adapter cria índices de forma preguiçosa no primeiro write de cada model.
A prova identificou espera por lock ao criar o índice de `oauthClientResource`
dentro de uma transação já aberta. Antecipar o aquecimento dos índices pelo
adapter antes de liberar os endpoints OAuth; criar coleções isoladamente ou
fazer somente `findMany` não aquece esse cache.

Chaves, concessões e tokens pertencem ao banco e ao backup da instância.
Revogação deve ser consultada em cada chamada de domínio; validação isolada
da assinatura de um JWT não garante desconexão imediata.

## Prova reproduzível

`scripts/chatgpt/probe.mjs <prefixo-de-dependências>` cria um banco com nome
aleatório `biaws_chatgpt_probe_*`, usa somente identidades sintéticas e remove
somente esse banco ao encerrar. Exige `BIAWS_CHATGPT_TEST_MONGO_URI` apontando
para um replica set descartável. O prefixo deve conter Better Auth e os
pacotes acima em 1.7.6, `better-call` 1.4.0, driver MongoDB 7.7.0 e SDK 2.2.0.

Resultado local: login, consentimento, emissão de token com audience correta,
rejeição de reutilização de código e initialize MCP HTTP passaram. Essa prova
usa cliente sintético, não afirma conexão real do ChatGPT (P16).

Limitação do host: a imagem local `mongo:8.0` encerrou pelo guard de
incompatibilidade com kernel Linux >=6.19 (SERVER-121912). A prova foi executada
em um replica set MongoDB 7 descartável. A configuração de produção não foi
alterada; validar MongoDB 8 em ambiente compatível continua necessário em P15.

## Referências

- [Autenticação OpenAI](https://developers.openai.com/plugins/build/auth)
- [Better Auth MCP](https://better-auth.com/docs/plugins/mcp)
- [Autorização MCP](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
