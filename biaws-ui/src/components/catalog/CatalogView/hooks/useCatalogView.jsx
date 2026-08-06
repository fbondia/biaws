import { Archive, Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  archiveApplication,
  archiveComponent,
  archiveDeployment,
  archiveIntegration,
  archiveRepository,
  archiveRuntime,
  createApplication,
  createComponent,
  createDeployment,
  createIntegration,
  createRepository,
  createRuntime,
  fetchApplication,
  fetchApplicationMonitoringHealth,
  fetchApplications,
  fetchComponent,
  fetchComponents,
  fetchDeployment,
  fetchDeployments,
  fetchIntegration,
  fetchIntegrations,
  fetchRepositories,
  fetchRepository,
  fetchRuntime,
  fetchRuntimes,
  fetchServers,
  fetchWorkspaces,
  updateApplication,
  updateComponent,
  updateDeployment,
  updateIntegration,
  updateRepository,
  updateRuntime,
} from "../../../../api.js";
import { hasPermission } from "../../../../permissions.js";

const TABS = [
  { key: "overview", label: "Visão geral", permission: "applications.read" },
  {
    key: "topology",
    label: "Topologia",
    permission: ["components.read", "deployments.read"],
  },
  {
    key: "repositories",
    label: "Repositórios",
    permission: "repositories.read",
  },
  {
    key: "integrations",
    label: "Integrações",
    permission: "integrations.read",
  },
  { key: "history", label: "Histórico", permission: "applications.read" },
];

const ENTITY_API = {
  integration: {
    create: createIntegration,
    update: updateIntegration,
    archive: archiveIntegration,
    detail: fetchIntegration,
    response: "integration",
  },
  component: {
    create: createComponent,
    update: updateComponent,
    archive: archiveComponent,
    detail: fetchComponent,
    response: "component",
  },
  repository: {
    create: createRepository,
    update: updateRepository,
    archive: archiveRepository,
    detail: fetchRepository,
    response: "repository",
  },
  deployment: {
    create: createDeployment,
    update: updateDeployment,
    archive: archiveDeployment,
    detail: fetchDeployment,
    response: "deployment",
  },
  runtime: {
    create: createRuntime,
    update: updateRuntime,
    archive: archiveRuntime,
    detail: fetchRuntime,
    response: "runtime",
  },
};

export function useCatalogView(actor) {
  const [workspace, setWorkspace] = useState(null);
  const [applications, setApplications] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [context, setContext] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null);
  const [runtimeByDeployment, setRuntimeByDeployment] = useState({});
  const [runtimeLoadingByDeployment, setRuntimeLoadingByDeployment] = useState(
    {},
  );
  const [runtimeErrorByDeployment, setRuntimeErrorByDeployment] = useState({});

  const visibleTabs = useMemo(
    () =>
      TABS.filter(({ permission }) =>
        (Array.isArray(permission) ? permission : [permission]).some(
          (candidate) => hasPermission(actor, candidate),
        ),
      ),
    [actor],
  );

  async function loadApplications(nextWorkspace = workspace, filters = {}) {
    if (!nextWorkspace?.id) return;
    const payload = await fetchApplications(nextWorkspace.id, {
      q: filters.search ?? search,
      includeArchived: filters.includeArchived ?? includeArchived,
      limit: 100,
    });
    setApplications(payload.items || []);
    setSelectedId((current) =>
      current && (payload.items || []).some(({ id }) => id === current)
        ? current
        : "",
    );
  }

  async function loadWorkspaceAndApplications() {
    setLoading(true);
    setError("");
    try {
      const payload = await fetchWorkspaces();
      const operational = (payload.items || []).find(
        ({ id }) => id === actor.workspaceId,
      );
      setWorkspace(operational || null);
      if (operational) await loadApplications(operational);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadContext(applicationId = selectedId) {
    if (!applicationId) {
      setContext(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const applicationPayload = await fetchApplication(applicationId);
      const tasks = [
        hasPermission(actor, "components.read")
          ? fetchComponents(applicationId, { limit: 100 })
          : null,
        hasPermission(actor, "repositories.read")
          ? fetchRepositories(applicationId, { limit: 100 })
          : null,
        hasPermission(actor, "deployments.read")
          ? fetchDeployments(applicationId, { limit: 100 })
          : null,
        hasPermission(actor, "servers.read") && workspace?.id
          ? fetchServers(workspace.id, { limit: 100 })
          : null,
        hasPermission(actor, "integrations.read")
          ? fetchIntegrations(applicationId, { limit: 100 })
          : null,
        workspace?.id ? fetchApplications(workspace.id, { limit: 100 }) : null,
        hasPermission(actor, "runtimes.read")
          ? fetchApplicationMonitoringHealth(applicationId)
          : null,
      ].map((task) => task || Promise.resolve({ items: [] }));
      const [
        components,
        repositories,
        deployments,
        servers,
        integrations,
        availableApplications,
        monitoringHealth,
      ] = await Promise.all(tasks);
      setContext({
        application: applicationPayload.application,
        components: components.items || [],
        repositories: repositories.items || [],
        deployments: deployments.items || [],
        servers: servers.items || [],
        integrations: integrations.items || [],
        availableApplications: (availableApplications.items || []).filter(
          ({ id }) => id !== applicationId,
        ),
        monitoringHealth: monitoringHealth.health || null,
      });
      setRuntimeByDeployment({});
      setRuntimeLoadingByDeployment({});
      setRuntimeErrorByDeployment({});
    } catch (loadError) {
      setError(loadError.message);
      setContext(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspaceAndApplications();
  }, [actor.workspaceId]);

  useEffect(() => {
    void loadContext();
  }, [selectedId]);

  useEffect(() => {
    if (!workspace?.id) return undefined;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        await loadApplications(workspace, { search, includeArchived });
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [workspace?.id, search, includeArchived]);

  async function persistApplication(payload) {
    if (dialog?.entity?.id) {
      await updateApplication(dialog.entity.id, payload);
    } else {
      await createApplication(workspace.id, payload);
    }
    await loadApplications();
    if (selectedId) await loadContext();
  }

  async function persistEntity(payload) {
    const api = ENTITY_API[dialog.kind];
    const runtimeDeploymentId =
      dialog.kind === "runtime"
        ? dialog.deploymentId || dialog.entity?.deploymentId
        : "";
    if (dialog.entity?.id) {
      await api.update(dialog.entity.id, payload);
    } else {
      const parentId =
        dialog.kind === "runtime" ? runtimeDeploymentId : selectedId;
      await api.create(parentId, payload);
    }
    if (dialog.kind === "runtime") {
      await loadRuntimes(runtimeDeploymentId, { force: true });
      return;
    }
    await loadContext();
  }

  async function editEntity(kind, entity) {
    setError("");
    try {
      const api = ENTITY_API[kind];
      const payload = await api.detail(entity.id);
      setDialog({
        kind,
        entity: payload[api.response],
        deploymentId: entity.deploymentId,
      });
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  async function archiveEntity(kind, entity) {
    if (!window.confirm(`Arquivar “${entity.name}”?`)) return;
    setError("");
    try {
      await ENTITY_API[kind].archive(entity.id);
      if (kind === "runtime") {
        await loadRuntimes(entity.deploymentId, { force: true });
        return;
      }
      await loadContext();
    } catch (archiveError) {
      setError(archiveError.message);
    }
  }

  async function archiveSelectedApplication() {
    if (
      !context?.application ||
      !window.confirm(`Arquivar “${context.application.name}”?`)
    )
      return;
    setError("");
    try {
      await archiveApplication(context.application.id);
      setSelectedId("");
      setContext(null);
      await loadApplications();
    } catch (archiveError) {
      setError(archiveError.message);
    }
  }

  const entityActions =
    (kind, updatePermission, archivePermission) => (entity) => (
      <>
        {hasPermission(actor, updatePermission) ? (
          <button
            aria-label={`Editar ${entity.name}`}
            className="iconButton"
            onClick={() => void editEntity(kind, entity)}
            title="Editar"
            type="button"
          >
            <Pencil size={15} />
          </button>
        ) : null}
        {hasPermission(actor, archivePermission) &&
        entity.status !== "archived" ? (
          <button
            aria-label={`Arquivar ${entity.name}`}
            className="iconButton dangerIconButton"
            onClick={() => void archiveEntity(kind, entity)}
            title="Arquivar"
            type="button"
          >
            <Archive size={15} />
          </button>
        ) : null}
      </>
    );

  async function loadRuntimes(deploymentId, { force = false } = {}) {
    if (
      !deploymentId ||
      !hasPermission(actor, "runtimes.read") ||
      runtimeLoadingByDeployment[deploymentId] ||
      (!force && Object.hasOwn(runtimeByDeployment, deploymentId))
    )
      return;

    setRuntimeLoadingByDeployment((current) => ({
      ...current,
      [deploymentId]: true,
    }));
    setRuntimeErrorByDeployment((current) => ({
      ...current,
      [deploymentId]: "",
    }));
    try {
      const payload = await fetchRuntimes(deploymentId, { limit: 100 });
      setRuntimeByDeployment((current) => ({
        ...current,
        [deploymentId]: payload.items || [],
      }));
    } catch (loadError) {
      setRuntimeErrorByDeployment((current) => ({
        ...current,
        [deploymentId]: loadError.message,
      }));
    } finally {
      setRuntimeLoadingByDeployment((current) => ({
        ...current,
        [deploymentId]: false,
      }));
    }
  }

  return {
    workspace,
    applications,
    selectedId,
    setSelectedId,
    context,
    activeTab,
    setActiveTab,
    search,
    setSearch,
    includeArchived,
    setIncludeArchived,
    loading,
    error,
    dialog,
    setDialog,
    visibleTabs,
    persistApplication,
    persistEntity,
    archiveSelectedApplication,
    editEntity,
    entityActions,
    runtimeByDeployment,
    runtimeLoadingByDeployment,
    runtimeErrorByDeployment,
    loadRuntimes,
    loadContext,
    loadApplications,
    loadWorkspaceAndApplications,
    setError,
  };
}
