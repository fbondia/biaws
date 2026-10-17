# URLs diretas da interface

A interface mantém o registro aberto na URL. Copie o endereço do navegador para
compartilhar ou reabrir o mesmo recurso. A abertura não depende da página,
coleção ou dos filtros atuais da listagem. Voltar e Avançar restauram a seleção.

Use `?workspaceId=<id-do-workspace>` em links compartilhados. A UI acrescenta o
workspace atual aos endereços antigos que não o informam. Após o login, o destino
é preservado e o workspace do link é selecionado antes de carregar os dados.
Trocar manualmente de workspace abre a seção no novo contexto, sem carregar o
registro do workspace anterior.

## Rotas

Todos os exemplos abaixo devem receber o parâmetro `workspaceId`.

| Recurso                           | Caminho                                             |
| --------------------------------- | --------------------------------------------------- |
| Documento                         | `/documents/:referencia`                            |
| Melhoria                          | `/requests/:referencia`                             |
| Tarefa de melhoria                | `/requests/:melhoria/tasks/:referencia`             |
| Issue                             | `/issues/:referencia`                               |
| Aplicação                         | `/catalog/:referencia`                              |
| Componente                        | `/catalog/:aplicacao/components/:referencia`        |
| Repositório                       | `/catalog/:aplicacao/repositories/:referencia`      |
| Integração                        | `/catalog/:aplicacao/integrations/:referencia`      |
| Deployment                        | `/catalog/:aplicacao/deployments/:referencia`       |
| Runtime no catálogo               | `/catalog/:aplicacao/runtimes/:referencia`          |
| Diagrama de topologia             | `/catalog/:aplicacao/topology-diagrams/:referencia` |
| Servidor                          | `/servers/:referencia`                              |
| Runtime no monitoramento          | `/operation/monitoring/runtimes/:referencia`        |
| Template de monitoramento         | `/operation/monitoring/templates/:referencia`       |
| Publicações de um deployment      | `/operation/environment/publications/:referencia`   |
| Skill                             | `/skills/:referencia`                               |
| Metadados de segredo              | `/secrets/:referencia`                              |
| Usuário                           | `/users/:id`                                        |
| Grupo de permissões               | `/groups/:referencia`                               |
| Lista de opções                   | `/option-lists/:referencia`                         |
| Assunto da taxonomia              | `/taxonomy/nodes/:id`                               |
| Grupo de tags                     | `/taxonomy/tag-groups/:id`                          |
| Workspace na administração global | `/workspaces/:referencia`                           |

Exemplos com dados sintéticos:

```text
/requests/MEL42/tasks/TASK1?workspaceId=workspace-exemplo
/issues/INC42?workspaceId=workspace-exemplo
/documents/guia-operacional?workspaceId=workspace-exemplo
/catalog/faturamento/components/api?workspaceId=workspace-exemplo
```

## Inserir links no editor Markdown

O botão **Inserir link de documento**, disponível para quem possui
`documents.read`, abre uma busca paginada nos documentos acessíveis do
workspace atual. Busque por título, identificador ou conteúdo, selecione um
documento e confirme em **Inserir link**. A busca exclui documentos arquivados.

O editor substitui o trecho selecionado ou insere na posição do cursor. No modo
de visualização, o link é acrescentado ao final. O texto usa o título do documento;
a URL usa seu ID estável e inclui automaticamente `workspaceId`, sem depender de
mudanças futuras no identificador. A funcionalidade também está disponível em
tela cheia. `Esc` cancela a seleção sem fechar a edição em tela cheia.

## Referências e segurança

### Links de resources MCP no Markdown

O editor aceita links Markdown, autolinks e URIs soltas do BIAWS:

```markdown
[Documento](biaws://workspaces/workspace-exemplo/documents/guia-operacional)
<biaws://workspaces/workspace-exemplo/issues/INC42>
biaws://workspaces/workspace-exemplo/demands/MEL42/tasks/TASK1
```

A visualização e o HTML gerado convertem esses links para as rotas da UI,
sempre usando o workspace da URI. O Markdown armazenado permanece intacto.
Abrir o link segue o fluxo normal de login, seleção de workspace e autorização
da interface e da API. Renderizar o Markdown não consulta os resources do MCP.

| Resource após `biaws://workspaces/:workspaceId`                              | Destino na UI                |
| ---------------------------------------------------------------------------- | ---------------------------- |
| raiz do workspace                                                            | Home do workspace            |
| `/documents/:id` ou `/documents/:id/content`                                 | Documento                    |
| `/issues/:id`                                                                | Issue                        |
| `/demands/:id`                                                               | Melhoria                     |
| `/demands/:id/tasks/:tarefa`                                                 | Tarefa da melhoria           |
| `/applications/:id`                                                          | Aplicação                    |
| `/applications/:app/components/:id`                                          | Componente                   |
| `/applications/:app/repositories/:id`                                        | Repositório                  |
| `/applications/:app/integrations/:id`                                        | Integração                   |
| `/applications/:app/deployments/:id`                                         | Deployment                   |
| `/applications/:app/runtimes/:id`                                            | Runtime no catálogo          |
| `/applications/:app/deployments/:deployment/runtimes/:id`                    | Runtime no catálogo          |
| `/applications/:app/topology-diagrams/:id`                                   | Diagrama de topologia        |
| `/applications/:app/deployments/:id/publications`                            | Publicações do deployment    |
| `/servers/:id`                                                               | Servidor                     |
| `/monitoring/templates/:id`                                                  | Template de monitoramento    |
| `/secrets/:id`                                                               | Somente metadados do segredo |
| `/skills/:id`, `/users/:id`, `/groups/:id`, `/option-lists/:id`              | Respectiva tela da UI        |
| `/classification-catalog`, `/taxonomy/nodes/:id`, `/taxonomy/tag-groups/:id` | Taxonomia                    |

Também são aceitas as coleções das entidades principais e as referências
curtas `/components/:id`, `/repositories/:id`, `/integrations/:id`,
`/deployments/:id` e `/runtimes/:id`. As referências curtas abrem rotas de mesmo
nome na UI; a API autorizada resolve a entidade e sua aplicação antes de
substituir o endereço pela rota canônica do catálogo. As permissões exigidas
pelas telas continuam valendo.

Cada segmento deve ser codificado com `encodeURIComponent`. URIs inválidas,
com parâmetros ou fragmentos, e resources sem rota equivalente (como revisão
individual, conteúdo binário de anexo ou auditoria) aparecem como texto sem
link. Versões específicas de templates também exigem uma rota própria e não
são convertidas silenciosamente para a versão atual. Código inline e blocos
de código preservam as URIs como código.

### Resolução de referências

A referência pode ser o ID público, o `_id` do MongoDB ou o identificador de
negócio disponível no domínio: `identifier`, `clientCode`, `code`, `key` ou
`skillId`. Listas usam sua `key`; assuntos e grupos de tags usam os IDs do
catálogo. Codifique cada segmento com `encodeURIComponent`, especialmente IDs
hierárquicos de taxonomia. Mongo IDs de skills e templates identificam uma
versão específica.

IDs têm precedência sobre identificadores de negócio. Um identificador ambíguo
exige o uso do ID; a aplicação não escolhe arbitrariamente um registro. Tarefas
são resolvidas dentro da melhoria e filhos de catálogo dentro da aplicação
indicada no endereço.

A URL não concede acesso. A sessão confirma o workspace e a API reaplica as
permissões e os escopos atuais. Recursos fora do workspace ou da aplicação
permitida retornam como inexistentes. Workspaces inacessíveis, rotas inválidas
e negações de acesso mantêm o endereço e exibem uma mensagem. Abrir um segredo
por URL carrega apenas seus metadados; revelar, copiar ou baixar o valor continua
exigindo uma ação explícita e suas permissões específicas.

As seções sem ID continuam funcionando. O proxy deve servir `index.html` para
rotas da UI, como já faz `docker/nginx.conf.template`; caminhos `/api` seguem
para a API.
