# Conexão direta ao ChatGPT

O caminho atual é **adicionar um servidor MCP personalizado no ChatGPT**.
O [guia para o usuário](../../docs/chatgpt.md) apresenta as telas, a URL com
`/mcp`, OAuth/CIMD, seleção de workspace e primeiros pedidos. Essa conexão
dispensa ZIP e publicação no catálogo. O CLI é uma ajuda ao administrador;
quem apenas usa uma instância preparada não precisa instalá-lo.

Habilite com `biaws admin instance setup --mcp-http` ou
`biaws admin instance update NOME --mcp-http`. URL pública exige HTTPS; loopback
HTTP é apenas para desenvolvimento. Atualizar uma instância continua sujeito ao
fluxo de backup do comando update. O CLI gera segredo aleatório dedicado em
arquivo 0600 por instância e preserva-o em reconfigurações.

`update NOME --no-mcp-http` desabilita a entrada, preservando replica set,
configuração e dados OAuth. `status NOME --diagnose-mcp --json` verifica discovery,
issuer/resource, PKCE, API e challenge sem solicitar senha. Os resultados refletem
o acesso desta máquina; não comprovam acesso pela infraestrutura do ChatGPT.

`biaws workspace agent configure chatgpt --url https://instancia.example --json`
mostra a URL /mcp e os passos de login/consentimento no navegador. Acrescente
`--diagnose` para verificações de rede. Esse comando não exige API key nem
escreve credenciais no projeto. Ele não habilita o serviço nem cadastra a
conexão no ChatGPT. `--url` recebe a origem sem `/mcp`; o campo Server URL no
ChatGPT recebe a URL completa com `/mcp`. Codex/Claude continuam com stdio.
A URL pública e o workspace autorizado são escolhas diferentes: cada conexão
OAuth é vinculada no servidor ao workspace selecionado no consentimento.
