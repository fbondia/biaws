# Entrega local — CHATGPT-PLUGIN

Implementação automática e preparação de release em 2026-10-17, na branch
`codex/chatgpt-plugin`. A implementação inicial recebeu um commit por tarefa e evidências no BIAWS.
A [revisão completa](chatgpt-review.md) acrescentou correções rastreáveis; os
[passos externos](chatgpt-external-actions.md) indicam a sequência restante. Há 20 tarefas concluídas e sete com a parte
externa pendente. A melhoria permanece aberta.

## Comportamento entregue

Cada instância oferece MCP Streamable HTTP opcional, com OAuth usando a conta
BIAWS existente. O consentimento fixa um workspace; cada chamada revalida a
conta, a concessão e as permissões atuais. A API recebe credencial delegada
curta. A sessão do navegador e tokens externos não se tornam chaves de domínio.
Conexões podem ser revogadas em Minha conta.

O CLI configura, diagnostica e administra a opção no Docker. Backup/restore,
snapshots legados e o manifesto schema 2 incluem o serviço MCP e seu segredo
dedicado. O serviço é isolado da rede MongoDB e dos volumes de domínio. Stdio
continua disponível; as duas ferramentas EML por caminho local são exclusivas
desse transporte. O pacote remoto oferece as alternativas por conteúdo.

## Versões preparadas

| Unidade           | Versão local                          |
| ----------------- | ------------------------------------- |
| Plataforma        | 0.8.0, schema 2, deploymentRevision 3 |
| API               | 0.10.0                                |
| UI                | 0.8.0                                 |
| MCP Docker/npm    | 0.15.0                                |
| CLI npm (`biaws`) | 0.6.0, mínimo para schema 2           |
| Executor          | 0.1.0, sem alteração                  |
| Plugin portátil   | 0.1.0-rc.1, candidato local           |

Nenhuma dessas preparações comprova publicação no npm, atualização de uma
instância ou aprovação no catálogo. O plugin tem versão própria e uma
[matriz de compatibilidade](../plugins/compatibility.json).

## Evidências locais

| Validação            | Resultado conferido                                                          |
| -------------------- | ---------------------------------------------------------------------------- |
| API com MongoDB/HTTP | 254 testes passaram                                                          |
| API compilada        | Os mesmos 254 testes passaram na execução compilada                          |
| UI                   | 239 testes, CSS e build passaram                                             |
| MCP                  | 167 testes, typecheck, build e package:verify passaram                       |
| CLI                  | 108 testes e release:check passaram                                          |
| Plugin               | Cinco testes: schemas/casos, determinismo, instalação, skills e evidências   |
| Publicação CLI       | Cinco cenários com registry falso passaram; sem chamada real npm             |
| Tarballs             | Instalações isoladas; handshake MCP legacy/2026-07-28; help/versão/JSON CLI  |
| Compose              | Config com MCP habilitado/desabilitado; quatro imagens construídas           |
| Manifesto/snapshots  | Release sincronizada; schema 1 legível e diferenças para schema 2 conferidas |
| Catálogo             | Metadados válidos; `submissionReady=false`, gate final sai com código 2      |

Audits de runtime API/MCP/UI/CLI e tooling do plugin sem vulnerabilidades
reportadas nas execuções da entrega. O audit completo da UI também ficou
zerado após correção da dependência de desenvolvimento source-map-js.

A integração completa usa duas instâncias descartáveis, Nginx e TLS com CA
privada de teste: PKCE, replay/refresh, revogação, issuer/audience/expiração,
Host/Origin, escopos, permissões reduzidas, conta bloqueada, remoção de membro,
isolamento de workspace/instância, auditoria e ausência das credenciais geradas
nos logs. A evidência sanitizada acompanha os artefatos locais.
O host exigiu MongoDB 7.0 para os testes por incompatibilidade do kernel com
MongoDB 8.0; Compose de produto continua em 8.0. A CI foi preparada para 8.0,
mas não foi executada remotamente. TLS local não comprova acesso pelo ChatGPT.

## Artefatos e reprodução

Os artefatos estão em `plugins/dist/chatgpt-plugin/` (ignorado pelo Git):

| Arquivo                                        | SHA-256                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| `biaws-mcp-0.15.0.tgz`                         | `d8a637a9ff2f213ddf9a237ad27f036614333d4b06930b64f5fff92a7134dd53` |
| `biaws-0.6.0.tgz`                              | `4b2b57f3dd7009276791c1b42836290a171addd4cfded57a1fa5d71100388ca2` |
| `plugin-candidate/biaws-plugin-0.1.0-rc.1.zip` | `42ea47eb74d3acb6b3324fc8fb888a8ed6931ed726fe567102c0fd11890187d4` |

Os tarballs foram regenerados e comparados byte a byte. O ZIP contém dez
arquivos, nenhum token/ambiente pessoal, seis skills, licença e ícone reais.
Build e instalação validam paths e o perfil Agent Plugins 1.0.0 com a extensão
OAuth OpenAI documentada; a diferença de schema está em [plugins](../plugins/README.md).

**O ZIP listado é somente de teste offline**, configurado para
`http://127.0.0.1:54400/mcp`. Essa instância descartável é removida após os
testes. Não enviar esse ZIP ao catálogo nem distribuí-lo como conexão pública.
O artefato final deve ser reconstruído com o endpoint HTTPS real escolhido:

```sh
npm --prefix plugins run build -- --url https://<host-real>/mcp --out <diretorio>
node plugins/scripts/verify-install.mjs <diretorio>/biaws-plugin-0.1.0-rc.1.zip
node plugins/scripts/catalog-readiness.mjs --archive <diretorio>/biaws-plugin-0.1.0-rc.1.zip --require-ready
```

O último comando permanece bloqueado enquanto faltarem evidências externas.
As [instruções de publicação](chatgpt-publication.md) detalham MCP antes do CLI.
Para operação e rollback, consulte o [runbook](chatgpt-operations.md).

## Pendências humanas e externas

| Tarefas   | Evidência que falta para conclusão integral                                                                                 |
| --------- | --------------------------------------------------------------------------------------------------------------------------- |
| P12 / P16 | Instalação real no ChatGPT, endpoint HTTPS acessível, resources/links, streaming, consentimento e casos de aceite           |
| P17       | Identidade/domínio, privacidade/termos, vídeo, contas de revisão, execução dos 5 casos positivos/3 negativos e scans atuais |
| P23       | Endpoint real escolhido e ZIP final por instância; versão e matriz já preparadas                                            |
| P25       | Publicação humana MCP 0.15.0 no npm, integridade e smoke do registry                                                        |
| P26       | Publicação humana CLI 0.6.0 após P25, integridade e smoke do registry                                                       |
| P27       | Consolidar novamente o artefato final com endpoint real e pacotes publicados, após as evidências anteriores                 |

Uma conexão personalizada por instância não comprova elegibilidade ao catálogo
público. O modelo de URLs de clientes via template depende da elegibilidade
confirmada pela OpenAI; não foi criado gateway central nem prometido um campo
livre universal no catálogo. O [dossiê](../plugins/catalog/review-guide.md) e
`plugins/catalog/readiness.json` preservam todas as pendências explicitamente.

Nenhum npm publish, push, tag, atualização de instância real, envio ao portal
ou registro topológico de publicação foi feito. Somente os projetos e dados
descartáveis criados para os testes desta melhoria são removidos na limpeza.

## Commits da implementação inicial por tarefa

| Tarefa | Commit                                                         | Situação                   |
| ------ | -------------------------------------------------------------- | -------------------------- |
| P01    | 2431945                                                        | Concluída                  |
| P02    | 4b042fb                                                        | Concluída                  |
| P03    | e3985ed                                                        | Concluída                  |
| P04    | b3e4643                                                        | Concluída                  |
| P05    | 656de54                                                        | Concluída                  |
| P06    | 1f35a11                                                        | Concluída                  |
| P07    | 1d98e89                                                        | Concluída                  |
| P08    | 1972fff                                                        | Concluída                  |
| P09    | 3070aa0                                                        | Concluída                  |
| P10    | 05fe0ab                                                        | Concluída                  |
| P11    | 4f1dcca                                                        | Concluída                  |
| P12    | 7bfb661                                                        | Parte externa pendente     |
| P13    | 3077b1f                                                        | Concluída                  |
| P14    | e0aeeb2                                                        | Concluída                  |
| P15    | 4264d9a                                                        | Concluída                  |
| P16    | fea82ea                                                        | Parte externa pendente     |
| P17    | db0604d                                                        | Parte externa pendente     |
| P18    | e5d46ca                                                        | Concluída                  |
| P19    | d3a5b34                                                        | Concluída                  |
| P20    | 7f16586                                                        | Concluída                  |
| P21    | 544ad91                                                        | Concluída                  |
| P22    | ac1fbab                                                        | Concluída                  |
| P23    | 47c2345                                                        | Parte externa pendente     |
| P24    | 7af6ce4                                                        | Concluída                  |
| P25    | 7bf2f86                                                        | Publicação humana pendente |
| P26    | 81655e0                                                        | Publicação humana pendente |
| P27    | Commit desta consolidação, identificado por CHATGPT-PLUGIN/P27 | Parte externa pendente     |
