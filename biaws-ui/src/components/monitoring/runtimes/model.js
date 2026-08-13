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
