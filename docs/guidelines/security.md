# Segurança

Estas regras complementam [`SECURITY.md`](../../SECURITY.md) e a documentação de
autenticação/autorização da API. Elas orientam implementação e revisão; não
substituem um processo de resposta a vulnerabilidades.

## Confiança zero no cliente

- sessão, API key e workspace são resolvidos no backend;
- campos de workspace/aplicação enviados no payload são validados, não aceitos
  como autoridade;
- esconder um controle na UI não autoriza nem protege a operação;
- MCP e CLI recebem exatamente o escopo da identidade técnica;
- recursos fora do escopo retornam como inexistentes para evitar enumeração.

Toda nova rota de negócio deve ser negada por padrão até declarar sua permissão.

## Autenticação e autorização

- somente endpoints explicitamente públicos dispensam identidade;
- use os middlewares comuns de autenticação, permissão e escopo;
- permissões usam capacidade de domínio, não nome de tela;
- autorização por campo deve ser aplicada antes de usar o campo;
- operações administrativas exigem permissão específica;
- não reutilize permissão de leitura para uma mutação por conveniência;
- mudanças em permissões atualizam constantes compartilhadas, bootstrap/grupos,
  UI, testes e documentação.

Teste sempre uma identidade permitida e uma negada. Para escopo por aplicação,
teste também uma aplicação válida fora da lista autorizada.

## Multi-tenancy

- toda consulta multi-tenant inclui o `workspaceId` efetivo;
- referências cruzadas são verificadas dentro do mesmo workspace;
- `applicationId`, componente, deployment e runtime não podem ser combinados
  entre workspaces;
- filtros do cliente podem restringir, nunca ampliar, o escopo;
- IDs globalmente únicos não eliminam a obrigação de filtrar por tenancy;
- caches e arquivos também precisam de namespace e validação de escopo.

## Entrada e saída

- imponha limites de tamanho, quantidade, profundidade e paginação;
- normalize tipos antes de persistir;
- use allowlists para enums, campos mutáveis e metadata;
- recuse propriedades desconhecidas em contratos sensíveis;
- trate Markdown e conteúdo importado como não confiáveis;
- sanitize HTML antes de renderizar ou armazenar quando houver risco de execução;
- escape valores usados em regex ou comandos;
- nunca componha comandos shell com entrada não confiável.

Mensagens públicas não revelam existência de recursos fora do escopo, estrutura
de banco, path físico, stack ou configuração interna.

## Arquivos e EML

- limite bytes e quantidade no parser HTTP e no storage;
- valide extensão, tipo declarado e conteúdo quando necessário;
- nunca use nome original como path de storage;
- rejeite path traversal e links simbólicos;
- sanitize EML antes de efetivar a importação;
- mantenha dry run como padrão em fluxos de análise;
- aplique autorização novamente no download, não apenas no upload;
- exclua conteúdo e credenciais de logs/auditoria.

## Segredos

- use `.env` ignorado pelo Git e arquivos de instância protegidos;
- não passe segredo em argumento quando variável de ambiente ou stdin for
  possível;
- nunca inclua credencial em exemplo, fixture, screenshot ou mensagem de erro;
- redaction reduz impacto de acidente, mas não substitui evitar o log;
- se houver exposição, revogue primeiro e trate também o histórico Git.

## Abuso e disponibilidade

- listagens e agregações têm limites máximos;
- uploads e JSON têm limites de corpo;
- rotas autenticadas e Better Auth respeitam rate limits separados;
- operações caras devem filtrar por tenancy antes de ordenar/agregar;
- integrações externas precisam de timeout e tratamento de falha;
- endpoints de health não realizam trabalho de domínio pesado.

## Mudanças sensíveis

Exigem revisão explícita de segurança:

- autenticação, sessão, API keys e permissões;
- filtros de tenancy;
- upload, parsing, Markdown/HTML e arquivos locais;
- importação/exportação;
- execução de processo ou manipulação de paths;
- novas integrações e callbacks;
- migração ou exposição de dados;
- configuração de proxy, cookies, CORS e trusted origins.

## Checklist

- [ ] operação é negada sem identidade/permissão
- [ ] workspace e aplicação são derivados/validados no backend
- [ ] consultas e referências respeitam tenancy
- [ ] entrada e volume possuem limites
- [ ] saída e erros não permitem enumeração ou vazamento
- [ ] logs, auditoria e fixtures não contêm segredos/dados reais
- [ ] upload/path/parser foram tratados como entrada hostil
