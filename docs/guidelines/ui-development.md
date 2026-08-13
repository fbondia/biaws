# Desenvolvimento de UI

A UI é uma aplicação React funcional, acessível e responsiva. Ela apresenta o
estado autorizado pela API; não é a fonte de verdade para permissões ou regras
de persistência.

## Organização por responsabilidade

```text
src/
├── api/                 # transporte HTTP por domínio
├── components/          # UI organizada por domínio
├── constants/           # constantes realmente estáveis
├── styles/              # cascata global organizada
└── utils/               # utilitários transversais pequenos
```

Dentro de uma feature complexa, prefira:

```text
FeatureView/
├── index.jsx            # composição principal
├── components/          # partes visuais
├── hooks/               # estado e efeitos
└── model.js             # lógica pura
```

Extraia apenas responsabilidades existentes. Uma pasta com muitos arquivos
triviais também prejudica a navegação.

Quando um componente passar a possuir arquivos acessórios exclusivos — por
exemplo modelo, hook, diálogo, tab ou subcomponente — transforme o componente
em uma pasta com seu nome e use `index.jsx` como ponto público. Mantenha esses
arquivos dentro dessa pasta, distribuídos por `components/`, `hooks/`, `tabs/`,
`dialogs/` ou `models/` quando houver mais de uma responsabilidade do mesmo
tipo. Um único modelo puro continua preferencialmente em `model.js`.

Não mova para a pasta de um componente um módulo realmente compartilhado por
múltiplas features do domínio. Nesse caso, mantenha-o no menor ancestral comum
e use um nome que expresse o contrato compartilhado.

## Componentes

- use componentes funcionais e hooks;
- mantenha props orientadas ao domínio, não a detalhes do DOM;
- derive valores durante renderização ou em `useMemo`; não duplique estado sem
  necessidade;
- componentes visuais recebem dados e callbacks explícitos;
- funções puras de normalização, ordenação e cálculo ficam em modelos testáveis;
- preserve a API pública ao dividir um componente existente;
- não introduza um Context Provider para evitar props locais simples.

Considere decompor quando um componente mistura formulário, listagem, diálogo,
persistência e cálculos; ou quando uma alteração pequena exige entender a tela
inteira.

## Hooks e efeitos

- hooks customizados começam com `use`;
- efeitos sincronizam o componente com algo externo, não substituem funções de
  evento ou cálculos derivados;
- toda inscrição, timeout e request que sobreviva ao render precisa de cleanup;
- dependências de `useEffect`, `useMemo` e `useCallback` devem refletir os valores
  usados;
- evite efeitos que escrevem o mesmo estado do qual dependem sem uma condição
  estável;
- proteja respostas assíncronas contra unmount e respostas fora de ordem;
- debounce deve ter constante nomeada, cleanup e comportamento testável.

Se um hook coordena responsabilidades independentes, divida por comportamento,
por exemplo persistência de rascunho e colaboração, não por quantidade de linhas.

## API e erros

- chamadas HTTP ficam em `src/api/`;
- use o cliente comum para sessão, workspace e normalização de erro;
- componentes exibem mensagens públicas recebidas da API ou mensagens locais
  acionáveis;
- `401` e mudança de sessão seguem o fluxo central de autenticação;
- não reconstrua regras de autorização da API no frontend;
- esconder ou desabilitar uma ação melhora UX, mas não constitui segurança.

Atualizações otimistas precisam de rollback ou recarga determinística em caso de
falha. Persistência com debounce deve expor estado de salvamento e não perder a
última alteração no unmount.

## Acessibilidade

Toda interação deve funcionar com mouse, toque e teclado.

- use elemento HTML semântico antes de adicionar `role`;
- controles têm nome acessível;
- diálogos gerenciam foco inicial, contenção e retorno de foco;
- tabs, menus e listas seguem interação de teclado esperada;
- foco visível não deve ser removido;
- ícones decorativos não substituem texto necessário;
- mensagens de erro são associadas ao campo e perceptíveis;
- cor não é o único meio de comunicar estado;
- respeite redução de movimento quando houver animação.

## Responsividade e estilos

Siga [`biaws-ui/src/styles/README.md`](../../biaws-ui/src/styles/README.md).

- use tokens de `foundations/tokens.css`;
- estilos de feature usam prefixo reconhecível do domínio;
- evite seletores globais em features;
- mantenha media queries junto do módulo que alteram;
- valide 1120 px, 900 px e 720 px quando a mudança afetar layout;
- preserve a ordem da cascata ao mover CSS;
- não adicione regras diretamente ao entrypoint `styles.css`.

## Testes de UI

- transformações puras ficam em `model.js` e usam `node:test`;
- teste normalização, ordenação, filtros, estados derivados e builders;
- componentes críticos devem ganhar testes de interação quando houver harness de
  DOM adotado pelo projeto;
- fluxos críticos de autenticação, autorização e CRUD são candidatos à futura
  suíte E2E;
- mudança visual relevante exige inspeção em desktop e mobile.

## Checklist

- [ ] estados de loading, vazio, erro e sucesso tratados
- [ ] ação respeita permissão na UX e no backend
- [ ] teclado, foco e nome acessível verificados
- [ ] layout mobile verificado
- [ ] lógica pura extraída e testada quando relevante
- [ ] requests, timers e subscriptions possuem cleanup
- [ ] estilos usam tokens e escopo de feature
