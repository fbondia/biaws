# Validação de layouts responsivos

Inicie `npm run dev` em `biaws-ui` e abra
`http://127.0.0.1:4400/test/fixtures/ResponsiveHarness.html`.

O cenário usa componentes reais com dados sintéticos e carrega o CSS somente do
domínio selecionado. As chamadas à API ficam isoladas; o cenário não grava dados.

Verifique as larguras 320, 390, 720, 768, 1120 e 1440 px e a orientação paisagem
em 640 × 360 px. Os links no topo mudam o cenário, recarregando a página para
verificar também o primeiro acesso a cada domínio.

- Issues: os cartões devem caber na tela até 720 px, com ordenação, tipo e status
  acessíveis. Abra os detalhes e confira rolagem, abas e editor em tela cheia.
  Carregue o CSS de melhorias e confirme que os cartões continuam iguais.
- Melhorias: abra o registro, alterne para edição, checklist e tarefas. O diálogo
  da tarefa deve manter o rodapé visível e o conteúdo rolável mesmo em paisagem.
- Documentação: verifique o título e o texto longos na leitura e no diálogo de
  detalhes. A rolagem horizontal deve ficar dentro das tabelas e dos blocos de
  código, sem ampliar ou cortar o conteúdo do painel.
- Arquivos: confira nomes, tags, ações e prévias de Markdown, texto e HTML.
- Topologia: as opções devem iniciar recolhidas em celular; ao abri-las, os
  controles ficam roláveis e o gráfico continua com espaço disponível. Em desktop,
  as ferramentas permanecem visíveis.

Além da largura da página, compare `clientWidth` e `scrollWidth` dos painéis:
`overflow: hidden` pode esconder um layout incorreto sem ampliar a página.
Tabelas de issues em desktop, abas, tabelas Markdown e blocos de código são áreas
com rolagem horizontal intencional.
