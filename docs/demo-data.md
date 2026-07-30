# Dados de demonstração

O comando abaixo cria dados fictícios:

```bash
docker compose exec api npm run seed:demo
```

Para uma instância criada pelo seletor, use o arquivo e o projeto nomeados:

```bash
docker compose \
  --env-file instances/meu-projeto/.env \
  --project-name biaws-meu-projeto \
  exec api npm run seed:demo
```

O seed é idempotente e inclui:

- listas de opções padrão;
- taxonomia pequena de operação e produto;
- uma issue aberta e classificada;
- uma demanda com checklist, especificação, faturamento e tarefa;
- uma coleção e um procedimento de primeiros passos;
- um workspace, uma aplicação e um componente fictícios compartilhados pelos
  registros de demonstração.

O seed:

- não apaga dados;
- não sobrescreve uma taxonomia existente;
- não cria duplicatas quando executado novamente;
- identifica autoria com `demo-seed`;
- não contém nomes, e-mails ou conteúdo de clientes reais.
- cria listas, taxonomia e coleção de procedimentos dentro do workspace padrão.

A tarefa herda o contexto da demanda em sua representação na API, sem duplicar
os campos de workspace, aplicação e componentes na coleção `requestTasks`.

Para um ambiente vazio sem demonstração:

```bash
BIAWS_SKIP_DEMO_SEED=1 ./scripts/bootstrap.sh
```
