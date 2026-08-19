# Taxonomia de comandos do BIAWS CLI

O executável `biaws` possui três níveis canônicos e um comando explícito de
ajuda. Não há aliases para a taxonomia anterior.

```text
biaws
├── help [comando...]
├── admin
│   ├── install
│   ├── doctor
│   ├── config
│   ├── instance setup|list|show|status|start|stop|backup|restore|remove
│   └── monitoring build|validate|start|stop|status|logs|provision
├── config
│   ├── init|login|show|set|unset|doctor
│   └── profiles list|use
└── workspace
    ├── list|get|init|use|current|unlink
    ├── agent configure codex|claude
    ├── agent doctor
    ├── applications list|get
    ├── demands list|get|tasks|task-status|complete-task
    ├── issues list|get|transition
    ├── skills list|install|install-all|status|update|publish|publish-all
    ├── monitoring signal|signals|describe|validate
    └── api <método> <caminho>
```

## Nível administrativo

`biaws admin ...` não exige URL, chave de API nem workspace. Ele opera a
instalação da plataforma, seus pré-requisitos e as instâncias locais. O comando
`admin install` baixa uma release versionada, exige checksum SHA-256 e não
sobrescreve diretórios que contenham arquivos.

## Configuração global

`biaws config ...` gerencia perfis, URLs e credenciais em um diretório XDG. A
localização segue esta ordem:

1. `BIAWS_CONFIG_HOME`;
2. `$XDG_CONFIG_HOME/biaws`;
3. `$HOME/.config/biaws`.

`config.json` armazena somente dados não secretos. As chaves ficam em
`credentials.json`, criado com permissão `0600`. Um perfil pode ser selecionado
globalmente ou pela configuração da pasta.

## Nível de workspace

`biaws workspace init` lista os workspaces autorizados e cria
`.biaws/config.json` na pasta selecionada. A associação é encontrada também a
partir dos subdiretórios dessa pasta. Comandos remotos exigem essa associação,
uma seleção explícita por flag ou as variáveis próprias para automação.

A precedência da resolução é:

```text
flags > variáveis de ambiente > configuração da pasta > perfil global > defaults
```

As variáveis canônicas são `BIAWS_API_URL`, `BIAWS_API_KEY` e
`BIAWS_WORKSPACE_ID`. Os nomes `ISSUE_*` permanecem aceitos como variáveis de
ambiente internas durante a transição do backend, mas não representam comandos
antigos do CLI.

## Convenções

- comandos e flags usam kebab-case;
- textos apresentados ao usuário usam português do Brasil com Unicode;
- descrições curtas começam em letra minúscula e não terminam em ponto;
- `--json` reserva stdout para JSON e envia diagnósticos para stderr;
- erros de uso retornam código 2 e falhas operacionais retornam código 1;
- segredos não são aceitos em argumentos de linha de comando;
- `biaws help` explica o produto e `biaws help <tópico>` navega na árvore.
