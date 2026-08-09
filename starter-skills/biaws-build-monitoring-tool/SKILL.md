---
name: biaws-build-monitoring-tool
description: Descobrir o runtime correto no Bondia Workspaces, discutir o que e como monitorar, propor uma ferramenta aderente às linguagens e padrões do workspace e implementá-la somente após aprovação do desenho. Usar quando o usuário pedir para criar, projetar, adaptar ou revisar probes, health checks, coletores, agentes, scripts ou integrações que enviem sinais de monitoramento ao BIAWS.
---

# Construir ferramenta de monitoramento

Construir um emissor externo para o monitoramento passivo do BIAWS. Usar `biaws-operate-workspace` para acesso seguro e manter descoberta, proposta e implementação como fases distintas.

## Regra central

Não editar código, instalar dependências, executar probes nem emitir sinais durante a descoberta. Apresentar uma proposta concreta e obter aprovação explícita do alvo e da abordagem antes de implementar, mesmo quando o pedido inicial disser “crie” ou “implemente”.

## 1. Descobrir o alvo

Resolver a hierarquia completa `workspace → aplicação → componente → deployment → runtime`:

1. usar `workspaces_list` e `workspaces_get` para confirmar o workspace;
2. usar `applications_list`, `applications_get` e `applications_get_context` para identificar aplicações candidatas;
3. usar `components_list` e `components_get` para confirmar a unidade observada;
4. usar `deployments_list` e `deployments_get` para confirmar ambiente e configuração implantada;
5. usar `runtimes_list` e `runtimes_get` para selecionar a instância ou grupo que receberá os sinais.

Relacionar candidatos ao pedido e às evidências locais. Informar IDs, nomes, ambiente, correspondência, confiança e lacunas. Não escolher silenciosamente entre candidatos plausíveis.

Quando a topologia estiver ausente ou desatualizada, apresentar a sugestão e recomendar `biaws-discover-infrastructure`; não criar nem alterar catálogo como efeito colateral desta skill.

## 2. Investigar o workspace

Ler `AGENTS.md` e inspecionar somente fontes autorizadas com `rg`:

- linguagens, runtimes, manifests, gerenciadores de pacotes e bibliotecas existentes;
- scripts, probes, health endpoints, métricas, logs e padrões de observabilidade;
- Docker, Kubernetes, IaC, pipelines, schedulers e runbooks;
- testes, convenções de configuração e estratégia de implantação.

Não executar aplicações, containers, CLIs cloud, rede ou endpoints nesta fase. Não ler valores de segredos; identificar apenas nomes e mecanismos de injeção.

Respeitar a linguagem escolhida pelo usuário quando viável. Sem preferência, recomendar a alternativa que melhor reutilize o toolchain, bibliotecas, execução e manutenção já existentes. Não introduzir uma linguagem nova sem benefício concreto.

## 3. Discutir o monitoramento

Usar [references/monitoring-design.md](references/monitoring-design.md) para esclarecer o que ainda não puder ser inferido. Discutir pelo menos:

- objetivo operacional e falhas que precisam ser detectadas;
- fonte observável e ponto de vista da medição;
- status, métricas, limiares e dados diagnósticos;
- intervalo, timeout, retries, tolerância e tratamento de dados antigos;
- local de execução, scheduler, ambientes e permissões;
- formato do sinal BIAWS, idempotência e retenção;
- critérios de teste, implantação, manutenção e custo.

Fazer perguntas focadas somente nas decisões que alterem materialmente o desenho. Não preencher lacunas com certeza fictícia.

## 4. Propor antes de implementar

Apresentar uma proposta autossuficiente contendo:

- alvo completo com IDs e evidências;
- comportamento monitorado e limites do que o sinal prova;
- mapeamento para `unknown`, `healthy`, `degraded`, `unavailable` e `stopped`;
- intervalo, timeout, retries, backoff e prevenção de flapping;
- `source`, estratégia de `signalId`, `metadata`, `payload` e `metadataProfile` quando confirmado;
- linguagem recomendada, justificativa e alternativas relevantes;
- arquitetura, arquivos, dependências, configuração, execução e agendamento;
- testes, segurança, observabilidade da própria ferramenta e pontos em aberto.

Pedir aprovação explícita da proposta. Se o usuário mudar uma decisão material, atualizar a proposta antes de implementar.

## 5. Implementar após aprovação

1. Respeitar instruções locais e alterações preexistentes do usuário.
2. Fazer a menor implementação operacionalmente completa, reutilizando padrões e dependências existentes.
3. Preferir um executor de uma única rodada e deixar o agendamento para o mecanismo já usado pelo workspace, salvo justificativa para processo residente.
4. Implementar configuração externa, timeouts, retries com backoff, logs estruturados, códigos de saída e modo `dry-run` que nunca envie sinais.
5. Preferir `biaws monitoring signal` quando o CLI já fizer parte do ambiente operacional. Usar HTTP direto somente quando a implantação exigir e o contrato estiver confirmado.
6. Usar UTC em `observedAt`, `signalId` estável por evento ou janela e tratar HTTP `200` e `201` como sucesso.
7. Separar falha da ferramenta de falha comprovada do alvo. Não classificar automaticamente erro local de DNS, credencial ou rede como indisponibilidade do runtime.
8. Não registrar tokens, headers, strings de conexão, conteúdo sensível ou valores de segredos em logs, `metadata` ou `payload`.
9. Testar mapeamento de estados, idempotência, timeout, retries, serialização, redaction e `dry-run`.

Implementar não autoriza instalar ou implantar o monitor, acessar produção nem emitir um sinal real. Executar essas ações somente quando o usuário também as solicitar e o alvo estiver confirmado.

## 6. Entregar

Informar arquivos criados, linguagem e dependências, comandos de teste, variáveis de configuração sem valores, alvo BIAWS, política de estados, forma de execução e itens ainda necessários para agendar ou implantar.

Não afirmar que o runtime passou a ser monitorado até a ferramenta estar implantada, agendada e ter produzido um sinal verificável.

## Limites

- Não usar `GET /api/health` do BIAWS como saúde das aplicações cadastradas.
- Não criar runtime fictício para acomodar uma ferramenta.
- Não misturar monitoramento com alerta, remediação automática ou restart sem escopo e autorização próprios.
- Não emitir sinais de saúde baseados apenas em configuração estática.
