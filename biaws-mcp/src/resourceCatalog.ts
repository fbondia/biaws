export interface ResourceDefinition {
  uriTemplate: string;
  path: string;
  description: string;
  mimeType: string;
}
// Hierarchical read contracts; all persistence and authorization remain in the API.
export const RESOURCE_CATALOG: ResourceDefinition[] = [
  {
    uriTemplate: "biaws://workspaces",
    path: "/api/catalog/workspaces",
    description: "Workspaces acessíveis e links para suas coleções.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "biaws://workspaces/{workspaceId}/issues",
    path: "/api/issues",
    description:
      "Página inicial da coleção; buscas e filtros permanecem tools.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "biaws://workspaces/{workspaceId}/demands",
    path: "/api/requests",
    description:
      "Página inicial da coleção; buscas e filtros permanecem tools.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "biaws://workspaces/{workspaceId}/documents",
    path: "/api/knowledge/documents",
    description:
      "Página inicial da coleção; buscas e filtros permanecem tools.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "biaws://workspaces/{workspaceId}/issues/{issueId}",
    path: "/api/issues/{issueId}?includeComments=false",
    description:
      "Dados da issue; projeção resumida no MCP. O GET agregado existente continua compatível.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "biaws://workspaces/{workspaceId}/issues/{issueId}/comments",
    path: "/api/issues/{issueId}/comments",
    description: "Coleção de comentários, com paginação.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/issues/{issueId}/comments/{commentId}",
    path: "/api/issues/{issueId}/comments/{commentId}",
    description: "Comentário individual.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/issues/{issueId}/classification",
    path: "/api/issues/{issueId}/classification",
    description: "Classificação registrada.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "biaws://workspaces/{workspaceId}/demands/{demandId}",
    path: "/api/requests/{demandId}",
    description:
      "Dados cadastrais; o GET agregado existente continua compatível.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/demands/{demandId}/specification",
    path: "/api/requests/{demandId}/specification",
    description: "Especificação estruturada.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/demands/{demandId}/specification/sections/{sectionId}",
    path: "/api/requests/{demandId}/specification/sections/{sectionId}",
    description: "Seção da especificação; usa IDs já presentes.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/demands/{demandId}/checklist",
    path: "/api/requests/{demandId}/checklist",
    description: "Checklist completo; não inventa IDs por posição.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "biaws://workspaces/{workspaceId}/demands/{demandId}/journeys",
    path: "/api/requests/{demandId}/journeys",
    description: "Planejamento e execução de jornadas.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "biaws://workspaces/{workspaceId}/demands/{demandId}/notes",
    path: "/api/requests/{demandId}/notes",
    description: "Coleção de notas, com paginação.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/demands/{demandId}/notes/{noteId}",
    path: "/api/requests/{demandId}/notes/{noteId}",
    description: "Nota individual.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "biaws://workspaces/{workspaceId}/demands/{demandId}/tasks",
    path: "/api/requests/{demandId}/tasks",
    description: "Coleção de tarefas, com paginação e filtro de status.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/demands/{demandId}/tasks/{taskId}",
    path: "/api/requests/{demandId}/tasks/{taskId}",
    description: "Tarefa individual; taskId aceita ID ou code.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/demands/{demandId}/tasks/{taskId}/notes",
    path: "/api/requests/{demandId}/tasks/{taskId}/notes",
    description: "Coleção de notas da tarefa, com paginação.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/demands/{demandId}/tasks/{taskId}/notes/{noteId}",
    path: "/api/requests/{demandId}/tasks/{taskId}/notes/{noteId}",
    description: "Nota individual da tarefa.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/demands/{demandId}/implementation-context",
    path: "/api/requests/{demandId}/implementation-context",
    description:
      "Contexto derivado para implementação; transfere composição atual do MCP para serviço da API.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "biaws://workspaces/{workspaceId}/documents/{documentId}",
    path: "/api/knowledge/documents/{documentId}",
    description: "Documento com Markdown, metadados e relações.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/documents/{documentId}/content",
    path: "/api/knowledge/documents/{documentId}/content",
    description: "Conteúdo Markdown isolado.",
    mimeType: "text/markdown",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/documents/{documentId}/references",
    path: "/api/knowledge/documents/{documentId}/references",
    description: "Relações para outros documentos.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/documents/{documentId}/revisions",
    path: "/api/knowledge/documents/{documentId}/revisions",
    description:
      "Mantém o limite atual de 100 revisões; paginação seria evolução adicional.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/documents/{documentId}/revisions/{revision}",
    path: "/api/knowledge/documents/{documentId}/revisions/{revision}",
    description: "Revisão individual.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/documents/{documentId}/observations",
    path: "/api/knowledge/documents/{documentId}/observations",
    description:
      "Mantém o limite atual de 200 observações; paginação seria evolução adicional.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/documents/{documentId}/observations/{observationId}",
    path: "/api/knowledge/documents/{documentId}/observations/{observationId}",
    description: "Observação individual.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "biaws://workspaces/{workspaceId}/issues/{issueId}/files",
    path: "/api/issues/{issueId}/attachments",
    description: "Metadados e links dos arquivos, com paginação.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/issues/{issueId}/files/{fileId}",
    path: "/api/issues/{issueId}/attachments/{fileId}/metadata",
    description: "Metadados do arquivo; sem conteúdo binário.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/issues/{issueId}/files/{fileId}/content",
    path: "/api/issues/{issueId}/attachments/{fileId}",
    description: "Conteúdo binário com MIME real; respeita limite de tamanho.",
    mimeType: "application/octet-stream",
  },
  {
    uriTemplate: "biaws://workspaces/{workspaceId}/demands/{demandId}/files",
    path: "/api/requests/{demandId}/attachments",
    description: "Metadados e links dos arquivos, com paginação.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/demands/{demandId}/files/{fileId}",
    path: "/api/requests/{demandId}/attachments/{fileId}/metadata",
    description: "Metadados do arquivo; sem conteúdo binário.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/demands/{demandId}/files/{fileId}/content",
    path: "/api/requests/{demandId}/attachments/{fileId}",
    description: "Conteúdo binário com MIME real; respeita limite de tamanho.",
    mimeType: "application/octet-stream",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/demands/{demandId}/tasks/{taskId}/files",
    path: "/api/requests/{demandId}/tasks/{taskId}/attachments",
    description: "Metadados e links dos arquivos, com paginação.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/demands/{demandId}/tasks/{taskId}/files/{fileId}",
    path: "/api/requests/{demandId}/tasks/{taskId}/attachments/{fileId}/metadata",
    description: "Metadados do arquivo; sem conteúdo binário.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/demands/{demandId}/tasks/{taskId}/files/{fileId}/content",
    path: "/api/requests/{demandId}/tasks/{taskId}/attachments/{fileId}",
    description: "Conteúdo binário com MIME real; respeita limite de tamanho.",
    mimeType: "application/octet-stream",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/documents/{documentId}/files",
    path: "/api/knowledge/documents/{documentId}/attachments",
    description: "Metadados e links dos arquivos, com paginação.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/documents/{documentId}/files/{fileId}",
    path: "/api/knowledge/documents/{documentId}/attachments/{fileId}/metadata",
    description: "Metadados do arquivo; sem conteúdo binário.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/documents/{documentId}/files/{fileId}/content",
    path: "/api/knowledge/documents/{documentId}/attachments/{fileId}",
    description: "Conteúdo binário com MIME real; respeita limite de tamanho.",
    mimeType: "application/octet-stream",
  },
  {
    uriTemplate: "biaws://workspaces/{workspaceId}",
    path: "/api/catalog/workspaces/{workspaceId}",
    description: "Workspace acessível.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "biaws://workspaces/{workspaceId}/applications",
    path: "/api/catalog/workspaces/{workspaceId}/applications",
    description:
      "Coleção sem filtros; consultas parametrizadas permanecem tools.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/applications/{applicationId}",
    path: "/api/catalog/applications/{applicationId}",
    description: "Leitura autorizada do recurso BIAWS.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/applications/{applicationId}/context",
    path: "/api/catalog/applications/{applicationId}/context",
    description:
      "Contexto agregado padrão; opções avançadas permanecem na tool.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/applications/{applicationId}/components",
    path: "/api/catalog/applications/{applicationId}/components",
    description: "Leitura autorizada do recurso BIAWS.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/applications/{applicationId}/components/{componentId}",
    path: "/api/catalog/components/{componentId}",
    description: "Leitura autorizada do recurso BIAWS.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/applications/{applicationId}/integrations",
    path: "/api/catalog/applications/{applicationId}/integrations",
    description: "Leitura autorizada do recurso BIAWS.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/applications/{applicationId}/integrations/{integrationId}",
    path: "/api/catalog/integrations/{integrationId}",
    description: "Leitura autorizada do recurso BIAWS.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/applications/{applicationId}/repositories",
    path: "/api/catalog/applications/{applicationId}/repositories",
    description: "Leitura autorizada do recurso BIAWS.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/applications/{applicationId}/repositories/{repositoryId}",
    path: "/api/catalog/repositories/{repositoryId}",
    description: "Leitura autorizada do recurso BIAWS.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/applications/{applicationId}/repositories/{repositoryId}/components",
    path: "/api/catalog/repositories/{repositoryId}/components",
    description: "Leitura autorizada do recurso BIAWS.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/applications/{applicationId}/deployments",
    path: "/api/catalog/applications/{applicationId}/deployments",
    description: "Leitura autorizada do recurso BIAWS.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/applications/{applicationId}/deployments/{deploymentId}",
    path: "/api/catalog/deployments/{deploymentId}",
    description: "Leitura autorizada do recurso BIAWS.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/applications/{applicationId}/deployments/{deploymentId}/publications",
    path: "/api/catalog/deployments/{deploymentId}/publications",
    description: "Histórico de publicações isolado.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/applications/{applicationId}/deployments/{deploymentId}/runtimes",
    path: "/api/catalog/deployments/{deploymentId}/runtimes",
    description: "Leitura autorizada do recurso BIAWS.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/applications/{applicationId}/deployments/{deploymentId}/runtimes/{runtimeId}",
    path: "/api/catalog/runtimes/{runtimeId}",
    description: "Leitura autorizada do recurso BIAWS.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "biaws://workspaces/{workspaceId}/servers",
    path: "/api/catalog/workspaces/{workspaceId}/servers",
    description: "Leitura autorizada do recurso BIAWS.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "biaws://workspaces/{workspaceId}/servers/{serverId}",
    path: "/api/catalog/servers/{serverId}",
    description: "Leitura autorizada do recurso BIAWS.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "biaws://workspaces/{workspaceId}/servers/{serverId}/runtimes",
    path: "/api/catalog/servers/{serverId}/runtimes",
    description: "Links para URIs canônicas de runtime.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/servers/{serverId}/deployments",
    path: "/api/catalog/servers/{serverId}/deployments",
    description: "Links para URIs canônicas de deployment.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/applications/{applicationId}/topology-diagrams",
    path: "/api/catalog/applications/{applicationId}/topology-diagrams",
    description: "Leitura autorizada do recurso BIAWS.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/applications/{applicationId}/topology-diagrams/{diagramId}",
    path: "/api/catalog/topology-diagrams/{diagramId}",
    description: "Leitura autorizada do recurso BIAWS.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "biaws://workspaces/{workspaceId}/collections/{resourceType}",
    path: "/api/resource-collections/{resourceType}",
    description: "Árvore de coleções do tipo autorizado.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "biaws://workspaces/{workspaceId}/secrets/{secretId}",
    path: "/api/secrets/{secretId}",
    description: "Somente metadados; nunca valor, arquivo ou credencial.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "biaws://workspaces/{workspaceId}/classification-catalog",
    path: "/api/issues/taxonomy",
    description:
      "Taxonomia e tags no workspace; opções por aplicação permanecem tool.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "biaws://workspaces/{workspaceId}/document-types",
    path: "/api/knowledge/document-types",
    description:
      "Contrato hoje mantido no MCP; nova rota deve compartilhar sua fonte com a API.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "biaws://workspaces/{workspaceId}/monitoring/runtime-topology",
    path: "/api/monitoring/runtime-topology",
    description: "Mesmo limite e escopo atuais.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "biaws://workspaces/{workspaceId}/monitoring/runtime-targets",
    path: "/api/monitoring/runtime-targets",
    description: "Mesmo limite e escopo atuais.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/monitoring/metadata-profiles",
    path: "/api/monitoring/metadata-profiles",
    description: "Leitura autorizada do recurso BIAWS.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/monitoring/templates/{templateId}",
    path: "/api/monitoring/templates/{templateId}",
    description: "Template e versões acessíveis.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/monitoring/templates/{templateId}/versions/{version}",
    path: "/api/monitoring/templates/{templateId}?version={version}",
    description: "Seleção de versão pelo query parameter existente.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/monitoring/templates/{templateId}/versions/{version}/contract",
    path: "/api/monitoring/templates/{templateId}/versions/{version}/contract",
    description: "Leitura autorizada do recurso BIAWS.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/monitoring/templates/{templateId}/versions/{version}/usage",
    path: "/api/monitoring/templates/{templateId}/versions/{version}/usage",
    description: "Leitura autorizada do recurso BIAWS.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/applications/{applicationId}/monitoring/health",
    path: "/api/monitoring/applications/{applicationId}/health",
    description: "Snapshot padrão; consulta com opções permanece tool.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/applications/{applicationId}/deployments/{deploymentId}/runtimes/{runtimeId}/monitoring/active-monitors",
    path: "/api/monitoring/runtimes/{runtimeId}/active-monitors",
    description: "Leitura autorizada do recurso BIAWS.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/applications/{applicationId}/deployments/{deploymentId}/runtimes/{runtimeId}/monitoring/active-monitors/{monitorId}",
    path: "/api/monitoring/runtimes/{runtimeId}/active-monitors/{monitorId}",
    description: "Configuração individual sanitizada.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/audit/{entityType}/{entityId}",
    path: "/api/audit/{entityType}/{entityId}",
    description: "Mantém limite atual de 200 eventos e escopo da entidade.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/applications/{applicationId}/classification-catalog",
    path: "/api/issues/taxonomy?applicationId={applicationId}",
    description: "Taxonomia e grupos de tags aplicáveis à aplicação da issue.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "biaws://workspaces/{workspaceId}/components/{componentId}",
    path: "/api/catalog/components/{componentId}",
    description:
      "Leitura direta por ID/key com a permissão da entidade; sem leitura adicional de ancestrais.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/integrations/{integrationId}",
    path: "/api/catalog/integrations/{integrationId}",
    description:
      "Leitura direta por ID/key com a permissão da entidade; sem leitura adicional de ancestrais.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "biaws://workspaces/{workspaceId}/repositories/{repositoryId}",
    path: "/api/catalog/repositories/{repositoryId}",
    description:
      "Leitura direta por ID/key com a permissão da entidade; sem leitura adicional de ancestrais.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "biaws://workspaces/{workspaceId}/deployments/{deploymentId}",
    path: "/api/catalog/deployments/{deploymentId}",
    description:
      "Leitura direta por ID/key com a permissão da entidade; sem leitura adicional de ancestrais.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "biaws://workspaces/{workspaceId}/runtimes/{runtimeId}",
    path: "/api/catalog/runtimes/{runtimeId}",
    description:
      "Leitura direta por ID/key com a permissão da entidade; sem leitura adicional de ancestrais.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/runtimes/{runtimeId}/monitoring/active-monitors",
    path: "/api/monitoring/runtimes/{runtimeId}/active-monitors",
    description:
      "Configuração de monitores com runtimes.read; runtimeId aceita referência composta existente.",
    mimeType: "application/json",
  },
  {
    uriTemplate:
      "biaws://workspaces/{workspaceId}/runtimes/{runtimeId}/monitoring/active-monitors/{monitorId}",
    path: "/api/monitoring/runtimes/{runtimeId}/active-monitors/{monitorId}",
    description:
      "Configuração de monitores com runtimes.read; runtimeId aceita referência composta existente.",
    mimeType: "application/json",
  },
];
