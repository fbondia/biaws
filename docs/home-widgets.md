# Home configurável e catálogo de widgets

A home do Bondia Workspaces é um board pessoal, persistido por usuário e
workspace. O usuário pode adicionar várias instâncias do mesmo widget,
reordená-las, escolher seu tamanho e definir configurações próprias para cada
instância.

## Catálogo inicial

| Widget                         | Permissão dos dados | Configuração                       |
| ------------------------------ | ------------------- | ---------------------------------- |
| Chamados na semana ou no mês   | `issues.read`       | período: semana ou mês atual       |
| Chamados abertos por aplicação | `issues.read`       | —                                  |
| Chamados abertos por tipo      | `issues.read`       | —                                  |
| Tarefas pendentes              | `demands.read`      | —                                  |
| Saúde das aplicações           | `runtimes.read`     | aplicação, ambiente e apresentação |

O catálogo devolvido pela API contém somente widgets cujos dados o ator pode
consultar. O escopo de aplicações de cada permissão também é aplicado às
métricas. Uma configuração antiga não amplia acesso caso as permissões do
usuário sejam reduzidas.

O widget de monitoramento lista somente runtimes que já receberam ao menos um
sinal externo. Os totais `OK` e `NOK` são calculados por runtime; qualquer estado
A apresentação em lista é agrupada por aplicação, componente e deployment e
identifica o servidor associado a cada runtime. A apresentação em abas exibe os
metadados do último sinal e sinaliza os runtimes cujo estado não é `healthy`.
Aplicações e runtimes sem sinais não aparecem.
Cada linha informa a última entrada consolidada (data, origem e mensagem). Ao
selecionar um runtime, a Home consulta e apresenta seus 20 sinais mais recentes,
do mais recente para o mais antigo.

## Contratos HTTP

```http
GET /api/home
```

Retorna:

- `catalog`: definições disponíveis, configuração e tamanho padrão;
- `configuration.widgets`: instâncias ordenadas do usuário;
- `applications`: opções acessíveis para widgets configuráveis;
- `data`: resultado de cada widget, indexado pelo ID da instância;
- `generatedAt`: instante da leitura.

O widget de tarefas pendentes carrega inicialmente 6 itens. Os lotes seguintes
são obtidos pelo endpoint paginado abaixo, sempre preservando o escopo de
`demands.read` do ator:

```http
GET /api/home/pending-tasks?page=2&limit=6
```

A resposta informa `value` (total de pendentes), `items`, `page`, `limit` e
`hasMore`. Cada item inclui `requestId`, usado pela interface para abrir a
melhoria diretamente na tarefa selecionada.

```http
PUT /api/home/configuration
Content-Type: application/json

{
  "widgets": [
    {
      "id": "billing-health",
      "widgetId": "application-health",
      "size": "medium-2",
      "config": {
        "applicationId": "<application-id>",
        "environment": "production"
      }
    }
  ]
}
```

São aceitas até 30 instâncias. Os tamanhos seguem uma grade de 12 colunas:
`small` ocupa 3 colunas, `medium-1` ocupa 4, `medium-2` ocupa 6 e `large`
ocupa 12. Configurações antigas com `medium` são convertidas automaticamente
para `medium-2`, preservando a largura original.
O ID da instância é distinto do tipo em `widgetId`; isso permite repetir um
widget com configurações diferentes.
O widget `application-health` aceita `applicationId` e `environment` opcionais,
além de `presentation` com os valores `list` ou `tabs`. Quando uma aplicação é
selecionada, a configuração permite restringir progressivamente por
`componentId`, `deploymentId` e `runtimeId`. Um runtime específico força a
apresentação detalhada, sem exibir as barras de abas.
Os ambientes válidos são `development`, `test`, `staging`, `production` e
`other`; quando omitido, o widget considera todos os ambientes. Quando definido,
o ambiente selecionado aparece no subcabeçalho do widget.

## Como adicionar um widget ao produto

1. Acrescente a definição declarativa em `HOME_WIDGET_CATALOG`, incluindo
   permissão, categoria, tamanho e campos de configuração.
2. Valide a configuração em `normalizeConfiguration`.
3. Implemente o resolvedor de dados em `resolveWidgetMetric`, sempre aplicando o
   workspace e o escopo de aplicação da permissão.
4. Adicione o renderer e o ícone correspondentes na UI.
5. Cubra normalização, autorização, métricas e apresentação com testes.

Configurações pessoais ficam na coleção `homeConfigurations`, com chave única
por `workspaceId` e `userId`. Não há migração obrigatória: usuários sem registro
recebem o layout inicial compatível com suas permissões.
