# Changelog

Mudanças relevantes deste projeto serão documentadas neste arquivo. O formato
segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o
versionamento seguirá [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Changed

- Versões atualizadas para API `0.8.1`, UI `0.6.1` e MCP `0.14.1` pela
  correção das datas dos comentários de issues. CLI `0.5.3` passa a fixar o
  MCP `0.14.1`; o manifesto da plataforma passa para `0.7.1`.

- API, MCP e UI preservam datas desconhecidas (`null`) dos comentários de
  issues. Editar somente o texto mantém a data e o horário existentes; a UI
  permite salvar sem data e exibe “Data não identificada”. O texto original de
  data dos EMLs é preservado.

- UI exibe imagens dos anexos referenciadas na descrição, no resumo e nos
  comentários dos issues, com seleção de imagens carregadas nos editores.
  O resumo passa da aba KB para a aba Descrição, antes da descrição completa,
  com salvamento independente de assuntos e tags.

- Release da plataforma atualizada de `0.6.0` para `0.7.0`, com API `0.8.0`
  e UI `0.6.0` sincronizadas no manifesto; API, UI e MCP `0.14.0` passam a
  permitir a exclusão auditada de comentários de issues com permissão dedicada.

- Release da plataforma atualizada de `0.5.1` para `0.6.0`, com API `0.7.0`
  e UI `0.5.0` sincronizadas no manifesto.

- API atualizada de `0.6.1` para `0.7.0` e MCP de `0.12.2` para `0.13.0`:
  importações EML passam a aceitar análise segura de arquivos locais no host,
  associação assistida a aplicações e componentes e classificação no mesmo
  plano de importação, com dry-run e verificação SHA-256.

- UI atualizada de `0.4.1` para `0.5.0`: a prévia de texto das issues preserva
  Markdown, usa o renderizador compartilhado e amplia o limite para 300
  caracteres.

- CLI atualizado de `0.5.1` para `0.5.2`, passando a fixar o MCP `0.13.0` nas
  configurações gerenciadas de agentes.

- CLI atualizado de `0.5.0` para `0.5.1`, passando a fixar o MCP `0.12.2`
  nas configurações gerenciadas de agentes.

- UI atualizada de `0.4.0` para `0.4.1`: o resumo das issues passa a ser
  identificado como “Resumo”, renderizado e editado em Markdown nos detalhes e
  priorizado sobre a descrição na coluna de texto da listagem.

- UI atualizada de `0.3.0` para `0.4.0`, incluindo os filtros e a barra de
  balanceamento do calendário de jornadas das melhorias.

- Calendário de jornadas das melhorias permite limitar meses para trás e para
  frente do mês atual e exibir somente melhorias com totais previstos e
  executados desbalanceados; agregações exibidas acompanham o período filtrado.
  Totais de jornadas dos grupos, inclusive o total geral, aparecem somente
  quando contraídos, evitando duplicidade visual com as melhorias expandidas.
  Chips são substituídos por uma barra de balanceamento: azul para jornadas
  previstas e executadas, amarelo para previsões pendentes e verde para execução
  excedente, com valores numéricos, legenda e descrição acessível.

- CLI atualizado de `0.4.0` para `0.5.0`, incluindo a gestão de atualização
  de instalações por manifesto de release.

- Atualização de instalações passa a comparar `release.json` e o manifesto
  aplicado, com versões independentes de API, UI e executor e revisão de
  implantação; a versão da plataforma deixa de ser determinada pelo CLI.
  Instalações legadas exigem atualização e `--check` mostra as diferenças.
  Setup/update registram o manifesto somente após sucesso; restore invalida o
  estado aplicado para exigir reconciliação com o checkout desejado.

- API atualizada de `0.5.0` para `0.6.0` e MCP de `0.11.0` para `0.12.0`,
  consolidando as refatorações TypeScript, os contratos Zod e OpenAPI da API
  e a integração do MCP com o SDK oficial; versões de contratos, handshake,
  descoberta, exemplos e referência do CLI sincronizadas; guia de versionamento
  atualizado com build, testes compilados e validação OpenAPI;

- API atualizada de `0.4.0` para `0.5.0` e MCP de `0.10.0` para `0.11.0`,
  incluindo resources hierárquicos, resolução de ID ou identificador e
  organização das rotas e repositories por domínio; handshake, exemplos e
  referência do MCP no CLI sincronizados;

- repositories da API organizados por domínio e responsabilidade, com separação
  de consultas, mutações, normalização, contexto, histórico e recursos filhos;
  leituras granulares de resources passam aos respectivos domínios;

- rotas da API organizadas em pastas por domínio e arquivos por endpoint, com
  composição explícita dos routers e mecanismos comuns em `routes/shared`;

- MCP passa a expor resources hierárquicos com links e leitura granular pela API;
  tools de leitura permanecem disponíveis para compatibilidade;
- API resolve IDs antes dos identificadores de negócio no mesmo escopo autorizado,
  incluindo filhos e auditoria; arquivos de tarefas usam rotas e permissões próprias;
- classificação de issues passa a orientar análise pelo agente sobre os resources
  da issue e do catálogo aplicável, com gravação por `issues_classify` e sem sampling.

- MCP atualizado de `0.9.0` para `0.10.0`, com novas ferramentas de melhorias,
  issues, auditoria, documentos e monitoramento; o CLI e os exemplos de instalação
  passam a referenciar `biaws-mcp@0.10.0`;

- `demands_list` expõe paginação e filtro de coleção; calendário e prazos
  percorrem as páginas da API, com limite explícito para evitar totais parciais;

- MCP `0.6.0` passou a expor o contrato discriminado dos documentos e a tool
  `document_types_list`; as interfaces legadas `procedures_*` foram removidas e
  procedimentos permanecem disponíveis por `documents_*` com
  `documentType=procedure`;
- variável de escopo dos clientes e do MCP renomeada para
  `BIAWS_WORKSPACE_ID`, sem alias para o nome anterior;
- configuração de agentes passou a usar `npx` com versão fixada do MCP, sem
  exigir um checkout local do BIAWS;
- onboarding reorganizado com rotas explícitas para macOS, Linux e Windows via
  WSL2, além de um prompt único para instalação assistida por agente;
- identidade da solução padronizada como Bondia Workspaces;
- prefixos de autenticação, formatos de skills, nomes de pacotes e identificadores
  técnicos padronizados com a sigla `biaws`;
- variáveis do bootstrap padronizadas com o prefixo `BIAWS_`.
- listagem de demandas paginada na API e na UI;
- índices compostos alinhados às ordenações de catálogo, conhecimento e
  topologia;
- seed reorganizado para criar e propagar o workspace antes de configurações e
  dados de demonstração;
- coleções MongoDB padronizadas em `lowerCamelCase` plural, com namespace
  `auth*` para Better Auth e `workspaceMemberships` para vínculos de acesso.
- ambiente Docker e validação contínua atualizados para MongoDB 8.0.
- porta externa do MongoDB isolada por instância, mantendo `27017` somente na
  rede interna do Compose.

### Added

- consultas MCP de auditoria, revisões e observações de documentos, topologia
  monitorada, alvos, perfis de metadados, saúde de aplicações e sinais passivos;
- ferramenta `issues_update` para editar conteúdo e contexto de issues;

- ferramentas MCP para atualizar dados cadastrais, especificação, checklist e
  jornadas de melhorias e editar/excluir suas notas; atualizações enviam apenas
  os campos solicitados e preservam permissões e auditoria da API;

- consulta agregada do histórico de saúde de runtimes na API e no MCP, com
  resolução temporal adaptativa e consumo independente pelos gráficos da UI;
- modo assistente padrão em terminais para `biaws workspace agent configure
codex|claude`, com seleção de workspace e confirmação antes da escrita;
- pacote público executável `biaws-mcp`, com validação do tarball, handshake no
  CI e fluxo protegido de publicação no npm;
- comando `biaws admin instance update`, com comparação entre versão implantada
  e disponível, modo `--check`, backup seguro por padrão, validação do Compose
  e reconstrução dos serviços sem trocar os storages;
- bootstrap de identidade técnica exclusiva e de menor privilégio para o
  executor, credencial montada por arquivo, fontes de segredo por arquivo,
  hardening do container e smoke test do profile real no CI;
- runbook ponta a ponta do monitoramento ativo com instalação, escala,
  diagnóstico, atualização, rollback e matriz de evidências automatizadas;
- executor contínuo e independente de monitoramentos ativos, com leases
  renováveis, concorrência limitada, retry exponencial, desligamento gracioso,
  health/readiness e métricas Prometheus;
- replicação compartilhada de skills, documentos, grupos de permissões e listas
  de opções para múltiplos workspaces, com autorização por destino, auditoria,
  resultado parcial e repetição seletiva de falhas;
- identificadores editáveis e únicos para documentos e grupos personalizados,
  usados para decidir entre criação e substituição durante a replicação;
- tools MCP para enviar, baixar, classificar e excluir anexos de chamados,
  melhorias, tarefas e documentos, com Base64 limitado e associação de
  tarefas compatível com a UI;
- diagnóstico de pré-requisitos com detecção de sistema, versão mínima do
  Node.js, Docker Compose e disponibilidade do Docker Engine;
- home configurável por usuário e workspace, com catálogo expansível, múltiplas
  instâncias por widget, ordenação, tamanhos e filtros por aplicação;
- recepção passiva de sinais externos de saúde de runtimes, com endpoint
  autenticado, idempotência, histórico paginado, auditoria, CLI e visualização
  na UI;
- onboarding automatizado para Codex e Claude Code, com configuração MCP por
  projeto, instalação de skills e diagnóstico;
- seletor multi-instância com portas, credenciais, Compose e volumes isolados
  sobre um único clone do código;
- configuração por instância de bind mounts para MongoDB e arquivos de issues,
  requests e documentos, mantendo volumes Docker nomeados como padrão;
- scripts executáveis de início, parada, backup e restore do MongoDB gerados
  para cada instância;
- identidade técnica de menor privilégio e chave local criadas pelo bootstrap;
- catálogo inicial idempotente de skills;
- licença Apache-2.0;
- documentação e governança open source;
- ambiente Docker Compose com MongoDB, API e UI;
- bootstrap seguro do administrador;
- seed idempotente com dados fictícios;
- validação contínua com GitHub Actions;
- fundação do catálogo com workspace padrão e API protegida de aplicações.
- contexto obrigatório de aplicação para issues e demandas e definido por tipo
  para documentos;
- autorização por workspace e por conjunto de aplicações;
- topologia operacional com componentes, repositórios, servidores, deployments,
  runtimes, consultas reversas e contexto agregado limitado.
- tools MCP para workspaces, aplicações e topologia;
- interfaces de catálogo e servidores na UI;
- runbook de backup, restauração, atualização, rollback e troubleshooting;
- validação de instalação limpa e testes MongoDB reais no CI.
- logs JSON estruturados de ciclo de vida, acesso e erros, com correlação por
  `X-Request-Id` e omissão de credenciais, payloads e query strings;

### Fixed

- API atualizada de `0.6.0` para `0.6.1` e MCP de `0.12.1` para `0.12.2`:
  ambos aceitam datas nulas em comentários de issues importados sem uma data
  reconhecível, evitando erros `INVALID_UPSTREAM_PAYLOAD` com status `502` ao
  consultar issues e seus comentários;

- MCP `0.12.1` aceita `applicationId` e `identifier` nulos nas respostas válidas
  de documentação, evitando erros `INVALID_UPSTREAM_PAYLOAD` com status `502`
  nas consultas de documentos de workspace e sem identificador opcional;

- MCP `0.9.0` consulta demandas diretamente por ID ou pelo filtro exato de
  código, sem depender da listagem paginada para localizar tarefas;
- MCP `0.8.0` passa a declarar os status aceitos por
  `demands_update_task_status` e mantém o transporte ativo quando a validação
  de uma chamada falha;
- seed criava listas, taxonomia e coleções de documentos fora do workspace;
- logotipo da UI não era incluído no bundle de produção;
- criação concorrente de uma issue podia ultrapassar a verificação de
  unicidade.
- limite de upload do Nginx alinhado a `BIAWS_API_MAX_ATTACHMENT_BYTES`;
- configuração de cookies seguros aplicada explicitamente ao Better Auth.
- rotação de chaves técnicas habilitada em bases restauradas com metadados do
  Better Auth;
- grupos de sistema reconciliados com a versão atual do catálogo de permissões,
  incluindo leitura de anexos pelo agente operacional.

### Security

- atualização do PostCSS para uma versão corrigida para
  `GHSA-r28c-9q8g-f849`;
- remoção do script de bootstrap que continha credencial versionada.
- respostas `500` deixam de expor mensagens e stacks internos; detalhes
  permanecem disponíveis somente nos logs correlacionados da API.
