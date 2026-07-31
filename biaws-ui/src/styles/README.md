# Arquitetura de estilos

`src/styles.css` é apenas o ponto de entrada e define a ordem da cascata. Novas
regras não devem ser adicionadas diretamente nele.

## Diretórios

- `foundations/`: tokens, reset, base global e acessibilidade.
- `layout/`: estrutura da aplicação, como shell e navegação.
- `shared/`: estilos reutilizados por mais de um domínio.
- `features/`: estilos pertencentes a uma funcionalidade específica.

Issues e Requests são subdivididos por módulo para evitar arquivos monolíticos.
As media queries ficam junto do módulo que alteram. A exceção atual é
`features/requests/responsive.css`, porque suas regras coordenam vários módulos
da tela de melhorias.

## Convenções

1. Use variáveis de `foundations/tokens.css` para cores, espaçamento, raios,
   alturas de controles e níveis de sobreposição.
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

Ao mover regras existentes, preserve primeiro a ordem dos imports e valide o
build antes de alterar especificidade ou introduzir novos layers de cascata.
