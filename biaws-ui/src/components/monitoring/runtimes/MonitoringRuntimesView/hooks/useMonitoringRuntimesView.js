import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  fetchApplications,
  fetchComponents,
  fetchDeployments,
  fetchMonitoredRuntimeTopology,
  fetchResourceCollections,
  fetchRuntimes,
  fetchServers,
  fetchWorkspaces,
} from "../../../../../api.js";
import { hasPermission } from "../../../../../permissions.js";
import {
  applicationsInCollection,
  deploymentsForComponent,
  filterMonitoredTopology,
  runtimeListParams,
} from "../../model.js";

const EMPTY_MONITORED_TOPOLOGY = {
  applicationIds: [],
  componentIds: [],
  deploymentIds: [],
  runtimeIds: [],
};

export function useMonitoringRuntimesView(actor) {
  const [workspace, setWorkspace] = useState(null);
  const [collections, setCollections] = useState([]);
  const [applications, setApplications] = useState([]);
  const [servers, setServers] = useState([]);
  const [components, setComponents] = useState([]);
  const [deployments, setDeployments] = useState([]);
  const [runtimes, setRuntimes] = useState([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [application, setApplication] = useState(null);
  const [component, setComponent] = useState(null);
  const [deployment, setDeployment] = useState(null);
  const [runtime, setRuntime] = useState(null);
  const [viewMode, setViewMode] = useState("navigation");
  const [monitoredOnly, setMonitoredOnly] = useState(true);
  const [monitoredTopology, setMonitoredTopology] = useState(
    EMPTY_MONITORED_TOPOLOGY,
  );
  const [loading, setLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [error, setError] = useState("");
  const dashboardRef = useRef(null);

  const updateDashboardLoading = useCallback((value) => {
    setDashboardLoading(value);
  }, []);

  const filteredTopology = useMemo(
    () =>
      filterMonitoredTopology({
        applications,
        collections,
        components,
        deployments,
        monitoredOnly,
        topology: monitoredTopology,
      }),
    [
      applications,
      collections,
      components,
      deployments,
      monitoredOnly,
      monitoredTopology,
    ],
  );
  const visibleApplications = useMemo(
    () =>
      applicationsInCollection(
        filteredTopology.applications,
        selectedCollectionId,
      ),
    [filteredTopology.applications, selectedCollectionId],
  );
  const showRootCollection = useMemo(
    () =>
      applicationsInCollection(filteredTopology.applications, "").length > 0,
    [filteredTopology.applications],
  );
  const visibleDeployments = useMemo(
    () => deploymentsForComponent(filteredTopology.deployments, component?.id),
    [filteredTopology.deployments, component?.id],
  );

  function resetNavigation() {
    setApplication(null);
    setComponent(null);
    setDeployment(null);
    setRuntime(null);
    setComponents([]);
    setDeployments([]);
    setRuntimes([]);
  }

  async function loadRoot() {
    setLoading(true);
    setError("");
    try {
      const workspacePayload = await fetchWorkspaces();
      const currentWorkspace = (workspacePayload.items || []).find(
        ({ id }) => id === actor.workspaceId,
      );
      if (!currentWorkspace) throw new Error("Workspace atual não encontrado.");
      const [
        collectionPayload,
        applicationPayload,
        serverPayload,
        monitoringTopologyPayload,
      ] = await Promise.all([
        fetchResourceCollections("applications"),
        fetchApplications(currentWorkspace.id, { limit: 100 }),
        hasPermission(actor, "servers.read")
          ? fetchServers(currentWorkspace.id, { limit: 100 })
          : Promise.resolve({ items: [] }),
        fetchMonitoredRuntimeTopology(),
      ]);
      setWorkspace(currentWorkspace);
      setCollections(collectionPayload.items || []);
      setApplications(applicationPayload.items || []);
      setServers(serverPayload.items || []);
      setMonitoredTopology(monitoringTopologyPayload.topology || {});
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRoot();
  }, [actor.workspaceId]);

  async function selectApplication(nextApplication) {
    setApplication(nextApplication);
    setComponent(null);
    setDeployment(null);
    setRuntime(null);
    setRuntimes([]);
    setLoading(true);
    setError("");
    try {
      const [componentPayload, deploymentPayload] = await Promise.all([
        fetchComponents(nextApplication.id, { limit: 100 }),
        fetchDeployments(nextApplication.id, { limit: 100 }),
      ]);
      setComponents(componentPayload.items || []);
      setDeployments(deploymentPayload.items || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  function selectComponent(nextComponent) {
    setComponent(nextComponent);
    setDeployment(null);
    setRuntime(null);
    setRuntimes([]);
  }

  async function loadDeploymentRuntimes(nextDeployment, onlyMonitored) {
    setDeployment(nextDeployment);
    setLoading(true);
    setError("");
    try {
      const payload = await fetchRuntimes(
        nextDeployment.id,
        runtimeListParams(onlyMonitored),
      );
      const nextRuntimes = payload.items || [];
      setRuntimes(nextRuntimes);
      setRuntime((current) =>
        current && nextRuntimes.some(({ id }) => id === current.id)
          ? current
          : null,
      );
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  async function selectDeployment(nextDeployment) {
    setRuntime(null);
    setRuntimes([]);
    await loadDeploymentRuntimes(nextDeployment, monitoredOnly);
  }

  async function toggleMonitoredOnly() {
    const nextValue = !monitoredOnly;
    if (!nextValue) {
      setMonitoredOnly(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const payload = await fetchMonitoredRuntimeTopology();
      const nextTopology = payload.topology || {};
      setMonitoredTopology(nextTopology);
      setMonitoredOnly(true);
      const visibleCollectionIds = new Set(
        filterMonitoredTopology({
          applications,
          collections,
          monitoredOnly: true,
          topology: nextTopology,
        }).collections.map(({ id }) => id),
      );
      if (
        selectedCollectionId &&
        !visibleCollectionIds.has(selectedCollectionId)
      ) {
        setSelectedCollectionId("");
      }
      resetNavigation();
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshNavigation() {
    await loadRoot();
    if (monitoredOnly) {
      resetNavigation();
      return;
    }
    if (deployment) {
      await loadDeploymentRuntimes(deployment, monitoredOnly);
    }
  }

  function selectCollection(collectionId) {
    setSelectedCollectionId(collectionId);
    resetNavigation();
  }

  return {
    dashboard: {
      loading: dashboardLoading,
      onLoadingChange: updateDashboardLoading,
      ref: dashboardRef,
    },
    error,
    loading,
    monitoredOnly,
    navigation: {
      application,
      component,
      deployment,
      filteredTopology,
      runtime,
      runtimes,
      selectedCollectionId,
      servers,
      showRootCollection,
      visibleApplications,
      visibleDeployments,
    },
    refreshNavigation,
    selectApplication,
    selectCollection,
    selectComponent,
    selectDeployment,
    setRuntime,
    setViewMode,
    toggleMonitoredOnly,
    viewMode,
    workspace,
  };
}
