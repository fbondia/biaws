# Inventário de skills para distribuição

As fontes mantidas em starter-skills continuam atendendo clientes locais.
As variantes em plugins/biaws/skills usam apenas o catálogo MCP remoto atual;
não dependem das skills instaladas no computador do autor.

| Skill de origem                    | Decisão                   | Motivo                                                                             |
| ---------------------------------- | ------------------------- | ---------------------------------------------------------------------------------- |
| biaws-operate-workspace            | Adaptada                  | Domínio MCP, conexão vinculada ao workspace, escritas autorizadas e releitura      |
| biaws-classify-issue               | Adaptada                  | Catálogo atual, sem fallback para ferramenta inexistente                           |
| biaws-contextualize-improvement    | Adaptada                  | Somente leitura de melhoria/topologia                                              |
| biaws-create-improvement           | Adaptada                  | Contexto por MCP e fontes fornecidas, sem checkout                                 |
| biaws-plan-improvement             | Adaptada                  | Tarefas e evidências por MCP                                                       |
| biaws-configure-runtime-monitoring | Não incluída nesta versão | Configuração de execução REST/Shell exige workflow específico e validação dedicada |
| biaws-build-monitoring-tool        | Não incluída              | Implementa código e requer executor local                                          |
| biaws-implement-work-item          | Não incluída              | Checkout, testes e commits são capacidades locais                                  |
| biaws-release-improvement          | Não incluída              | Publicação/deployment requer ambiente e autorização externos                       |
| biaws-discover-application         | Não incluída              | Investiga código e manifests locais                                                |
| biaws-discover-infrastructure      | Não incluída              | Investiga manifests/IaC locais                                                     |
| biaws-discover-secret-inventory    | Não incluída              | Investiga referências em arquivos/configuração locais                              |
| setup (nova)                       | Incluída                  | URL, autenticação no navegador, workspace e revogação                              |

As seis skills são autocontidas, sem scripts ou assets instrucionais omitidos.
A skill de operação incluída fornece as regras comuns citadas pelas demais.
Ferramentas descobertas pelo host podem receber namespace; use os nomes de
domínio para identificá-las no catálogo disponível, sem depender do prefixo.

Onboarding não altera a URL do servidor do pacote nem cria autorização por tool.
O host configura OAuth; nenhuma credencial é solicitada na conversa.
O roteiro de validação inclui leitura de melhoria, proposta/criação solicitada,
classificação sem escrita e aplicação solicitada, recusa, revogação e reconexão.
A execução no ChatGPT real será registrada em P16, separada dos testes estáticos.
