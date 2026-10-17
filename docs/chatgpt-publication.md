# Publicação da entrega CHATGPT-PLUGIN

Preparação local concluída em 2026-10-17. Publicações npm, atualização de
instâncias e submissão ao catálogo exigem a etapa humana definida no escopo.
Os comandos desta página são o procedimento futuro; não são evidência de execução.

## P25 — MCP primeiro

Versão preparada: `biaws-mcp@0.15.0`; commit de preparação `544ad91`.
Tarball local validado: `biaws-mcp-0.15.0.tgz`.
SHA-256: `d8a637a9ff2f213ddf9a237ad27f036614333d4b06930b64f5fff92a7134dd53`.
O arquivo está em `/private/tmp/biaws-chatgpt-releases/` nesta máquina.
Inclui os executáveis stdio e HTTP. Handshake nas duas eras com cliente oficial
e instalação isolada passaram; os 167 testes do MCP passaram.

Na ocasião da publicação, confirmar a conta que controla o pacote e revisar o
Git e o tarball. Revalidar dependências se houver intervalo ou mudança de código.
O script canônico recompila e empacota; compare o checksum do tarball regenerado
ao aprovado e investigue qualquer divergência antes de publicar.

```sh
git status --short
./scripts/publish-biaws-mcp.sh --dry-run
# Somente na etapa humana de publicação autorizada:
./scripts/publish-biaws-mcp.sh --publish
npm view biaws-mcp@0.15.0 version dist.integrity dist.shasum --json
```

Após publicar, instalar a versão do registry em prefixo temporário e executar
`scripts/chatgpt/smoke-installed-mcp.mjs <prefixo>/node_modules/biaws-mcp`.
Comparar a integridade npm (SHA-512) com o tarball baixado, além do SHA-256
local quando o conteúdo publicado for o mesmo. Anotar conta, versão,
integridade e resultado sanitizado em P25, sem token/OTP. A tarefa continua
pendente até haver evidência real do registry; build local não a conclui.

Não registrar deployment topológico pela publicação npm. A plataforma
`0.8.0` é outra unidade de distribuição e nenhuma instância foi selecionada.

## P26 — CLI depois do MCP

Versão preparada: `biaws@0.6.0`; commit de preparação `ac1fbab`.
Tarball local validado: `biaws-0.6.0.tgz`.
SHA-256: `4b2b57f3dd7009276791c1b42836290a171addd4cfded57a1fa5d71100388ca2`.
Está no mesmo diretório temporário; instalação isolada, help, versão e JSON
OAuth passaram. Os 103 testes do CLI passaram, incluindo stdio e instâncias.

O script `publish-biaws-cli.sh --publish` consulta a versão exata do MCP fixada
no código e recusa a publicação se estiver ausente, divergente ou indisponível.
Confirme primeiro o smoke do MCP publicado em P25.

```sh
./scripts/publish-biaws-cli.sh --dry-run
# Somente na etapa humana de publicação autorizada e após P25:
./scripts/publish-biaws-cli.sh --publish
npm view biaws@0.6.0 version dist.integrity dist.shasum --json
```

Instalar do registry em prefixo isolado e conferir `biaws --version`, `--help`
e `workspace agent configure chatgpt --url https://<origem-real> --json`.
Não colocar `/mcp` no argumento de origem; a saída fornece o recurso completo.
Anotar versão/integridade/smoke reais em P26. Não atualizar uma instância apenas
para verificar o CLI. npm e catálogo são publicações distintas; uma não comprova
a outra. MFA/conta publicadora e publicação efetiva permanecem humanas.
