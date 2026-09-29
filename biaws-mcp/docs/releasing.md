# Publicação e rollback do MCP

## Publicar no npm

O pacote e seu executável chamam-se `biaws-mcp`. Antes de publicar, autentique
a conta npm que controlará o pacote:

```bash
npm login
npm whoami
```

Da raiz do repositório, valide testes, metadados, conteúdo e handshake do
tarball sem alterar o registry:

```bash
./scripts/publish-biaws-mcp.sh
```

Atualize `version` em `biaws-mcp/package.json` e no respectivo lock, mantenha a
árvore Git limpa e publique:

```bash
./scripts/publish-biaws-mcp.sh --publish
```

Toda versão referenciada pelo CLI precisa ser publicada antes da versão do CLI
que passa a referenciá-la. Atualize também `MCP_PACKAGE_VERSION` em
`biaws-cli/src/commands/agent.js` e execute os dois `release:check`.

## Validar uma instalação limpa

```bash
cd biaws-mcp
package_file="$(npm pack --pack-destination /tmp)"
npm install --global --prefix /tmp/biaws-mcp-global "/tmp/${package_file}"
node scripts/smoke-client.mjs /tmp/biaws-mcp-global/bin/biaws-mcp
```

Depois da publicação, valide também `npx --yes biaws-mcp@<versão>` com o mesmo
handshake.

## Rollback

Prefira `npm deprecate biaws-mcp@<versão> "mensagem"` a `npm unpublish`.
Publique uma versão corretiva e faça o CLI apontar explicitamente para ela.

## Protocolo e SDK

O servidor usa `@modelcontextprotocol/server` 2.2.0 (Node >=20; o pacote
continua exigindo >=20.19.0), fixado no lock. `serveStdio` escolhe uma instância
por conexão e delega framing, negociação, notificações e cancelamento ao SDK.
A entrada atende `initialize` nas revisões 2024-11-05, 2025-03-26, 2025-06-18 e
2025-11-25, e `server/discover` em 2026-07-28. O cliente oficial 2.2.0 testa as
duas eras. Conteúdo estruturado e links seguem a codificação negociada; links
são emitidos a partir de 2025-06-18. Recursos ausentes usam o erro numérico
-32602 do SDK. EOF cancela operações pendentes: mantenha stdin aberto enquanto
aguarda respostas.

O catálogo usa a API pública `McpServer.server.setRequestHandler` para preservar
JSON Schemas e os erros funcionais BIAWS com `isError`. Não há implementação
paralela de JSON-RPC. O contexto de cada chamada recebe o signal do SDK;
encerramento por sinal cancela HTTP e aguarda até cinco segundos.

Referências verificadas em 2026-09-29:
[release 2.2.0](https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/v2.2.0)
e [compatibilidade de protocolos](https://ts.sdk.modelcontextprotocol.io/v2/protocol-versions).

Após instalar o tarball, use o cliente oficial para validar o executável:

```bash
node scripts/smoke-client.mjs /tmp/biaws-mcp-global/bin/biaws-mcp
```

## Build TypeScript

`npm run release:check` verifica a formatação, a tipagem estrita de fontes e
testes, compila e executa a suíte. `npm pack` recompila antes de verificar o
pacote. O tarball inclui somente `dist/src` e o bootstrap `bin/biaws-mcp.js`;
fontes `.ts`, testes e compilador ficam no checkout. A versão anunciada continua
sincronizada com `package.json`. Para validar uma instalação limpa, execute o
smoke acima nas duas eras do protocolo.
