# Como contribuir

Obrigado pelo interesse em melhorar o Bondia Workspaces. O projeto está em fase alpha,
portanto propostas pequenas, verificáveis e acompanhadas de contexto são
especialmente valiosas.

## Antes de começar

1. Pesquise issues e pull requests existentes.
2. Para alterações grandes, abra uma discussion ou issue descrevendo problema,
   proposta, alternativas e impacto de compatibilidade.
3. Não inclua dados reais de clientes, credenciais, e-mails, dumps ou anexos.
4. Leia o [Código de Conduta](CODE_OF_CONDUCT.md) e a
   [Política de Segurança](SECURITY.md).
5. Consulte as [guidelines de desenvolvimento](docs/guidelines/INDEX.md), em
   especial as fronteiras arquiteturais, testes e o checklist de mudança.

## Ambiente

Use Node.js 20.19 ou mais recente. O caminho mais rápido para executar o sistema
completo é:

```bash
./scripts/check-prerequisites.sh --include-git
./scripts/bootstrap.sh
```

Para trabalhar sem containers, siga o README de cada módulo.

## Organização

- `biaws-api`: API, autenticação, persistência e auditoria;
- `biaws-ui`: aplicação React;
- `biaws-mcp`: servidor MCP;
- `biaws-cli`: gerenciamento local de skills;
- `shared`: contratos compartilhados;
- `docker` e `scripts`: execução reproduzível.

## Qualidade

Antes de enviar uma contribuição, execute:

```bash
cd biaws-api && npm run format:check && npm run check && npm test
cd biaws-ui && npm run format:check && npm run check:css && npm test && npm run build
cd biaws-mcp && npm run format:check && npm run check && npm test
cd biaws-cli && npm run format:check && npm run check && npm test
```

Novos comportamentos devem incluir testes proporcionais ao risco. Alterações de
UI devem considerar teclado, foco, contraste e layout móvel.

Use o [checklist de mudança](docs/guidelines/change-checklist.md) para selecionar
as validações aplicáveis e registrar no pull request o que não foi executado.

## Pull requests

- mantenha o escopo pequeno;
- explique a motivação e as decisões relevantes;
- indique como a alteração foi validada;
- destaque migrações, incompatibilidades e efeitos de segurança;
- atualize documentação e changelog quando o comportamento público mudar.

Ao enviar uma contribuição, você concorda que ela seja licenciada sob a Apache
License 2.0, conforme a seção 5 da licença.
