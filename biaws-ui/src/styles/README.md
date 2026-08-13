# Arquitetura de estilos

`src/styles.css` é o ponto de entrada global e contém somente foundations,
layout/shell e estilos compartilhados. CSS de domínio é importado pelo root da
feature correspondente e acompanha o chunk carregado para a visão. Novas regras
não devem ser adicionadas diretamente ao entrypoint global.

## Diretórios

- `foundations/`: tokens, reset, base global e acessibilidade.
- `layout/`: estrutura da aplicação, como shell e navegação.
- `shared/`: estilos reutilizados por mais de um domínio.
- `features/`: estilos pertencentes a uma funcionalidade específica.

Auth, Catalog, Home, Issues, Knowledge e Requests possuem um `index.css` local
que preserva explicitamente a ordem dos seus módulos. Os demais domínios usam o
arquivo CSS único como entrypoint enquanto ele continua coeso. As media queries
ficam junto do módulo que alteram; arquivos `responsive.css` existem somente
quando uma regra coordena várias famílias visuais da mesma feature.

Os roots de visão são carregados com `React.lazy`, portanto o build deve produzir
CSS separado por domínio. Um componente compartilhado que precisa de estilos
próprios, como `MonitoringEventDetails`, importa seu CSS diretamente e não
depende de um domínio consumidor.

## Convenções

1. Use variáveis de `foundations/tokens.css` para cores, espaçamento, raios,
   alturas de controles e níveis de sobreposição. Para cores, prefira tokens
   semânticos (`--color-danger-*`, `--color-success-*`, `--color-warning-*`,
   `--color-info-*` e `--color-shadow-*`). A paleta primitiva
   (`--palette-<família>-<posição>`) é reservada a composições visuais sem papel
   semântico compartilhado; não crie tokens nomeados pelo hexadecimal ou RGB.
2. Evite seletores globais de elementos em arquivos de feature. Tabelas de dados,
   por exemplo, devem ter uma classe raiz própria.
3. Classes compartilhadas devem representar um primitive estável, não detalhes
   de uma tela.
4. Classes de feature devem usar um prefixo reconhecível do domínio
   (`issue`, `request`, `taxonomy`, `skill`, `procedure`).
5. Novos breakpoints devem preferir 1120 px para reorganização ampla, 900 px
   para navegação/tablet e 720 px para layout mobile.
6. Estados interativos precisam funcionar com mouse, touch e teclado e manter
   foco visível.
7. CSS Modules podem ser usados para componentes autocontidos. Estilos que
   precisam ser compartilhados devem continuar em `shared/`.
8. Um arquivo dentro de `features/<domínio>/` só pode importar arquivos locais
   desse mesmo domínio. Dependências visuais compartilhadas pertencem a
   `shared/` e são importadas pelo componente proprietário.

## Hierarquia de cores

- tokens base descrevem superfícies, texto, bordas, ação e foco;
- tokens de feedback descrevem superfície, borda e texto por intenção;
- tokens de efeito descrevem anéis de foco, overlays e cores de sombra;
- tokens categóricos de domínio, como `--color-topology-*`, distinguem entidades
  sem transformar uma cor específica em contrato global;
- a paleta primitiva é o último recurso e organiza valores por família, do tom
  mais claro para o mais escuro.

Ao mover regras existentes, preserve primeiro a ordem dos imports e valide o
build antes de alterar especificidade ou introduzir novos layers de cascata.
