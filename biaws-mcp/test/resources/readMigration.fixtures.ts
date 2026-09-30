export const replacements = [
  {
    name: "workspaces_list",
    template: "biaws://workspaces",
    uri: "biaws://workspaces",
    canonical: "biaws://workspaces",
    path: "/api/catalog/workspaces",
    payload: {
      items: [
        {
          id: "item-a",
          detail: "preserved",
        },
      ],
    },
  },
  {
    name: "workspaces_get",
    template: "biaws://workspaces/{workspaceId}",
    uri: "biaws://workspaces/workspace-a",
    canonical: "biaws://workspaces/workspace-a",
    path: "/api/catalog/workspaces/workspace-a",
    payload: {
      workspace: {
        id: "workspace-a",
        key: "default",
      },
    },
  },
  {
    name: "applications_get",
    template: "biaws://workspaces/{workspaceId}/applications/{applicationId}",
    uri: "biaws://workspaces/workspace-a/applications/alias",
    canonical: "biaws://workspaces/workspace-a/applications/canonical-application",
    path: "/api/catalog/applications/alias",
    payload: {
      application: {
        id: "canonical-application",
        key: "alias",
        detail: "preserved",
      },
    },
  },
  {
    name: "components_get",
    template: "biaws://workspaces/{workspaceId}/components/{componentId}",
    uri: "biaws://workspaces/workspace-a/components/alias",
    canonical: "biaws://workspaces/workspace-a/components/canonical-component",
    path: "/api/catalog/components/alias",
    payload: {
      component: {
        id: "canonical-component",
        key: "alias",
        detail: "preserved",
      },
    },
  },
  {
    name: "integrations_get",
    template: "biaws://workspaces/{workspaceId}/integrations/{integrationId}",
    uri: "biaws://workspaces/workspace-a/integrations/alias",
    canonical: "biaws://workspaces/workspace-a/integrations/canonical-integration",
    path: "/api/catalog/integrations/alias",
    payload: {
      integration: {
        id: "canonical-integration",
        key: "alias",
        detail: "preserved",
      },
    },
  },
  {
    name: "repositories_get",
    template: "biaws://workspaces/{workspaceId}/repositories/{repositoryId}",
    uri: "biaws://workspaces/workspace-a/repositories/alias",
    canonical: "biaws://workspaces/workspace-a/repositories/canonical-repository",
    path: "/api/catalog/repositories/alias",
    payload: {
      repository: {
        id: "canonical-repository",
        key: "alias",
        detail: "preserved",
      },
    },
  },
  {
    name: "servers_get",
    template: "biaws://workspaces/{workspaceId}/servers/{serverId}",
    uri: "biaws://workspaces/workspace-a/servers/alias",
    canonical: "biaws://workspaces/workspace-a/servers/canonical-server",
    path: "/api/catalog/servers/alias",
    payload: {
      server: {
        id: "canonical-server",
        key: "alias",
        detail: "preserved",
      },
    },
  },
  {
    name: "deployments_get",
    template: "biaws://workspaces/{workspaceId}/deployments/{deploymentId}",
    uri: "biaws://workspaces/workspace-a/deployments/alias",
    canonical: "biaws://workspaces/workspace-a/deployments/canonical-deployment",
    path: "/api/catalog/deployments/alias",
    payload: {
      deployment: {
        id: "canonical-deployment",
        key: "alias",
        detail: "preserved",
      },
    },
  },
  {
    name: "runtimes_get",
    template: "biaws://workspaces/{workspaceId}/runtimes/{runtimeId}",
    uri: "biaws://workspaces/workspace-a/runtimes/alias",
    canonical: "biaws://workspaces/workspace-a/runtimes/canonical-runtime",
    path: "/api/catalog/runtimes/alias",
    payload: {
      runtime: {
        id: "canonical-runtime",
        key: "alias",
        detail: "preserved",
      },
    },
  },
  {
    name: "secrets_get",
    template: "biaws://workspaces/{workspaceId}/secrets/{secretId}",
    uri: "biaws://workspaces/workspace-a/secrets/alias",
    canonical: "biaws://workspaces/workspace-a/secrets/canonical-secret",
    path: "/api/secrets/alias",
    payload: {
      secret: {
        id: "canonical-secret",
        key: "alias",
        detail: "preserved",
      },
    },
  },
  {
    name: "documents_get",
    template: "biaws://workspaces/{workspaceId}/documents/{documentId}",
    uri: "biaws://workspaces/workspace-a/documents/alias",
    canonical: "biaws://workspaces/workspace-a/documents/canonical-document",
    path: "/api/knowledge/documents/alias",
    payload: {
      document: {
        id: "canonical-document",
        applicationId: null,
        identifier: null,
        key: "alias",
        detail: "preserved",
        markdown: "# content",
        references: [
          {
            targetDocumentId: "linked",
          },
        ],
      },
    },
  },
  {
    name: "documents_list_revisions",
    template: "biaws://workspaces/{workspaceId}/documents/{documentId}/revisions",
    uri: "biaws://workspaces/workspace-a/documents/alias/revisions",
    canonical: "biaws://workspaces/workspace-a/documents/alias/revisions",
    path: "/api/knowledge/documents/alias/revisions",
    payload: {
      items: [
        {
          id: "history-a",
          revision: 2,
          detail: "preserved",
        },
      ],
    },
  },
  {
    name: "documents_list_observations",
    template: "biaws://workspaces/{workspaceId}/documents/{documentId}/observations",
    uri: "biaws://workspaces/workspace-a/documents/alias/observations",
    canonical: "biaws://workspaces/workspace-a/documents/alias/observations",
    path: "/api/knowledge/documents/alias/observations",
    payload: {
      items: [
        {
          id: "history-a",
          revision: 2,
          detail: "preserved",
        },
      ],
    },
  },
  {
    name: "resource_collections_list",
    template: "biaws://workspaces/{workspaceId}/collections/{resourceType}",
    uri: "biaws://workspaces/workspace-a/collections/applications",
    canonical: "biaws://workspaces/workspace-a/collections/applications",
    path: "/api/resource-collections/applications",
    payload: {
      resource: {
        items: [
          {
            id: "collection-a",
            children: [],
          },
        ],
      },
    },
  },
  {
    name: "monitoring_runtime_topology_get",
    template: "biaws://workspaces/{workspaceId}/monitoring/runtime-topology",
    uri: "biaws://workspaces/workspace-a/monitoring/runtime-topology",
    canonical: "biaws://workspaces/workspace-a/monitoring/runtime-topology",
    path: "/api/monitoring/runtime-topology",
    payload: {
      topology: {
        nodes: [
          {
            id: "runtime-a",
          },
        ],
      },
    },
  },
  {
    name: "monitoring_runtime_targets_list",
    template: "biaws://workspaces/{workspaceId}/monitoring/runtime-targets",
    uri: "biaws://workspaces/workspace-a/monitoring/runtime-targets",
    canonical: "biaws://workspaces/workspace-a/monitoring/runtime-targets",
    path: "/api/monitoring/runtime-targets",
    payload: {
      items: [
        {
          id: "item-a",
          detail: "preserved",
        },
      ],
    },
  },
  {
    name: "monitoring_metadata_profiles_list",
    template: "biaws://workspaces/{workspaceId}/monitoring/metadata-profiles",
    uri: "biaws://workspaces/workspace-a/monitoring/metadata-profiles",
    canonical: "biaws://workspaces/workspace-a/monitoring/metadata-profiles",
    path: "/api/monitoring/metadata-profiles",
    payload: {
      items: [
        {
          id: "item-a",
          detail: "preserved",
        },
      ],
    },
  },
  {
    name: "monitoring_templates_get",
    template: "biaws://workspaces/{workspaceId}/monitoring/templates/{templateId}",
    uri: "biaws://workspaces/workspace-a/monitoring/templates/health%2Fapi",
    canonical: "biaws://workspaces/workspace-a/monitoring/templates/health%2Fapi",
    path: "/api/monitoring/templates/health%2Fapi",
    payload: {
      template: {
        id: "health/api",
        version: "2",
        versions: [
          {
            version: "1",
          },
        ],
        definition: {
          endpoint: "/status",
        },
      },
    },
  },
  {
    name: "monitoring_templates_get_usage",
    template: "biaws://workspaces/{workspaceId}/monitoring/templates/{templateId}/versions/{version}/usage",
    uri: "biaws://workspaces/workspace-a/monitoring/templates/health%2Fapi/versions/2/usage",
    canonical: "biaws://workspaces/workspace-a/monitoring/templates/health%2Fapi/versions/2/usage",
    path: "/api/monitoring/templates/health%2Fapi/versions/2/usage",
    payload: {
      templateRef: {
        id: "health/api",
        version: "2",
      },
      detail: "preserved",
    },
  },
  {
    name: "monitoring_templates_get_contract",
    template: "biaws://workspaces/{workspaceId}/monitoring/templates/{templateId}/versions/{version}/contract",
    uri: "biaws://workspaces/workspace-a/monitoring/templates/health%2Fapi/versions/2/contract",
    canonical: "biaws://workspaces/workspace-a/monitoring/templates/health%2Fapi/versions/2/contract",
    path: "/api/monitoring/templates/health%2Fapi/versions/2/contract",
    payload: {
      templateRef: {
        id: "health/api",
        version: "2",
      },
      detail: "preserved",
    },
  },
  {
    name: "runtime_active_monitors_list",
    template: "biaws://workspaces/{workspaceId}/runtimes/{runtimeId}/monitoring/active-monitors",
    uri: "biaws://workspaces/workspace-a/runtimes/app.comp.dep.run/monitoring/active-monitors?page=2&limit=10",
    canonical: "biaws://workspaces/workspace-a/runtimes/canonical-runtime/monitoring/active-monitors?page=2&limit=10",
    path: "/api/monitoring/runtimes/app.comp.dep.run/active-monitors?page=2&limit=10",
    payload: {
      items: [
        {
          id: "monitor-a",
          detail: "preserved",
        },
      ],
      meta: {
        runtimeId: "canonical-runtime",
        page: 2,
        limit: 10,
        total: 25,
      },
    },
  },
] as const;
