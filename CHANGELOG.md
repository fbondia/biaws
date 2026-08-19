# Changelog

Mudanças relevantes deste projeto serão documentadas neste arquivo. O formato
segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o
versionamento seguirá [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Changed

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
  melhorias, tarefas e procedimentos, com Base64 limitado e associação de
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
  requests e procedures, mantendo volumes Docker nomeados como padrão;
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
- contexto obrigatório de aplicação para issues e demandas e opcional para
  procedimentos;
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

- seed criava listas, taxonomia e coleções de procedimentos fora do workspace;
- logotipo da UI não era incluído no bundle de produção;
- criação concorrente de uma issue podia ultrapassar a verificação de
  unicidade.
- limite de upload do Nginx alinhado a `ISSUE_API_MAX_ATTACHMENT_BYTES`;
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
