# Revisão completa da CHATGPT-PLUGIN — 2026-10-17

> Registro histórico da revisão inicial. O estado atual está na
> [entrega](chatgpt-delivery.md): implementação concluída por aceite para
> servidor MCP personalizado; somente P17/P27 do catálogo permanecem abertas.
> A correção CIMD posterior foi entregue pela PR #25. Para configurar o uso
> atual, siga [BIAWS no ChatGPT](chatgpt.md).

Revisão do código e do diff da melhoria, acompanhada de regressões e integração
em infraestrutura descartável. Abrangeu OAuth/CIMD/contas, concessões e
delegação, contexto de requisição/tenancy, catálogo MCP/resources, consentimento,
proxy/Docker, CLI/setup/update/backup/restore, pacotes, CI e evidências de catálogo.
Não representa revisão independente do portal ou certificação de segurança.

## Problemas corrigidos

| Prioridade | Problema e correção                                                                                                                                                                                     | Tarefa/commit              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Alta       | Restore legado preservava grants/JWKS posteriores porque `mongorestore --drop` só limpa coleções presentes no dump. Limpeza OAuth antes da importação; nova limpeza após restore para outra origem.     | P11 — a11544c              |
| Média      | Setup com MCP desabilitado deixava o container anterior ativo. Bootstrap agora o para antes de reconciliar os demais serviços.                                                                          | P11 — a11544c              |
| Alta       | Instalação padrão falhava no Bash 3 com array vazio e set -u. Argumentos Compose agora incluem o arquivo base; cenário sem MCP testado no /bin/bash nativo.                                             | P11 — ac8a508              |
| Média      | Consentimento mostrava apenas nome autodeclarado pelo cliente. Agora exibe também seu identificador real, incluindo URL CIMD.                                                                           | P08 — d72ce34              |
| Média      | Schema genérico permitia SSE e headers estáticos no pacote OAuth. Contrato BIAWS agora aceita somente Streamable HTTP sem headers fixos.                                                                | P14 — b5076ab              |
| Média      | Build verificava parcialmente o ícone e instalação não o verificava. Ambos conferem cabeçalho/dimensões/limite; ZIP adulterado com checksum válido é rejeitado.                                         | P14 — b5076ab              |
| Média      | CI ignorava testes HTTP opt-in e verificava somente handshake legado manual. Agora executa sockets/limites e cliente oficial contra instalação empacotada nas duas eras.                                | P15 — 157e2a8              |
| Média      | Gate do catálogo aceitava flags obsoletas sem vínculo com o pacote. Agora verifica ZIP, manifesto, versão, checksum e endpoint, além das evidências externas.                                           | P17 — fd1e243              |
| Média      | Correções de scripts precisam ser detectáveis por snapshots da candidata anterior. Revisão de implantação incrementada de 2 para 3.                                                                     | P24 — a2a9a00              |
| Baixa      | Relatório copiado para a pasta de artefatos tinha links relativos quebrados e fazia o check de documentação falhar. Consolidação agora é reproduzível e gera README próprio com links internos válidos. | P27 — commit desta revisão |

## Validação conferida

- API: 254 testes com MongoDB/HTTP, mais execução compilada dos mesmos 254;
- UI: 239 testes, formato, CSS e build;
- CLI: release:check com 108 testes, incluindo cinco regressões novas dos
  scripts completos; 27 testes focados de snapshots/lifecycle também passaram;
- MCP: release:check com 167 testes sem skips, incluindo HTTP/limites;
- plugin: cinco testes, incluindo payloads inválidos, instalação, determinismo,
  portabilidade e evidências obsoletas;
- tarball instalado: cliente MCP oficial nas eras legacy/2026-07-28;
- cinco audits sem vulnerabilidades reportadas: API/MCP/CLI runtime e
  UI/tooling do plugin completos;
- duas instâncias Docker com TLS: quatro grupos de cenários passaram para
  login/consentimento/PKCE/replay, concorrência/tenancy/audience/escopos,
  refresh/permissões/membership/banimento/revogação e auditoria/logs;
- bug do restore reproduzido em MongoDB real: grant posterior sobrevive ao
  `--drop` antigo; correção removeu grants/JWKS indevidos e preservou o dado de
  domínio do dump;
- manifesto, documentação, formato e checksum dos artefatos conferidos.

O host exigiu MongoDB 7.0; produto e CI continuam configurados para 8.0. CI
remota e validação real no ChatGPT permanecem externas.

Os componentes mantêm as versões candidatas não publicadas; plataforma
**0.8.0/r3**, API 0.10.0, UI 0.8.0, MCP 0.15.0, CLI 0.6.0 e plugin 0.1.0-rc.1.
Tarballs e ZIP válidos mantiveram os mesmos checksums; as correções do pacote
mudaram seus verificadores. A UI revisada é distribuída pela imagem Docker.

## Situação e evidências na revisão inicial (histórico)

O fechamento posterior por aceite para MCP personalizado está no
[relatório atualizado](chatgpt-delivery.md). Os parágrafos abaixo registram o
estado anterior ao merge/publicação e à decisão de escopo.

As correções foram registradas nas tarefas correspondentes do BIAWS com seus
commits e resultados. Permanecem 20 tarefas concluídas e sete aguardando
evidências externas: P12, P16, P17, P23, P25, P26 e P27. A melhoria fica aberta.
O gate atual tem metadados válidos e `submissionReady=false` por 14 itens
ausentes; os novos vínculos de versão/artefato também estão pendentes.

Artefatos/evidências locais estão em `plugins/dist/chatgpt-plugin/`, gerados por
`scripts/chatgpt/consolidate-candidate.mjs`, com origem Git, instalação, versão,
checksum e prontidão. `SHA256SUMS` cobre também os relatórios. O ZIP desta
máquina aponta para loopback e é somente de teste offline.

Consulte o [roteiro externo em ordem](chatgpt-external-actions.md),
[relatório da entrega](chatgpt-delivery.md) e
[operação/rollback](chatgpt-operations.md). Nenhuma publicação, push, tag,
atualização de cliente ou submissão ao portal foi executada nesta revisão.
