# Checklist de mudança

Use este roteiro ao implementar e antes de abrir um pull request. Marque somente
itens aplicáveis; não execute módulos não afetados apenas para preencher uma
lista.

## 1. Entendimento

- [ ] problema e resultado esperado estão claros
- [ ] módulos e contratos afetados foram identificados
- [ ] limitações e decisões relevantes foram registradas
- [ ] o escopo evita refatorações não relacionadas

## 2. Arquitetura

- [ ] direção das dependências foi preservada
- [ ] UI, MCP e CLI continuam usando somente a API
- [ ] responsabilidade ficou na camada correta
- [ ] contratos compartilhados estão em `shared/` apenas quando há consumidores
      reais em mais de um módulo

## 3. Segurança e dados

- [ ] autenticação, permissão e escopo foram definidos
- [ ] `workspaceId`/`applicationId` são derivados ou validados no backend
- [ ] entrada, paginação, arquivos e metadata têm limites
- [ ] erros e respostas estão sanitizados
- [ ] nenhum segredo ou dado real entrou no código, teste, log ou documentação
- [ ] índices, concorrência e idempotência foram considerados
- [ ] mutações relevantes geram auditoria

## 4. Código

- [ ] nomes e estrutura seguem as convenções do módulo
- [ ] funções e componentes têm responsabilidade identificável
- [ ] dependência nova tem justificativa e licença compatível
- [ ] compatibilidade pública foi preservada ou documentada
- [ ] código temporário, debugging e artefatos gerados foram removidos

## 5. Testes

- [ ] comportamento novo/alterado possui teste proporcional ao risco
- [ ] correção de bug possui teste de regressão
- [ ] autorização/tenancy inclui caso negativo quando aplicável
- [ ] integração, concorrência ou idempotência foram testadas quando aplicável
- [ ] UI foi verificada com teclado e em layout móvel quando afetada

## 6. Documentação

- [ ] matriz código → documentação do `INDEX.md` foi consultada
- [ ] README/contrato do módulo foi atualizado quando necessário
- [ ] arquitetura, segurança, performance ou operação foram atualizadas quando
      necessário
- [ ] exemplos usam dados sintéticos e comandos válidos
- [ ] changelog foi atualizado se o comportamento público mudou

## 7. Validação

```bash
cd biaws-api && npm run format:check && npm run check && npm test
cd biaws-ui && npm run format:check && npm run check:css && npm test && npm run build
cd biaws-mcp && npm run format:check && npm run check && npm test
cd biaws-cli && npm run format:check && npm run check && npm test
```

- [ ] validações dos módulos afetados passaram
- [ ] bootstrap/Compose foi validado se configuração ou integração mudou
- [ ] falhas e validações não executadas estão declaradas no pull request

## 8. Pull request

- [ ] objetivo explica o problema e o resultado
- [ ] alterações estão agrupadas por responsabilidade
- [ ] validação informa comandos e inspeções realizadas
- [ ] compatibilidade, migração, segurança e rollback estão descritos
- [ ] diff final foi relido sem depender apenas dos testes
