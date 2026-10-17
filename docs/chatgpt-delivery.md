# Entrega local — CHATGPT-PLUGIN

A melhoria foi **concluída por aceite do usuário em 2026-10-17** para uso do
BIAWS no ChatGPT por **servidor MCP personalizado**, com OAuth e seleção do
workspace. São 25 tarefas concluídas; apenas **P17 e P27** permanecem
Aguardando Decisão, relativas à preparação/submissão futura ao catálogo.

Para usar agora, siga [BIAWS no ChatGPT](chatgpt.md). Não é necessário gerar
ZIP ou publicar no marketplace. A [distribuição](chatgpt-distribution.md)
explica essa decisão; o [runbook](chatgpt-operations.md) atende à administração.

A implementação inicial e a [revisão](chatgpt-review.md) têm commits e evidências
nas tarefas BIAWS. A PR [#22](https://github.com/fbondia/biaws/pull/22) foi mergeada.
A correção de delegação CIMD foi entregue em `280491a` pela PR
[#25](https://github.com/fbondia/biaws/pull/25), também mergeada. A
[CI dessa correção](https://github.com/fbondia/biaws/actions/runs/39026451374)
aprovou 14 verificações, incluindo integração Docker/TLS com MongoDB 8.0.

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

## Versões da entrega

| Unidade           | Versão                                |
| ----------------- | ------------------------------------- |
| Plataforma        | 0.8.0, schema 2, deploymentRevision 3 |
| API               | 0.10.0                                |
| UI                | 0.8.0                                 |
| MCP Docker/npm    | 0.15.0                                |
| CLI npm (`biaws`) | 0.6.0, mínimo para schema 2           |
| Executor          | 0.1.0, sem alteração                  |
| Plugin portátil   | 0.1.0-rc.1, candidato local           |

O usuário confirmou a publicação de `biaws-mcp@0.15.0` e `biaws@0.6.0`;
versões e integridades foram conferidas no registry npm no encerramento.
A conclusão da entrega não declara aprovação no catálogo. O pacote portátil
permanece candidato local com [matriz de compatibilidade](../plugins/compatibility.json).

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
MongoDB 8.0; Compose de produto continua em 8.0. A CI remota posteriormente
passou com MongoDB 8.0, nas PRs #22 e #25. O aceite humano para o MCP
personalizado está registrado no BIAWS; os testes locais não são apresentados
como execução individual de todos os cenários no cliente ChatGPT.

## Artefatos locais e reprodução para a futura etapa de catálogo

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

## Etapa futura: catálogo de plugins

| Tarefa | Situação preservada |
| --- | --- |
| P17 | Aguardando Decisão: materiais, identidade/domínio, URLs jurídicas, elegibilidade, vídeo, acesso de revisão e scans. |
| P27 | Aguardando Decisão: pacote/checksum final e relatório de prontidão para submissão. |

Essas tarefas não bloqueiam o uso por MCP personalizado nem o encerramento
aceito pelo usuário. Uma eventual publicação requer decisão e evidências
próprias. O [dossiê](../plugins/catalog/review-guide.md) e
`plugins/catalog/readiness.json` preservam as pendências; não houve submissão
ou aprovação da OpenAI. Não há gateway central ou promessa de URL arbitrária
para qualquer usuário de uma futura listagem pública.

Publicações npm foram feitas pelo operador. Não se registra implantação na
topologia por inferência da publicação, de CI ou do aceite. Para novas
instâncias e operação contínua, veja [as ações do administrador](chatgpt-external-actions.md).

## Commits da implementação inicial e situação após o aceite

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
| P12    | 7bfb661                                                        | Concluída por aceite do escopo atual |
| P13    | 3077b1f                                                        | Concluída                  |
| P14    | e0aeeb2                                                        | Concluída                  |
| P15    | 4264d9a                                                        | Concluída                  |
| P16    | fea82ea                                                        | Concluída por aceite do escopo atual |
| P17    | db0604d                                                        | Parte externa pendente     |
| P18    | e5d46ca                                                        | Concluída                  |
| P19    | d3a5b34                                                        | Concluída                  |
| P20    | 7f16586                                                        | Concluída                  |
| P21    | 544ad91                                                        | Concluída                  |
| P22    | ac1fbab                                                        | Concluída                  |
| P23    | 47c2345                                                        | Concluída por aceite do escopo atual |
| P24    | 7af6ce4                                                        | Concluída                  |
| P25    | 7bf2f86                                                        | Concluída por aceite do escopo atual |
| P26    | 81655e0                                                        | Concluída por aceite do escopo atual |
| P27    | Commit desta consolidação, identificado por CHATGPT-PLUGIN/P27 | Parte externa pendente     |
