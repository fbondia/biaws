# Publicação, migração e rollback do CLI

## Publicar no npm

O pacote sem escopo chama-se `biaws`; o executável instalado também se chama
`biaws`. Antes de publicar, autentique a conta que controla o pacote:

```bash
npm login
npm whoami
```

Da raiz do repositório, valide testes, metadados, shebang e o conteúdo que seria
empacotado. Este é o modo padrão e não altera o registro npm:

```bash
./scripts/publish-biaws-cli.sh
```

Revise a lista do `npm pack --dry-run`, atualize `version` em `package.json` e
`package-lock.json`, mantenha a árvore Git limpa e só então publique:

```bash
./scripts/publish-biaws-cli.sh --publish
```

O script exige autenticação, recusa árvore suja, confirma que a versão ainda
retorna 404 no registro e executa toda a verificação novamente. MFA continua
sob controle do próprio npm; não passe OTP por arquivo versionado ou argumento
de outro wrapper. O nome disponível hoje ainda não fica reservado até a
primeira publicação bem-sucedida.

## Validar uma instalação limpa

O CI empacota e instala o tarball em prefixo isolado no Node.js 20.19 e 22, em
Linux e macOS. O ensaio manual equivalente é:

```bash
cd biaws-cli
package_file="$(npm pack --pack-destination /tmp)"
npm install --global --prefix /tmp/biaws-global "/tmp/${package_file}"
/tmp/biaws-global/bin/biaws --help
/tmp/biaws-global/bin/biaws --version
```

Não use um prefixo real nesse ensaio: isso evita substituir outra instalação
global. Depois da publicação, confirme também `npx biaws@<versão> --help`.

## Compatibilidade e migração

O shebang canônico está em `biaws-cli/bin/biaws.js`. O pacote npm cria o comando
`biaws`; no checkout, `npm --prefix biaws-cli link` oferece a mesma experiência.
O antigo `node biaws-cli/src/index.js ...` continua funcional durante a série
`0.x`, mas documentação e automações novas devem usar `biaws ...`.

Os wrappers públicos preservados são:

- `scripts/setup-local.sh`: setup co-localizado seguido de configuração;
- `scripts/setup-client.sh`: configuração de um cliente remoto;
- `scripts/configure.sh`: adapter legado para `biaws workspace agent configure/doctor`.

Esses wrappers usam `scripts/run-biaws-cli.sh`, que fixa `BIAWS_ROOT` no
checkout e executa o entrypoint com shebang. Em um clone limpo, ele instala
somente as dependências de produção do CLI antes da primeira configuração.

Os scripts `setup-server.sh`, `backup-instance.sh`, `restore-instance.sh` e
`remove-instance.sh` são engines operacionais invocados pelos comandos oclif;
não são aliases circulares. A remoção dos wrappers públicos só pode ocorrer
após aviso de depreciação em uma release `0.x`, telemetria ou evidência de
adoção e um runbook de substituição atualizado.

O pacote npm isolado cobre ajuda e API remota. Instância, MCP e catálogo local
dependem do checkout completo; defina `BIAWS_ROOT` para sua raiz quando o
executável global for chamado fora dela.

## Exercício de release

Antes de marcar uma release, use credenciais descartáveis e execute, nesta
ordem, em uma instância isolada:

1. `biaws --help` e `biaws --version` pela instalação empacotada;
2. `biaws admin instance setup` e `biaws workspace agent configure codex|claude` com `BIAWS_ROOT`;
3. uma consulta `workspaces list --json` e outra por código, como
   `demands get <código> --json`;
4. uma escrita idempotente com `demands task-status ... --yes --json`, seguida
   de nova leitura;
5. `biaws admin instance backup`, restore em uma instância de destino e validação de
   API/UI;
6. `biaws admin instance remove <destino> --yes`, preservando dados externos salvo
   autorização explícita.

Capture somente códigos de saída, envelopes sanitizados e checksums. Não grave
`.env`, API keys, senhas, cookies, arquivos de password, chaves mestras ou
archives em snapshots, fixtures, logs ou artefatos de CI.

## Rollback

`npm deprecate biaws@<versão> "mensagem"` é preferível a `npm unpublish`, que
quebra instalações reproduzíveis. Publique uma versão corretiva e fixe
temporariamente a última versão saudável (`npm install -g biaws@<versão>`).
Se o problema afetar somente o launcher, o comando legado
`node biaws-cli/src/index.js ...` permanece como fallback no checkout.

Não reverta dados de instância junto com o pacote CLI. Para mudanças de runtime
ou dados, siga o backup e rollback de `docs/operations.md` do repositório.
