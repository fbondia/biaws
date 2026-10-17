# Próximas ações externas — CHATGPT-PLUGIN

Estado após revisão de 2026-10-17: implementação automática corrigida e
validada; 20 tarefas concluídas, sete aguardando evidência externa. Publicações
e atualização de instâncias continuam sob a etapa humana definida no escopo.

## 1. Revisar o Git e executar CI remota — P15/P24

Revisar a branch `codex/chatgpt-plugin` e enviar pelo processo habitual de PR.
Exigir CI verde antes da publicação: API/replica set e integração Docker com
MongoDB 8.0, MCP HTTP e pacotes instalados, UI, CLI Node 20.19/22 em Linux/macOS
e plugin. A execução local usou MongoDB 7.0 pela limitação do kernel; não
substitui essa evidência. Registrar o link/resultados em P15.

A candidata atual é plataforma **0.8.0, schema 2, deploymentRevision 3**,
API 0.10.0, UI 0.8.0, MCP 0.15.0, CLI 0.6.0 e plugin 0.1.0-rc.1.
Instalações de teste na revisão 2 devem detectar a revisão 3 em `update --check`.

## 2. Publicar os pacotes npm em ordem — P25/P26

Confirmar a conta publicadora, árvore limpa e tarballs aprovados. Seguir
[publicação npm](chatgpt-publication.md): primeiro `biaws-mcp@0.15.0`, conferir
integridade/instalação/handshake do registry; somente depois `biaws@0.6.0`,
conferir versão/help/configuração. O script do CLI recusa um MCP inexistente.
Registrar evidência real e sanitizada em P25/P26; token e MFA ficam no npm.
Publicação npm não é implantação da plataforma.

## 3. Escolher e preparar uma instância de revisão — P16/P24

Confirmar alvo, responsável e janela, preferencialmente uma instância de teste
com dados sintéticos. Configurar DNS/TLS públicos válidos e a origem real em
`BIAWS_PUBLIC_URL`. Revisar firewall e proxy; a URL pública do recurso é
`https://<origem-real>/mcp`. O MCP não precisa de porta pública própria.

Com CLI 0.6.0 ou posterior e o checkout revisado, fazer backup e aplicar a
release conforme o [runbook](chatgpt-operations.md). Para habilitar em uma
instância existente, o comando de update aceita `--mcp-http`; ele transforma o
MongoDB em replica set de um membro. Escolher o alvo antes de executar; não
inferir produção a partir dos deployments históricos do BIAWS.

Verificar `update --check`, health, UI/login, snapshot 0.8.0/r3, volumes,
segredo dedicado 0600 e o diagnóstico a partir de uma máquina externa:

```sh
biaws workspace agent configure chatgpt --url https://<origem-real> --diagnose --json
```

O diagnóstico prova apenas o acesso dessa máquina. Registrar a implantação na
topologia somente depois da execução real e com alvo/versão inequívocos.

## 4. Gerar o candidato da instância e testar no ChatGPT — P12/P16/P23

Após CI, dependências instaladas e endpoint escolhido, a consolidação local
recompila/verifica MCP, verifica CLI, empacota tarballs e ZIP e registra origem,
instalação e checksums em `plugins/dist/chatgpt-plugin/`:

```sh
node scripts/chatgpt/consolidate-candidate.mjs --url https://<origem-real>/mcp
```

O ZIP fica em `plugin-candidate/`. Builds com `--allow-loopback` são somente
testes offline. Instalar pelo fluxo disponível de plugin/conexão personalizada
no ChatGPT, usando OAuth e a conta BIAWS existente. Registrar versão/checksum
exatos. Seguir [aceite](chatgpt-acceptance.md) e
[dossiê](../plugins/catalog/review-guide.md): login/consentimento/workspace,
leitura/escrita e auditoria, recusa, permissões, refresh/revogação/reconexão,
skills, resources/resource links e streaming. Guardar vídeo/capturas sanitizados.
Credenciais não devem aparecer no ZIP, Git ou notas das tarefas.

## 5. Resolver distribuição e requisitos do catálogo — P17

Confirmar com a OpenAI a elegibilidade de template com URLs independentes de
clientes. Uma conexão personalizada funcionando não comprova essa elegibilidade.
Se o modelo não for elegível, decidir entre distribuição personalizada por
instância ou uma listagem vinculada a endpoint autorizado. Essa decisão requer revisar a estratégia e seu gate; até lá o campo de
elegibilidade permanece falso. Um gateway central
exigiria outro desenho; não está incluído nesta implementação.

O responsável precisa verificar identidade e domínio no portal, publicar e
revisar privacidade/termos reais, preparar conta e dados de revisão pelo canal
seguro, executar cinco casos positivos/três negativos, produzir o vídeo e obter
scans atuais de skills/tools. As permissões de revisão devem representar os
casos testados. Reconsultar as regras oficiais antes de enviar.

Ao adicionar URLs/metadados reais ao manifesto, reconstruir o ZIP. Atualizar
`plugins/catalog/readiness.json` somente com evidência correspondente:
`pluginVersion`, `artifactSha256`, `reviewEndpoint` e os demais campos.
Executar o gate com o ZIP final e seu `.sha256`:

```sh
node plugins/scripts/catalog-readiness.mjs --archive /caminho/biaws-plugin-0.1.0-rc.1.zip --require-ready
```

O gate exige manifesto/versão/checksum/endpoint correspondentes e as evidências
externas. Flags antigas ou um checksum apenas digitado não bastam. Sucesso
nesse gate local não equivale a aprovação da OpenAI.

## 6. Consolidar a evidência final — P27

Atualizar P12/P16/P17/P23/P25/P26 com resultados reais, sem encerrar critérios
que ainda faltam. Regerar pacote/checksums com o endpoint definitivo, conferir
compatibilidade com as versões publicadas e consolidar a prontidão em P27.
O ZIP loopback desta máquina não deve ser enviado ao portal.

A publicação efetiva no catálogo continua uma ação externa própria. A melhoria
não deve ser fechada por inferência de um build ou de um scan aprovado.

Referências oficiais reconsultadas nesta revisão:

- [OAuth e CIMD](https://developers.openai.com/plugins/build/auth#client-registration)
- [Contrato de metadados da revisão MCP](https://developers.openai.com/plugins/deploy/app-review#how-published-mcp-metadata-versions-work)
