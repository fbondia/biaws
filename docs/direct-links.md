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

## Referências e segurança

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
