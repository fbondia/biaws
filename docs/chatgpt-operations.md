# Operação da conexão ChatGPT

Este runbook cobre a conexão direta à instância, com a conta BIAWS existente.
O uso atual é via **servidor MCP personalizado** no ChatGPT. O passo a passo
do usuário está em [BIAWS no ChatGPT](chatgpt.md); este documento atende ao
administrador da instância. Gerar ZIP ou publicar no catálogo não faz parte
do cadastro de uma conexão personalizada.
As validações locais estão em [chatgpt-security-review.md](chatgpt-security-review.md).
A instalação/jornada no cliente real segue [chatgpt-acceptance.md](chatgpt-acceptance.md).

## Instalação e habilitação

Use checkout com release schema 2 e CLI >=0.6.0. Confirme as versões preparadas
no manifesto; publicar os pacotes e atualizar instalações são ações do operador,
não efeitos do build do plugin. MCP deve ser publicado no npm antes do CLI que
o referencia. A origem HTTPS, certificado confiável e proxy externo pertencem
ao operador; o projeto não provisiona domínio/TLS automaticamente.

Instalação nova: use `biaws admin instance setup` com os parâmetros habituais,
`--public-url https://instancia.example` e `--mcp-http`.
A senha administrativa continua no fluxo seguro existente; não a coloque no
comando nem na conversa. Para instalação existente, faça backup e execute em
janela de manutenção:

```sh
biaws admin instance update NOME --check --json
biaws admin instance update NOME --mcp-http --password-file /caminho/privado/senha
biaws admin instance status NOME --diagnose-mcp --json
```

O update valida Compose, usa o overlay MCP e converte o MongoDB para replica
set de um membro. API/OAuth inicia somente após armazenamento/índices válidos.
Sem o recurso, o Compose normal continua funcionando e não exige segredo MCP.
Os dados, a chave mestra existente e a credencial dedicada são preservados.

O CLI registra URL/perfil e arquivo privado 0600 do segredo de serviço, com
UID/GID correspondentes. API e MCP recebem esse arquivo; MCP só acessa a API
pela rede interna, sem MongoDB, volumes de domínio ou chave administrativa.
Não use a API key do bootstrap como segredo de delegação.

## Proxy e descoberta

O proxy HTTPS encaminha para a UI/Nginx, preservando Host. Configure
BIAWS_PUBLIC_SCHEME=https e a origem pública coerente nos componentes; o CLI
faz isso para o overlay. Configure trusted proxies somente para a cadeia
real conhecida. Não confie em X-Forwarded-Proto arbitrário de um cliente.

Verifique os endpoints públicos:

- /api/health;
- /.well-known/oauth-authorization-server/api/auth;
- /.well-known/oauth-protected-resource/mcp;
- POST /mcp sem token: 401 com WWW-Authenticate e URL de metadata.

O Nginx encaminha discovery à API, nunca à SPA, e usa upstream MCP resolvido
em runtime. /mcp fica 404 quando desabilitado. O endpoint é stateless e usa o
SDK oficial; GET/DELETE não são canais de sessão e retornam 405.
Buffering/cache ficam desligados na rota MCP. O access log omite query/referer.

## Conectar e administrar

No ChatGPT pela web, abra Plugins, escolha **+ → Add custom MCP server** e
cadastre `https://instancia.example/mcp`, com OAuth/CIMD. Complete o login,
selecione o workspace no BIAWS e autorize. Confira a descoberta das ferramentas,
instale a conexão e selecione-a com `@` em uma nova conversa.
Veja [as instruções completas](chatgpt.md#1-cadastre-o-servidor-mcp).

```sh
biaws workspace agent configure chatgpt --url https://instancia.example --json
biaws workspace agent configure chatgpt --url https://instancia.example --diagnose --json
```

O comando mostra /mcp e orienta OAuth. Login e consentimento ocorrem no
navegador da instância; não são capturados pelo CLI nem pelo chat. O usuário
seleciona um workspace acessível e vê os scopes. Cada concessão tem workspace
imutável; mudar a seleção da sessão web não altera uma conexão existente.

A API intersecta mcp:read/mcp:write com as permissões atuais. Sem mcp:write, as
mutações são negadas. Segredos em valor e privilégios de plataforma não são
delegados. Duas conexões da mesma conta podem usar workspaces diferentes.

offline_access permite refresh conforme o provider; refresh gira e replay é
rejeitado. Reutilizar código de autorização invalida a família comprometida.
Revogue uma conexão em Minha conta → Aplicativos conectados; concessão,
banimento, retirada de workspace e mudanças de permissão são reavaliados.
A lista mostra até 100 concessões autorizadas mais recentes.

401 pede nova autorização; 403 pode indicar permissão/scope insuficiente;
429 pede respeitar Retry-After; 503 indica indisponibilidade/configuração do
serviço. Não contorne com tokens em URL, credencial administrativa ou acesso
direto ao banco. O diagnóstico é observado desta máquina e não certifica
reachability pela infraestrutura do ChatGPT.

### OAuth conclui, mas a descoberta de ferramentas falha

No cadastro de servidor personalizado, use a URL completa
`https://<origem>/mcp`. A raiz do site atende a UI.
Se a troca em `/api/auth/oauth2/token` retorna 200, mas
`/api/auth/mcp/delegate` retorna 401, o problema está na validação da
credencial antes de `tools/list`. Esse retorno pode não gerar logs no MCP;
correlacione a tentativa com os logs da API e do proxy.

A correção CHATGPT-PLUGIN/P05 faz a delegação reutilizar o provider OAuth
inicializado, incluindo a descoberta CIMD. A configuração recriada sem essas
extensões rejeitava o cliente CIMD mesmo após autenticação bem-sucedida.
Após incorporar a correção ao checkout do servidor, reconstrua a instância
em janela de manutenção, com backup pelo CLI. Se o manifesto não mudou, use
`biaws admin instance update NOME --force`. Depois repita a atualização das
ferramentas no ChatGPT; reconecte a conta se o cliente solicitar OAuth.
Essa correção da API não exige republicar MCP/CLI no npm nem gerar outro ZIP.

## Backup, domínio e chaves

O backup criptografado protege banco completo (incluindo OAuth/JWKS), segredo
dedicado e arquivos de domínio. Preserve também a senha do archive em canal
apropriado. Nunca inclua esses arquivos no plugin, Git ou material de revisão.

Restore mantém as URLs, flags e paths do destino e invalida o snapshot de
release. Ao mudar a origem/issuer, remove as autorizações/tokens/clientes/JWKS
restaurados antes de retomar serviços: os usuários precisam conectar novamente.
Antes de importar o dump, limpa o estado OAuth do destino: coleções ausentes
em backups legados não podem preservar concessões posteriores ao backup.
Na mesma origem, somente o estado presente no backup é recuperado.
Faça update no checkout escolhido para reconciliar as imagens. Restore não
habilita MCP em um destino que estava desabilitado.

Para rotacionar o segredo dedicado, pare o MCP, substitua atomicamente o
arquivo por novo valor aleatório forte mantendo proprietário e modo 0600 e
reconcilie API/MCP na mesma manutenção. A API lê o arquivo ao delegar; MCP o
carrega no startup, então exige restart/update. O segredo identifica o serviço,
não concede permissões de uma conta.

As chaves JWT persistidas são geridas pelo Better Auth e criptografadas com
seu segredo. Este CLI não fornece rotação global de JWKS nem keyring do segredo
Better Auth. Não troque BETTER_AUTH_SECRET ou apague chaves como procedimento
rotineiro: isso pode impedir a leitura das chaves existentes e encerrar sessões.
Rotação de assinatura/segredo do provider exige mudança administrativa
controlada, backup, política de sobreposição/revogação e reautorização validada
no ambiente escolhido. Não foi executada rotação em instalação de cliente.

## Desabilitar e reverter

```sh
biaws admin instance update NOME --no-mcp-http --password-file /caminho/privado/senha
```

O comando para MCP e desabilita OAuth remoto; mantém API/UI, dados, chaves,
concessões e replica set. Não remova volumes nem faça downgrade físico do MongoDB
para reverter a funcionalidade. stdio continua usando credencial/workspace locais.

Para rollback, mantenha o backup anterior e escolha uma release comprovadamente
compatível com schema 2, MongoDB/replica set e dados persistidos; use CLI capaz
de ler o manifesto e compare `update --check` antes de aplicar. O update só
grava o snapshot após deploy saudável. Não há alvo anterior universalmente
seguro confirmado nesta entrega. Voltar a checkout schema 1 ou alterar o modo/
versão física do MongoDB exige um plano específico e teste do backup; não é
uma reversão automática sem perda de dados.

## Pacote e catálogo

A implementação foi aceita para uso por MCP personalizado. A futura submissão
do plugin está adiada (P17/P27); os comandos de pacote e os materiais abaixo
são para essa retomada, não pré-requisitos para usar a conexão atual.

O build do plugin exige URL da instância, gera ZIP/checksum determinísticos
e inclui somente seis skills, manifestos, ícone e licença. HTTP não oferece
as tools EML por path local; stdio as mantém. Conteúdo/base64 seguem suportados.

A conexão direta, o pacote instalável, o aceite real, a prontidão de submissão
e a publicação são evidências distintas. Consulte [plugins/README.md](../plugins/README.md)
e [o dossiê](../plugins/catalog/review-guide.md). Endpoint universal não foi
criado; templates multi-instância exigem elegibilidade externa. O gate de
catálogo permanece falso até existirem URLs jurídicas, domínio/identidade,
vídeo, scans e jornada real. Esta documentação não declara aprovação da OpenAI.
