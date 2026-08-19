# Servidor compartilhado e clientes remotos

Use esta rota quando API, UI e MongoDB vivem em um servidor comum, mas Codex ou
Claude Code rodam nas máquinas dos desenvolvedores.

No servidor, execute somente `scripts/setup-server.sh`. Ele cria a instância,
seus dados, segredos e identidade técnica; não escreve configuração de agente.

```bash
./scripts/setup-server.sh --instance default --public-url https://ci.exemplo.com
```

Publique a UI e a API por um proxy HTTPS. A API deve ser encaminhada sob
`/api` para a porta interna da instância. Não exponha MongoDB nem compartilhe o
arquivo `instances/default/.env`.

O proxy precisa preservar o host e o protocolo originais. Restrinja as portas
do MongoDB, da API e da UI à rede do host ou à rede privada; a única entrada
pública deve ser a origem HTTPS informada em `--public-url`. Depois do setup,
valide:

```bash
curl --fail https://ci.exemplo.com/api/health
docker compose \
  --env-file instances/default/.env \
  --project-name biaws-default ps
```

Entre na UI como administrador, crie ou associe cada pessoa aos workspaces e
grupos necessários e peça que cada uma gere sua própria API key na área da
conta. Não distribua a chave técnica criada pelo bootstrap.

Cada desenvolvedor mantém um arquivo privado, com permissão `600`, por exemplo
`~/.config/biaws/default.env`:

```dotenv
BIAWS_API_URL=https://ci.exemplo.com/api
BIAWS_API_KEY=chave-individual-do-desenvolvedor
```

Cada chave deve ser individual, associada apenas aos workspaces e grupos que o
desenvolvedor precisa acessar. Com o CLI publicado, o cliente pode ser
configurado sem clonar o repositório:

```bash
npm install --global biaws
biaws workspace agent configure codex \
  --project /caminho/do/projeto \
  --env-file ~/.config/biaws/default.env \
  --workspace id-do-workspace
```

O CLI grava `npx --yes biaws-mcp@<versão-fixada>` e instala as skills do
catálogo. Em um checkout do BIAWS, o wrapper equivalente continua disponível:

```bash
./scripts/setup-client.sh \
  --client codex \
  --project /caminho/do/projeto \
  --env-file ~/.config/biaws/default.env \
  --workspace id-do-workspace
```

`setup-client.sh` delega a escrita de MCP e skills a `configure.sh`. Este
último também executa o diagnóstico de autenticação. Nunca copie chaves ou o
arquivo de ambiente do servidor para clientes.

Para trocar apenas o workspace, reaplique `configure.sh` com os mesmos
`--client`, `--project` e `--env-file`. Use `--force` apenas se já houver uma
configuração `biaws` não gerenciada que deva ser assumida pelo CLI.

Faça backup antes de atualizar e execute novamente `setup-server.sh` com a
mesma instância e URL pública. O script preserva a URL pública existente quando
`--public-url` é omitido, mas recomenda-se informá-la explicitamente em
automação. Operação, restore e troubleshooting estão em
[operations.md](operations.md).
