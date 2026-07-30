# Status, releases e suporte

## Estágio

O projeto está em **alpha**. O foco atual é tornar instalação, contratos e
segurança reproduzíveis. Recursos podem mudar sem migração automática durante a
série `0.x`.

## Versionamento

O projeto adota Semantic Versioning:

- `0.x`: evolução alpha/beta, com possíveis incompatibilidades documentadas;
- `1.x`: primeiro contrato considerado estável;
- patches de segurança podem exigir atualização imediata.

Releases devem conter:

1. tag assinada ou identificável no Git;
2. changelog;
3. resultado do CI;
4. instruções de migração quando aplicável;
5. imagens de container identificadas pela mesma versão, quando publicadas.

## Suporte

Este é um projeto mantido em regime de melhor esforço, sem SLA.

- dúvidas e propostas: GitHub Discussions ou issues;
- bugs reproduzíveis: GitHub Issues;
- vulnerabilidades: fluxo privado descrito em `SECURITY.md`;
- dados operacionais reais não devem ser anexados a relatos públicos.

## Critérios para beta

| Critério | Situação |
| --- | --- |
| testes de integração HTTP com MongoDB | concluído para contexto, tenancy e topologia |
| cobertura das ferramentas MCP | concluído para contratos de catálogo e conhecimento |
| fluxos principais da UI | validação manual concluída; E2E automatizado pendente |
| instalação limpa validada em CI | workflow configurado; bootstrap e seed reproduzidos localmente |
| checksums e rollback defensivo no CLI | concluído |
| onboarding de agentes | seletor multi-instância, bootstrap técnico, catálogo inicial, Codex e Claude validados em CI |
| documentação de backup e restauração | concluído, com ensaio ainda obrigatório por release |

O projeto permanece alpha até existir uma suíte E2E da UI e pelo menos uma
release pública operada com o runbook atual.

## Critérios para 1.0

- contratos HTTP e MCP versionados;
- política de migração de dados;
- modelo de implantação suportado definido;
- observabilidade e readiness;
- onboarding e ciclo de vida suportado para múltiplos workspaces;
- histórico de releases sem regressões críticas conhecidas.

## Débitos deliberados

- storage local não suporta múltiplas réplicas;
- auditoria não é transacional com a mutação de domínio e não possui retenção;
- contratos HTTP não têm OpenAPI versionada;
- caminhos físicos de anexos legados ainda não incluem workspace/tipo;
- paginação usa `skip/limit`; cursores devem ser considerados para coleções
  muito grandes;
- não há observabilidade além de health check e logs dos processos;
- índices redundantes podem persistir após upgrade e devem ser revistos em uma
  cópia restaurada.
