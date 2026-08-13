export function collectionPath(collections = [], selectedId = "") {
  if (!selectedId) return [];
  const byId = new Map(collections.map((item) => [item.id, item]));
  const path = [];
  const visited = new Set();
  let current = byId.get(selectedId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift(current);
    current = byId.get(current.parentId || "");
  }
  return path;
}

export function collectionColumns(collections = [], selectedId = "") {
  const path = collectionPath(collections, selectedId);
  const parents = ["", ...path.map(({ id }) => id)];
  return parents
    .map((parentId, index) => ({
      parentId,
      selectedId: path[index]?.id || "",
      items: collections
        .filter((item) => String(item.parentId || "") === parentId)
        .sort((left, right) => left.name.localeCompare(right.name, "pt-BR")),
    }))
    .filter(({ items }, index) => index === 0 || items.length);
}

export function applicationsInCollection(applications = [], collectionId = "") {
  return applications
    .filter(
      (application) =>
        String(application.collectionId || "") === String(collectionId || ""),
    )
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

export function deploymentsForComponent(deployments = [], componentId = "") {
  return deployments
    .filter(({ componentId: ownerId }) => ownerId === componentId)
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

export function latestEventForMonitor(events = [], monitorId = "") {
  return (
    events.find(
      ({ monitorId: eventMonitorId }) => eventMonitorId === monitorId,
    ) || null
  );
}

export function runtimeListParams(monitoredOnly = false) {
  return {
    limit: 100,
    monitoredOnly: monitoredOnly || undefined,
  };
}

export function filterMonitoredTopology({
  applications = [],
  collections = [],
  components = [],
  deployments = [],
  monitoredOnly = false,
  topology = {},
} = {}) {
  if (!monitoredOnly) {
    return { applications, collections, components, deployments };
  }
  const applicationIds = new Set(topology.applicationIds || []);
  const componentIds = new Set(topology.componentIds || []);
  const deploymentIds = new Set(topology.deploymentIds || []);
  const filteredApplications = applications.filter(({ id }) =>
    applicationIds.has(id),
  );
  const filteredComponents = components.filter(({ id }) =>
    componentIds.has(id),
  );
  const filteredDeployments = deployments.filter(({ id }) =>
    deploymentIds.has(id),
  );
  const collectionById = new Map(collections.map((item) => [item.id, item]));
  const visibleCollectionIds = new Set();
  for (const application of filteredApplications) {
    let collectionId = application.collectionId || "";
    const visited = new Set();
    while (collectionId && !visited.has(collectionId)) {
      visited.add(collectionId);
      visibleCollectionIds.add(collectionId);
      collectionId = collectionById.get(collectionId)?.parentId || "";
    }
  }
  return {
    applications: filteredApplications,
    collections: collections.filter(({ id }) => visibleCollectionIds.has(id)),
    components: filteredComponents,
    deployments: filteredDeployments,
  };
}
