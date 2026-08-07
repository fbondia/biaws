---
name: biaws-discover-infrastructure
description: Descobre servidores, deployments, runtimes, rotas e sinais operacionais a partir de manifests e documentação, compara o resultado com o BIAWS e propõe atualizações baseadas em evidências. Use para mapear infraestrutura existente, revisar topologia ou importar contexto de Docker, Kubernetes, IaC e CI/CD sem inventário manual completo.
---

# Descobrir contexto de infraestrutura

Converta manifests e documentação operacional em uma proposta de topologia para o BIAWS. A descoberta é estática e não invasiva por padrão.

## Fluxo obrigatório

1. Identifique o workspace e, quando aplicável, a aplicação de destino antes de qualquer escrita.
2. Leia servidores, componentes, deployments e runtimes já catalogados pelas ferramentas MCP de domínio. Nunca consulte o banco diretamente.
3. Inspecione apenas fontes autorizadas no projeto: Dockerfile, Compose, Kubernetes, Helm, Terraform, Pulumi, CloudFormation, Ansible, systemd, Procfile, workflows de implantação e runbooks.
4. Extraia evidências de ambiente, unidade implantável, host ou serviço gerenciado, portas, protocolos, dependências e estratégia de execução.
5. Normalize os candidatos, compare-os com o catálogo e apresente um relatório antes de gravar.
6. Escreva somente após solicitação ou aprovação explícita do usuário. Use as ferramentas MCP específicas e releia as entidades alteradas.

## Semântica do mapa

- **Servidor** representa um host ou ativo gerenciado com identidade estável. Não crie um servidor para cada pod, tarefa efêmera ou container local.
- **Deployment** representa a configuração de implantação de um componente em um ambiente.
- **Runtime** representa uma instância ou grupo de execução observável associado a um deployment.
- **Rota** ou dependência representa comunicação apoiada por endpoint, service, ingress, regra de rede ou documentação explícita.
- **Sinal operacional** exige uma fonte observável. Configuração de monitoramento não comprova saúde atual.

## Modelo do inventário proposto

Para cada candidato, informe:

- tipo de entidade e nome proposto;
- aplicação, componente e ambiente relacionados;
- provedor, região, host, protocolo ou porta somente quando observados;
- evidências com arquivo e linha, quando possível;
- correspondência existente no BIAWS;
- ação proposta: criar, atualizar, manter ou investigar;
- confiança alta, média ou baixa e lacunas.

Não invente hosts, IPs, ambientes, estados de saúde, credenciais ou relações. Valores variáveis e placeholders devem permanecer como tais.

## Limites de segurança

- Não execute `ssh`, `kubectl`, CLIs cloud, scanners de rede ou probes HTTP sem autorização explícita.
- Não aplique manifests, não inicialize infraestrutura e não faça deploy durante a descoberta.
- Não leia arquivos de credenciais nem valores de segredos. Registre apenas referências seguras quando necessário.
- Não derive estado operacional atual de arquivos estáticos.
- Não escreva no BIAWS durante uma solicitação de análise, diagnóstico ou proposta.

## Resultado esperado

Entregue uma visão resumida da topologia, a tabela de candidatos, conflitos com o catálogo e pontos que exigem validação humana. Após uma escrita aprovada, releia o escopo e relate as mudanças e as lacunas restantes.
