# Bondia Workspaces UI

UI React para pessoas operarem trabalho, topologia, monitoramento, conhecimento
e controles de acesso expostos pelo `biaws-api`.

## Execução

Em um terminal, suba a API:

```bash
cd ../biaws-api
npm install
npm run dev
```

Em outro terminal, suba a UI:

```bash
npm install
npm run dev
```

Por padrão a UI roda em `http://127.0.0.1:4400` e usa proxy para `http://127.0.0.1:3100`.

Se precisar apontar para outra API:

```bash
VITE_BIAWS_API_URL=http://127.0.0.1:3100 npm run dev
```

## Recursos

- Catálogo de aplicações com busca, criação, edição, arquivamento e histórico
- Topologia por aplicação: componentes, repositórios, deployments e runtimes
- Inventário de servidores com referências reversas de runtimes e deployments
- Relações e filtros por aplicação e componente em issues, melhorias e
  procedimentos
- Documentos unificados com seletores para regras, decisões, guidelines,
  features e referências técnicas, formulários por tipo, revisões e relações
- Ações e áreas de navegação condicionadas às permissões do ator autenticado
- Filtros por texto, código, tipo, status e intervalo de datas
- Seleção do campo de data usado nos filtros
- Calendário de jornadas das melhorias com filtros de meses antes e depois do
  mês atual (campos vazios mantêm o período sem limite) e opção de mostrar apenas
  melhorias cujo total previsto difere do executado. O desbalanceamento considera
  toda a melhoria; as linhas e os totais exibidos consideram o período filtrado.
  Grupos expandidos mantêm as células de jornadas vazias; seus totais mensais e
  acumulados aparecem somente quando contraídos, incluindo o total geral.
  Cada célula usa uma barra proporcional: azul para jornadas previstas e
  executadas, amarelo para previsões pendentes e verde para execução excedente.
  Os números abaixo da barra seguem a ordem executadas / previstas; o tooltip
  e a descrição acessível detalham as quantidades de cada segmento.
- Paginação
- Importação de múltiplos arquivos EML por drag-and-drop, com dry-run individual antes da gravação
- Ordenação básica
- Resumos agregados por data, semana, mês, ano, tipo e status
- Gerenciamento da taxonomia de issues com upload de JSON, rascunho local e gravação do pacote inteiro via `PUT /api/issues/taxonomy`
- Classificação de issue no diálogo de detalhes, com taxonomia principal, taxonomias secundárias e tags por grupo gravadas em `issues.classification`
- Resumo em Markdown na aba Descrição, antes da descrição completa, com salvamento
  independente dos assuntos e tags da aba KB.
- Imagens dos anexos exibidas no resumo, na descrição e nos comentários quando
  referenciadas por `[anexo: imagem.png]`, `[cid:identificador]` ou por uma
  imagem Markdown com destino `attachment:identificador`. Os editores permitem selecionar uma
  imagem já carregada para inserir sua referência por ID (ou índice nos anexos
  importados). Referências por nome ou CID precisam identificar um único arquivo;
  anexos ausentes, ambíguos ou de outros tipos permanecem como texto. O conteúdo
  é buscado pela API com autenticação, workspace e permissão de leitura de anexos.
- Comentários sem data conhecida exibem “Data não identificada” e podem ser
  salvos com o campo de data vazio. Editar apenas o texto preserva a data e o
  horário existentes, inclusive uma data desconhecida (`null`).
- Cores por grupo de tags, filtros por tag e exibição de tags na grid de issues
- Home pessoal com widgets configuráveis e filtrados pelas permissões do ator
- Histórico de publicações por deployment
- Runtimes, templates e histórico agregado de monitoramento
- Catálogo de skills e documentos tipados em Markdown
- Cofre de segredos, usuários, grupos, listas de opções e auditoria funcional

Enquanto houver somente o workspace padrão, a UI o resolve automaticamente e
não apresenta um seletor de tenant. Autorização e validação das relações
continuam sendo responsabilidades da API.

## Verificação

```bash
npm test
npm run check:css
npm run build
```
