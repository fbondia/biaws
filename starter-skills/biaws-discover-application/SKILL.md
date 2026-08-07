---
name: biaws-discover-application
description: Descobre aplicações, componentes, repositórios e integrações a partir de evidências em código, documentação e configurações, compara o resultado com o catálogo BIAWS e propõe atualizações antes de gravá-las. Use ao iniciar o mapeamento de um projeto, importar um sistema existente ou revisar um inventário de aplicações sem preencher tudo manualmente.
---

# Descobrir contexto da aplicação

Transforme o contexto que já existe no projeto em uma proposta de inventário rastreável. Trabalhe em modo de descoberta por padrão: inspecione, compare e apresente as mudanças antes de escrever no BIAWS.

## Fluxo obrigatório

1. Identifique o workspace de destino. Antes de qualquer escrita, confirme também a aplicação quando ela já existir.
2. Consulte o catálogo atual do BIAWS pelas ferramentas MCP de domínio disponíveis. Nunca acesse o banco diretamente.
3. Delimite as fontes autorizadas. Inspecione somente o projeto e os documentos fornecidos pelo usuário; não varra diretórios pessoais ou outros repositórios.
4. Procure evidências com `rg --files` e `rg`. Priorize README, manifests de pacotes, arquivos de build, Dockerfile, Compose, manifests Kubernetes, infraestrutura como código, workflows de CI/CD, contratos OpenAPI e pontos de entrada.
5. Separe fatos observados de inferências. Uma dependência de SDK, por exemplo, sugere uma integração, mas não comprova que ela esteja ativa em produção.
6. Compare candidatos com entidades existentes e apresente o relatório de descoberta.
7. Faça alterações somente quando o usuário pedir o registro ou aprovar explicitamente a proposta. Use ferramentas MCP específicas do domínio e releia cada entidade alterada.

## Modelo do inventário proposto

Para cada candidato, informe:

- tipo de entidade: aplicação, componente, repositório ou integração;
- nome e identificador propostos;
- descrição e responsabilidade observadas;
- evidências com arquivo e linha, quando possível;
- relações sugeridas com outras entidades;
- correspondência existente no BIAWS;
- ação proposta: criar, atualizar, manter ou investigar;
- confiança alta, média ou baixa e dúvidas restantes.

Não invente identificadores, ambientes, proprietários, URLs ou relações. Quando não houver evidência suficiente, marque o campo como desconhecido.

## Critérios de classificação

- Trate como **aplicação** o produto ou sistema operado como uma unidade de negócio.
- Trate como **componente** uma unidade implantável ou operacionalmente independente. Não converta toda biblioteca interna em componente.
- Registre **repositório** apenas quando houver URL ou identidade observável no projeto ou no catálogo.
- Proponha **integração** quando houver cliente, contrato, endpoint configurável ou fluxo documentado. Uma dependência isolada recebe confiança baixa.
- Preserve as entidades existentes quando a evidência indicar apenas outro nome para o mesmo objeto.

## Limites de segurança

- Não execute aplicações, scripts de migração ou chamadas externas apenas para descobrir contexto.
- Não acesse provedores cloud, clusters ou serviços remotos sem autorização explícita.
- Não leia nem reproduza valores de segredos. Ao encontrar referências, delegue o inventário de metadados ao skill `$biaws-discover-secret-inventory` se ele estiver disponível.
- Não escreva no BIAWS durante uma solicitação de análise, diagnóstico ou proposta.

## Resultado esperado

Entregue primeiro um resumo do sistema, seguido da tabela de candidatos e das lacunas. Se houver aprovação para persistir, registre as mudanças, releia o catálogo afetado e relate o que foi criado, atualizado, mantido e deixado pendente.
