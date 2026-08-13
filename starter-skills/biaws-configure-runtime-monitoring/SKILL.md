---
name: biaws-configure-runtime-monitoring
description: Descobrir um runtime no Bondia Workspaces e modelar, testar, criar ou atualizar seu monitoramento por meio dos templates e monitores ativos expostos pelo MCP BIAWS. Usar quando o usuário pedir para criar, configurar, migrar, corrigir, revisar ou explicar um monitoramento REST, Shell ou manual de runtime, inclusive transformações JSONata, contratos de metadados, apresentação, intervalos, timeouts e credenciais referenciadas.
---

# Configurar monitoramento de runtime

Configurar o recurso nativo de monitoramento do BIAWS. Usar o MCP `biaws`, seguir `biaws-operate-workspace` para acesso seguro e não confundir esta skill com `biaws-build-monitoring-tool`, destinada a implementar emissores externos de monitoramento passivo.

Ler [references/monitoring-contracts.md](references/monitoring-contracts.md) antes de montar definições ou payloads.

## Princípios

- Tratar catálogo, templates, secrets e monitores persistidos como fontes de verdade; não inferir IDs.
- Separar descoberta, proposta, validação e persistência.
- Não executar endpoints, scripts ou sinais fora das operações de preview do BIAWS durante a modelagem.
- Nunca inserir credenciais em URL, headers literais, corpo, argumentos, ambiente, amostras, JSONata ou metadados. Usar referências de secrets.
- Não habilitar execução contra um alvo até o usuário aceitar runtime, provider, destino, intervalo, timeout e credenciais referenciadas.
- Reutilizar um template ativo compatível antes de criar outro.
- Considerar criação e ativação separadamente: criar não implica ativar versão nem habilitar monitor.

## 1. Resolver o alvo

Resolver `workspace → aplicação → componente → deployment → runtime`:

1. usar `workspaces_list` e `workspaces_get` para confirmar o workspace;
2. usar `applications_list`, `applications_get` e `applications_get_context` para localizar a aplicação;
3. usar `components_list` e `components_get` para confirmar o componente;
4. usar `deployments_list` e `deployments_get` para confirmar ambiente e deployment;
5. usar `runtimes_list` e `runtimes_get` para obter o runtime e sua referência estável.

Apresentar candidatos quando houver ambiguidade material. Não escolher silenciosamente por semelhança de nome e não alterar o catálogo como efeito colateral.

Usar `runtime_active_monitors_list` antes de propor criação para detectar duplicidade, reaproveitamento ou atualização. Em timeout ou resposta ambígua após uma escrita, listar novamente antes de repetir.

## 2. Definir o provider

### REST

Usar para uma URL HTTP(S) cuja resposta seja JSON. Confirmar método, URL, headers públicos, referências de headers sensíveis, corpo quando permitido, redirects, status HTTP esperados, intervalo e timeout.

Usar template quando o JSON precisar ser convertido em status, mensagem ou metadados de domínio. Para mera disponibilidade HTTP, admitir monitor sem template e explicar a limitação diagnóstica.

Não chamar o endpoint para descobrir seu contrato sem autorização explícita. Preferir amostra sanitizada fornecida pelo usuário, documentação ou evidência já autorizada.

### Shell

Usar somente quando o executor já possuir um `scriptId` permitido em sua allowlist local. Não aceitar caminho arbitrário. Exit code zero representa `healthy`; falha usa `failureStatus`. Shell não suporta template nem JSONata.

Tratar captura de stdout/stderr como diagnóstico potencialmente sensível. Usar `none` por padrão e habilitar `stdout`, `stderr` ou `both` somente quando houver necessidade e conteúdo seguro.

### Manual

Explicar o contrato de publicação passiva por API ou CLI e, quando necessário, configurar somente o template que interpretará o sinal. Não criar `runtime_active_monitor`: manual não é provider do executor ativo.

Se o usuário pedir implementação de um emissor externo, encaminhar para `biaws-build-monitoring-tool`.

## 3. Resolver ou modelar o template

1. Usar `monitoring_templates_list` com versões ativas e `monitoring_templates_get_contract` para procurar contrato compatível.
2. Usar `monitoring_templates_get` somente quando for necessário revisar uma definição completa ou criar nova versão.
3. Reutilizar uma versão ativa quando entrada, status, metadados e apresentação atenderem ao objetivo sem adaptação artificial.
4. Para um novo contrato, construir definição `schemaVersion: "1"`, amostra sanitizada, transformação JSONata, contrato de saída e apresentação coerentes.
5. Fazer a expressão retornar exatamente `{ status, message?, metadata }`. Declarar todo metadado produzido quando `additionalProperties` for `false`.
6. Usar `monitoring_templates_preview` com a definição e a amostra antes de qualquer persistência. Corrigir todos os erros e conferir status, mensagem, metadados e diagnóstico.

Não criar um template apenas para renomear um resultado já compatível. Não alterar uma versão existente: criar nova versão preservando histórico.

## 4. Propor e obter decisão

Apresentar uma síntese curta:

- alvo completo e referência do runtime;
- monitor existente afetado ou indicação de novo monitor;
- provider e destino sanitizado;
- intervalo, timeout e estado inicial;
- secrets referenciados, sem valores;
- template reutilizado ou definição proposta;
- exemplo do resultado do preview;
- efeitos de ativar uma versão ou habilitar o monitor.

Perguntar somente por decisões materiais ausentes. O pedido para analisar, modelar ou propor não autoriza persistência. Antes de ativar template ou habilitar monitor, obter aceitação explícita dos efeitos de execução.

## 5. Persistir com ordem segura

Quando autorizado:

1. criar template com `monitoring_templates_create`, ou nova versão com `monitoring_templates_create_version`;
2. reler com `monitoring_templates_get` e identificar a versão criada;
3. validar a versão persistida com `monitoring_templates_validate` e a amostra sanitizada;
4. ativar com `monitoring_templates_activate` somente quando autorizado; lembrar que outra versão ativa do mesmo template será inativada;
5. criar o monitor com `runtime_active_monitors_create` inicialmente desabilitado quando a execução ainda não estiver aprovada;
6. atualizar com `runtime_active_monitors_update` para habilitar somente após a decisão correspondente;
7. reler com `runtime_active_monitors_list` e conferir provider, configuração sanitizada, template, intervalo, timeout e estado.

Para atualizar monitor existente, enviar somente campos mutáveis intencionais e preservar os demais. Não arquivar template ou monitor salvo como tentativa automática de rollback; informar a falha e pedir direção quando a reversão puder afetar histórico ou uso existente.

## 6. Entregar

Informar IDs e versões persistidos, runtime, provider, intervalo, timeout, estado habilitado/desabilitado, template e resultado das validações. Distinguir claramente:

- `configurado`: recurso persistido;
- `habilitado`: elegível para execução;
- `executando`: executor provisionado e coletando leases;
- `observado`: existe resultado verificável no histórico.

Não afirmar que o runtime está sendo monitorado apenas porque a configuração foi criada.

## Limites

- Não ativar versão não validada.
- Não associar template a Shell.
- Não armazenar secret inline nem revelar valor obtido por outra ferramenta.
- Não criar monitor duplicado para contornar erro de atualização.
- Não provisionar `biaws-monitor-executor` nesta skill.
- Não inferir que falha do executor, DNS, credencial ou rede prova indisponibilidade do runtime.
