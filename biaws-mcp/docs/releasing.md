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
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  | /tmp/biaws-mcp-global/bin/biaws-mcp
```

Depois da publicação, valide também `npx --yes biaws-mcp@<versão>` com o mesmo
handshake.

## Rollback

Prefira `npm deprecate biaws-mcp@<versão> "mensagem"` a `npm unpublish`.
Publique uma versão corretiva e faça o CLI apontar explicitamente para ela.
