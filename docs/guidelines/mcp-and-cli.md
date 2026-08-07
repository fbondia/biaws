# MCP e CLI

MCP e CLI são interfaces programáticas sobre a mesma API. Eles não possuem uma
via privilegiada de acesso a dados e devem preservar as mesmas fronteiras de
autorização e tenancy.

## Princípios comuns

- usar somente a API HTTP;
- enviar a chave por header e nunca registrá-la;
- selecionar o workspace pelo mecanismo comum do cliente HTTP;
- validar argumentos antes de iniciar uma mutação;
- manter erros úteis, sem incluir stack ou segredo na saída normal;
- limitar chamadas HTTP com timeout e propagar cancelamento do cliente;
- oferecer paginação e limites em operações de lista;
- preferir operações intencionais de domínio a primitivas genéricas.

## Nova ferramenta MCP

Uma ferramenta possui três partes:

1. JSON Schema e descrição na definição da tool;
2. função de service que valida e traduz a operação;
3. endpoint autorizado na API.

A definição deve:

- usar nome `dominio_acao` em `snake_case`;
- começar a descrição com o resultado que a ferramenta produz;
- declarar `required`, limites, enums e `additionalProperties` conscientemente;
- diferenciar argumentos de leitura dos de mutação;
- não aceitar connection string, nome de coleção ou query Mongo;
- descrever defaults que realmente sejam aplicados.

O service deve:

- normalizar strings e arrays antes do envio;
- rejeitar combinações ambíguas;
- usar `cleanParams`, `fetchJson`, `sendJson`, `deleteJson` ou
  `sendMultipart` conforme o contrato;
- preservar o erro HTTP relevante para o chamador;
- devolver falhas funcionais de `tools/call` com `isError: true`; erros JSON-RPC
  ficam restritos ao protocolo e sempre usam códigos numéricos;
- não reimplementar permissão ou regras de persistência.

Ferramentas destrutivas ou irreversíveis precisam de identificadores explícitos
e descrição inequívoca. Quando houver alternativa segura, ofereça inspeção ou
dry run antes da efetivação.

## Compatibilidade MCP

- adicionar campo opcional é preferível a mudar o significado de um existente;
- remover/renomear tool ou argumento requer transição documentada;
- schemas devem permanecer compatíveis com o protocolo anunciado pelo servidor;
- a saída é conteúdo estruturado serializável e não deve depender de texto de
  terminal;
- alterações em catálogo, nome ou schema exigem teste de `tools/list` e dispatch.

## Novo comando CLI

Separe:

- parsing genérico em `args.js`;
- seleção do domínio em `index.js`;
- comportamento em `commands/<dominio>.js`;
- transporte em `apiClient.js`;
- arquivos locais em módulos com validação de path dedicada.

Todo comando deve definir:

- uso e opções no help;
- argumentos obrigatórios e mensagem de erro;
- saída humana concisa;
- `--json` quando a saída for útil para automação;
- exit code diferente de zero em falha;
- comportamento idempotente ou confirmação para substituição;
- teste de parsing e comportamento principal.

`console.log` é adequado para a saída intencional do CLI. Não é adequado para
imprimir debugging, objetos internos, variáveis de ambiente ou segredos.

## Arquivos e skills

Ao ler ou instalar pacotes locais:

- resolva e valide o path antes da operação;
- rejeite path traversal e links simbólicos inesperados;
- imponha limites de arquivos e bytes;
- preserve backup quando uma opção explícita substituir conteúdo;
- não execute código contido no pacote durante inspeção/instalação;
- valide `SKILL.md` e metadata antes de publicar.

## Checklist

- [ ] endpoint API autorizado existe e tem testes
- [ ] nome, descrição e schema MCP são precisos
- [ ] limites e campos obrigatórios estão no schema e no service
- [ ] nenhuma operação acessa MongoDB diretamente
- [ ] erro HTTP é preservado sem vazar segredo
- [ ] help e modo JSON do CLI foram atualizados quando aplicável
- [ ] README e testes foram atualizados
