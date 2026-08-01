# Home configurável e catálogo de widgets

A home do Bondia Workspaces é um board pessoal, persistido por usuário e
workspace. O usuário pode adicionar várias instâncias do mesmo widget,
reordená-las, escolher seu tamanho e definir configurações próprias para cada
instância.

## Catálogo inicial

| Widget                         | Permissão dos dados | Configuração                                    |
| ------------------------------ | ------------------- | ----------------------------------------------- |
| Chamados na semana ou no mês   | `issues.read`       | período: semana ou mês atual                    |
| Chamados abertos por aplicação | `issues.read`       | —                                               |
| Chamados abertos por tipo      | `issues.read`       | —                                               |
| Tarefas pendentes              | `demands.read`      | —                                               |
| Saúde das aplicações           | `runtimes.read`     | todas as aplicações ou uma aplicação específica |

O catálogo devolvido pela API contém somente widgets cujos dados o ator pode
consultar. O escopo de aplicações de cada permissão também é aplicado às
métricas. Uma configuração antiga não amplia acesso caso as permissões do
usuário sejam reduzidas.

O widget de monitoramento lista somente runtimes que já receberam ao menos um
sinal externo. Os totais `OK` e `NOK` são calculados por runtime; qualquer estado
diferente de `healthy` conta como `NOK`. A apresentação é agrupada por aplicação,
componente e deployment e identifica o servidor associado a cada runtime.
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

```http
PUT /api/home/configuration
Content-Type: application/json

{
  "widgets": [
    {
      "id": "billing-health",
      "widgetId": "application-health",
      "size": "medium",
      "config": {
        "applicationId": "<application-id>",
        "environment": "production"
      }
    }
  ]
}
```

São aceitas até 30 instâncias. Tamanhos válidos: `small`, `medium` e `large`.
O ID da instância é distinto do tipo em `widgetId`; isso permite repetir um
widget com configurações diferentes.
O widget `application-health` aceita `applicationId` e `environment` opcionais.
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
