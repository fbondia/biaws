# Autenticação com Better Auth

O Better Auth é a fundação de identidade, credenciais e sessões da `biaws-api`.
O cadastro público por e-mail/senha está desabilitado. Todas as rotas de negócio
exigem uma sessão ou chave de API válida; a diferenciação por permissão será
ativada na Fase 4.

As versões do Better Auth, adaptador MongoDB e Argon2 estão fixadas no
`package.json`. Senhas novas usam Argon2id.

## Configuração

Copie as variáveis documentadas em `../../.env.example` para `../../.env`,
configure um `BETTER_AUTH_SECRET` com ao menos 32 caracteres e defina:

```dotenv
BETTER_AUTH_URL=http://127.0.0.1:3100
BETTER_AUTH_TRUSTED_ORIGINS=http://127.0.0.1:4400
BETTER_AUTH_SECURE_COOKIES=false
```

O Better Auth utiliza as mesmas `MONGO_URI` e `MONGO_DB` da API.

As sessões duram oito horas e podem ser renovadas uma vez por hora. O cookie tem
prefixo `biaws`, é `HttpOnly`, usa `SameSite=Lax` e recebe `Secure` quando
`BETTER_AUTH_SECURE_COOKIES=true`. Esse é o padrão da API em
`NODE_ENV=production`; o Compose sobrescreve para `false` porque sua configuração
inicial usa HTTP em localhost. Toda implantação HTTPS deve definir a variável
explicitamente como `true`. A UI deve sempre usar `credentials: "include"`.

## Bootstrap do primeiro administrador

O bootstrap não abre rota HTTP, não aceita senha na linha de comando e não faz
alterações quando já existe um administrador ativo. Execute em `biaws-api`:

```bash
BIAWS_BOOTSTRAP_ADMIN_EMAIL=admin@example.com \
BIAWS_BOOTSTRAP_ADMIN_NAME=Administrador \
BIAWS_BOOTSTRAP_ADMIN_PASSWORD='uma senha inicial longa' \
npm run bootstrap:admin
```

Não grave a senha real em `.env`, scripts versionados ou histórico do shell.
Se já existir usuário com o e-mail informado, mas nenhum administrador ativo, o
comando falhará sem promover silenciosamente essa identidade.

## Validação do login

Inicie a API e autentique o administrador criado:

```bash
npm start

curl -i \
  -c /tmp/biaws-auth.cookies \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://127.0.0.1:4400' \
  -d '{"email":"admin@example.com","password":"uma senha inicial longa"}' \
  http://127.0.0.1:3100/api/auth/sign-in/email
```

Consulte o ator normalizado:

```bash
curl -i \
  -b /tmp/biaws-auth.cookies \
  http://127.0.0.1:3100/api/auth/me
```

Finalize a sessão:

```bash
curl -i \
  -b /tmp/biaws-auth.cookies \
  -H 'Origin: http://127.0.0.1:4400' \
  -X POST \
  http://127.0.0.1:3100/api/auth/sign-out
```

Depois do logout, `/api/auth/me` deve responder `401`.

## Chaves de API

O plugin oficial `@better-auth/api-key` gera chaves com prefixo `biaws_`, armazena
somente seu hash e retorna o segredo apenas na criação. As chaves têm expiração
fixa de 90 dias e limite de 1.000 requisições por hora. A UI permite que cada
usuário liste, crie e revogue apenas as próprias chaves.

MCP e CLI recebem a chave por `ISSUE_API_KEY`; o CLI também aceita
`--api-key`. Ambos enviam:

```http
Authorization: Bearer biaws_...
```

O middleware converte sessão e API key no mesmo ator do workspace. Para isso, o modo de
sessão do plugin está habilitado somente como adaptador de autenticação; o Bondia Workspaces
não persiste nem valida chaves em paralelo ao Better Auth.

## Administração de identidades

A entrada `Usuários` da UI usa as APIs administrativas do Better Auth e aparece
somente para a role técnica `admin`. Ela permite listar e criar identidades,
bloquear/desbloquear, redefinir senha e revogar sessões. Essa role não equivale
aos futuros grupos de permissões do Bondia Workspaces.

Usuários bloqueados são recusados na normalização do ator, inclusive quando
apresentam uma sessão ou chave previamente emitida. A redefinição administrativa
de senha revoga as sessões existentes no fluxo da UI. Chaves continuam
armazenadas, mas não autenticam enquanto a identidade estiver bloqueada.

## Fronteira pública

Somente `GET /api/health` e as operações públicas necessárias de
`/api/auth/*`, como login, dispensam identidade prévia. O cadastro público
`POST /api/auth/sign-up/email` permanece desabilitado. As rotas de issues,
melhorias, procedimentos e skills exigem autenticação, mas ainda não diferenciam
grupos ou permissões.

## Atualizações e segurança

As versões do Better Auth e dos plugins permanecem fixadas e devem ser
atualizadas em conjunto após revisão do changelog, execução dos testes e
`npm audit --omit=dev`. Origens confiáveis devem ser enumeradas em
`BETTER_AUTH_TRUSTED_ORIGINS`; segredos, cookies e chaves não devem ser
registrados.
