# Cofre local de segredos

A `biaws-api` expõe o domínio `/api/secrets` para credenciais externas que
precisam ser recuperadas posteriormente. Senhas de usuários e API keys emitidas
pelo próprio BIAWS continuam armazenadas como hash e não usam este cofre.

## Armazenamento

O provider `local` grava um envelope criptografado por versão em
`BIAWS_SECRETS_DIR`. O conteúdo pode ser texto ou um arquivo binário e é
criptografado com AES-256-GCM, nonce aleatório e dados autenticados contendo os
IDs de workspace, segredo e versão. O arquivo contém somente ciphertext, nonce,
tag de autenticação e metadata do formato.

A chave binária de 32 bytes é lida de `BIAWS_SECRETS_KEY_FILE`. No Compose ela é
montada em `/run/secrets/biaws-master-key` a partir do caminho de host
`BIAWS_SECRETS_KEY_PATH`. O bootstrap gera a chave com permissão `0600`; ela não
fica no MongoDB nem no volume `secret-files`.

O `.env` de uma instância registra os dois nomes com o mesmo caminho absoluto no
host. O Compose substitui `BIAWS_SECRETS_KEY_FILE` por
`/run/secrets/biaws-master-key` dentro do container. Ao executar a API
diretamente no host com `BIAWS_ENV_FILE=instances/<nome>/.env`, ela usa os
caminhos absolutos da instância para a chave e para o cofre.

Cada segredo novo recebe um `identifier` técnico informado na criação. Ele é
normalizado para minúsculas, deve ser único no workspace e não pode ser alterado.
Nome, descrição, tipo, ambiente e escopo podem ser editados posteriormente;
formato, identificação e conteúdo só mudam pelos fluxos específicos de versão.

Arquivos secretos têm limite padrão de 5 MiB, configurável por
`BIAWS_SECRETS_MAX_FILE_BYTES`. Nome, MIME type e tamanho são armazenados como
metadata no MongoDB; os bytes permanecem somente no envelope criptografado.

Para execução local sem Docker:

```bash
openssl rand -out .secrets-master-key 32
chmod 600 .secrets-master-key
```

## Rotas

| Método  | Rota                        | Permissão                                  |
| ------- | --------------------------- | ------------------------------------------ |
| `GET`   | `/api/secrets`              | `secrets.metadata.read`                    |
| `POST`  | `/api/secrets`              | `secrets.create`, `secrets.value.write`    |
| `POST`  | `/api/secrets/files`        | `secrets.create`, `secrets.value.write`    |
| `GET`   | `/api/secrets/:id`          | `secrets.metadata.read`                    |
| `PATCH` | `/api/secrets/:id`          | `secrets.metadata.read`, `secrets.update`  |
| `PUT`   | `/api/secrets/:id/value`    | `secrets.value.write`                      |
| `PUT`   | `/api/secrets/:id/file`     | `secrets.value.write`                      |
| `POST`  | `/api/secrets/:id/copy`     | `secrets.value.reveal`                     |
| `POST`  | `/api/secrets/:id/reveal`   | `secrets.value.reveal`                     |
| `POST`  | `/api/secrets/:id/download` | `secrets.value.reveal`                     |
| `POST`  | `/api/secrets/:id/archive`  | `secrets.metadata.read`, `secrets.archive` |

Criação recebe metadata e `value` no corpo. O valor nunca aparece em listagens,
consultas de metadata ou auditoria. `reveal` aceita somente sessão de usuário;
API keys e clientes MCP são recusados. A resposta usa `Cache-Control: no-store`.
`copy` aplica as mesmas regras, registra uma ação própria na auditoria e permite
enviar o valor diretamente ao clipboard sem apresentá-lo na tela.

Criação e novas versões de arquivo usam `multipart/form-data`, campo `file`.
Metadata de criação é enviada nos campos `identifier`, `name`, `description`, `type`,
`environment` e `applicationId`. O download também exige sessão de usuário,
responde como attachment e usa `Cache-Control: no-store` e
`X-Content-Type-Options: nosniff`.

Segredos sem `applicationId` exigem escopo de workspace. Segredos associados a
uma aplicação também respeitam o escopo por aplicação de cada permissão.

## Recuperação

Uma recuperação completa exige MongoDB, `secret-files` e a chave mestra
correspondente. Perder a chave torna os valores irrecuperáveis. Obter cópias do
cofre e da chave permite descriptografar os valores; por isso os dois conjuntos
não devem compartilhar o mesmo destino ou as mesmas permissões de backup.

O provider local protege contra vazamento isolado do banco ou do volume, mas
não contra comprometimento do processo da API enquanto a chave está montada.
