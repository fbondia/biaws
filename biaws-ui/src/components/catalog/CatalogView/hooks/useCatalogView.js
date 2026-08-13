import { useEffect, useMemo, useRef, useState } from "react";

import {
  archiveApplication,
  createApplication,
  deleteApplication,
  fetchApplication,
  fetchApplicationMonitoringHealth,
  fetchApplications,
  fetchComponents,
  fetchDeployments,
  fetchIntegrations,
  fetchRepositories,
  fetchServers,
  fetchWorkspaces,
  restoreApplication,
  updateApplication,
} from "../../../../api.js";
import { useMessages } from "../../../../infrastructure/messages/MessagesProvider.jsx";
import { hasPermission } from "../../../../permissions.js";
import { CATALOG_ENTITY_API } from "../catalogEntityApi.js";
import { visibleCatalogTabs } from "../catalogViewModel.js";
import { createCatalogEntityActions } from "../components/createCatalogEntityActions.jsx";
import { useCatalogRuntimes } from "./useCatalogRuntimes.js";

export function useCatalogView(actor) {
  const { confirm } = useMessages();
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
  const applicationLoadVersionRef = useRef(0);
  const {
    loadRuntimes,
    resetRuntimes,
    runtimeByDeployment,
    runtimeErrorByDeployment,
    runtimeLoadingByDeployment,
  } = useCatalogRuntimes(actor);

  const visibleTabs = useMemo(() => visibleCatalogTabs(actor), [actor]);

  async function loadApplications(nextWorkspace = workspace, filters = {}) {
    if (!nextWorkspace?.id) return;
    const loadVersion = applicationLoadVersionRef.current + 1;
    applicationLoadVersionRef.current = loadVersion;
    const payload = await fetchApplications(nextWorkspace.id, {
      q: filters.search ?? search,
      includeArchived: filters.includeArchived ?? includeArchived,
      limit: 100,
    });
    if (loadVersion !== applicationLoadVersionRef.current) return;
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
          ? fetchComponents(applicationId, {
              includeArchived: true,
              limit: 100,
            })
          : null,
        hasPermission(actor, "repositories.read")
          ? fetchRepositories(applicationId, {
              includeArchived: true,
              limit: 100,
            })
          : null,
        hasPermission(actor, "deployments.read")
          ? fetchDeployments(applicationId, {
              includeArchived: true,
              limit: 100,
            })
          : null,
        hasPermission(actor, "servers.read") && workspace?.id
          ? fetchServers(workspace.id, { limit: 100 })
          : null,
        hasPermission(actor, "integrations.read")
          ? fetchIntegrations(applicationId, {
              includeArchived: true,
              limit: 100,
            })
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
      resetRuntimes();
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
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        await loadApplications(workspace, { search, includeArchived });
      } catch (loadError) {
        if (active) setError(loadError.message);
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
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
    const api = CATALOG_ENTITY_API[dialog.kind];
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
      const api = CATALOG_ENTITY_API[kind];
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
    if (!(await confirm(`Arquivar “${entity.name}”?`))) return;
    setError("");
    try {
      await CATALOG_ENTITY_API[kind].archive(entity.id);
      if (kind === "runtime") {
        await loadRuntimes(entity.deploymentId, { force: true });
        return;
      }
      await loadContext();
    } catch (archiveError) {
      setError(archiveError.message);
    }
  }

  async function restoreEntity(kind, entity) {
    if (!(await confirm(`Desarquivar “${entity.name}”?`))) return;
    setError("");
    try {
      await CATALOG_ENTITY_API[kind].restore(entity.id);
      if (kind === "runtime") {
        await loadRuntimes(entity.deploymentId, { force: true });
        return;
      }
      await loadContext();
    } catch (restoreError) {
      setError(restoreError.message);
    }
  }

  async function deleteEntity(kind, entity) {
    if (
      !(await confirm({
        message: `Excluir definitivamente “${entity.name}”? Esta ação não pode ser desfeita.`,
        tone: "danger",
      }))
    ) {
      return;
    }
    setError("");
    try {
      await CATALOG_ENTITY_API[kind].remove(entity.id);
      if (kind === "runtime") {
        await loadRuntimes(entity.deploymentId, { force: true });
        return;
      }
      await loadContext();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  async function archiveApplicationItem(application) {
    if (!application || !(await confirm(`Arquivar “${application.name}”?`)))
      return;
    setError("");
    try {
      await archiveApplication(application.id);
      setSelectedId("");
      setContext(null);
      await loadApplications();
    } catch (archiveError) {
      setError(archiveError.message);
    }
  }

  async function archiveSelectedApplication() {
    await archiveApplicationItem(context?.application);
  }

  async function restoreArchivedApplication(application) {
    if (!(await confirm(`Desarquivar “${application.name}”?`))) return;
    setError("");
    try {
      await restoreApplication(application.id);
      setSelectedId("");
      setContext(null);
      await loadApplications();
    } catch (restoreError) {
      setError(restoreError.message);
    }
  }

  async function deleteArchivedApplication(application) {
    if (
      !(await confirm({
        message: `Excluir definitivamente “${application.name}”? Esta ação não pode ser desfeita.`,
        tone: "danger",
      }))
    ) {
      return;
    }
    setError("");
    try {
      await deleteApplication(application.id);
      setSelectedId("");
      setContext(null);
      await loadApplications();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  const entityActions = createCatalogEntityActions({
    actor,
    archiveEntity,
    deleteEntity,
    editEntity,
    restoreEntity,
  });

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
    archiveApplicationItem,
    archiveSelectedApplication,
    deleteArchivedApplication,
    editEntity,
    entityActions,
    runtimeByDeployment,
    runtimeLoadingByDeployment,
    runtimeErrorByDeployment,
    loadRuntimes,
    loadContext,
    loadApplications,
    loadWorkspaceAndApplications,
    restoreArchivedApplication,
    setError,
  };
}
