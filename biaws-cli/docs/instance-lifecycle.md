# Ciclo de vida de instâncias

## Setup

O setup interativo coleta entradas ausentes, mostra um plano redigido e pede
confirmação antes de mutar arquivos ou chamar Docker:

```bash
biaws admin instance setup --interactive
```

Em automação, defaults precisam ser autorizados e a senha deve vir de um
ambiente privado, nunca de argv:

```bash
BIAWS_BOOTSTRAP_ADMIN_PASSWORD='...' \
  biaws admin instance setup --name local --defaults --non-interactive --yes
```

Use `--storage volumes` ou `--storage directories --storage-root /srv/biaws`.
Uma mudança de estratégia apenas atualiza a configuração e emite um alerta; o
CLI não move dados existentes implicitamente.

## Operação

```bash
biaws admin instance list
biaws admin instance show local
biaws admin instance status local
biaws admin instance start local
biaws admin instance stop local
```

`list` e `show` omitem o conteúdo integral do `.env`. `start`, `stop` e
`status` invocam Docker Compose sem shell e com projeto, arquivo Compose e env
da instância resolvidos explicitamente.

## Smoke test Docker real

Em um checkout descartável com Docker e OpenSSL disponíveis:

1. Reserve as portas `27117`, `3110` e `4410`.
2. Execute o setup não interativo abaixo.
3. Confirme que `status` lista `mongo`, `api` e `ui` saudáveis.
4. Pare e reinicie a instância, verificando que o mesmo `.env`, chave mestra e
   volumes são reutilizados.

```bash
BIAWS_BOOTSTRAP_ADMIN_PASSWORD='smoke-only-change-me' \
  biaws admin instance setup \
  --name smoke --mongo-port 27117 --api-port 3110 --ui-port 4410 \
  --public-url http://localhost:4410 --storage volumes \
  --admin-email smoke@example.test --admin-name Smoke \
  --api-rate-limit-max 300 --api-rate-limit-window 60 \
  --auth-rate-limit-max 100 --auth-rate-limit-window 10 \
  --api-key-rate-limit-max 1000 --api-key-rate-limit-window 3600 \
  --no-demo-seed --non-interactive --yes
biaws admin instance status smoke
biaws admin instance stop smoke
biaws admin instance start smoke
```

## Backup, restore e remoção

Os comandos oclif usam o archive portátil existente sem colocar a senha em
`argv`:

```bash
biaws admin instance backup alpha --password-file /caminho/privado/senha
biaws admin instance restore beta --archive ./alpha.tar.gz.enc --password-file /caminho/privado/senha --yes
biaws admin instance remove beta --yes
```

Em TTY, a senha pode ser solicitada de forma mascarada. Restore e remove
exigem o nome da instância como confirmação; em automação, `--yes` é
obrigatório. A remoção preserva bind mounts externos por padrão e só os apaga
com `--delete-external-data`.

O restore valida checksum, descriptografia, versão e entradas do tar antes de
substituir dados. Portas, URLs e caminhos de storage do destino são
preservados. Em falhas após a pausa, o mecanismo tenta recompor os serviços e
mantém o erro original como evidência.
