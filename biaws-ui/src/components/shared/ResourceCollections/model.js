function sortCollections(items) {
  return [...items].sort((first, second) =>
    first.name.localeCompare(second.name, "pt-BR", { sensitivity: "base" }),
  );
}

export function buildCollectionTree(collections = []) {
  const knownIds = new Set(collections.map(({ id }) => id));
  const childrenByParent = new Map();

  for (const collection of collections) {
    const parentId = knownIds.has(collection.parentId)
      ? collection.parentId
      : "";
    const children = childrenByParent.get(parentId) || [];
    children.push(collection);
    childrenByParent.set(parentId, children);
  }

  for (const [parentId, children] of childrenByParent) {
    childrenByParent.set(parentId, sortCollections(children));
  }

  return childrenByParent;
}

export function collectionPathLabel(collections = [], collectionId = "") {
  if (!collectionId) return "Raiz";
  const byId = new Map(
    collections.map((collection) => [collection.id, collection]),
  );
  const path = [];
  const visited = new Set();
  let currentId = collectionId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const collection = byId.get(currentId);
    if (!collection) break;
    path.unshift(collection.name);
    currentId = collection.parentId;
  }

  return path.length ? path.join(" / ") : "Raiz";
}

export function parentCollectionId(collections = [], collectionId = "") {
  if (!collectionId) return "";
  return (
    collections.find((collection) => collection.id === collectionId)
      ?.parentId || ""
  );
}

export function descendantCollectionIds(childrenByParent, collectionId) {
  const descendants = new Set();
  const pending = [...(childrenByParent.get(collectionId) || [])];

  while (pending.length) {
    const current = pending.pop();
    if (!current || descendants.has(current.id)) continue;
    descendants.add(current.id);
    pending.push(...(childrenByParent.get(current.id) || []));
  }

  return descendants;
}

function collectionIdPath(collections, collectionId) {
  if (!collectionId) return [];
  const byId = new Map(
    collections.map((collection) => [collection.id, collection]),
  );
  const path = [];
  const visited = new Set();
  let currentId = collectionId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const collection = byId.get(currentId);
    if (!collection) break;
    path.unshift(currentId);
    currentId = collection.parentId;
  }

  return path;
}

export function buildCollectionColumns(
  collections,
  childrenByParent,
  collectionId,
) {
  const activePath = collectionIdPath(collections, collectionId);
  const columns = [
    { parentId: "", collections: childrenByParent.get("") || [] },
  ];

  for (const activeCollectionId of activePath) {
    columns.push({
      parentId: activeCollectionId,
      collections: childrenByParent.get(activeCollectionId) || [],
    });
  }

  return { activePath, columns };
}

export function countItemsByCollection(items) {
  return items.reduce((counts, item) => {
    const collectionId = item.collectionId || "";
    counts[collectionId] = (counts[collectionId] || 0) + 1;
    return counts;
  }, {});
}

export function groupItemsByCollection(collections, items) {
  const knownCollectionIds = new Set(
    collections.map((collection) => collection.id),
  );

  return items.reduce((groups, item) => {
    const requestedCollectionId = item.collectionId || "";
    const collectionId = knownCollectionIds.has(requestedCollectionId)
      ? requestedCollectionId
      : "";
    const groupedItems = groups.get(collectionId) || [];
    groupedItems.push(item);
    groups.set(collectionId, groupedItems);
    return groups;
  }, new Map());
}

export function collectionIdsContainingItems(collections = [], items = []) {
  const byId = new Map(
    collections.map((collection) => [collection.id, collection]),
  );
  const visibleIds = new Set();

  for (const item of items) {
    let collectionId = String(item.collectionId || "");
    const visited = new Set();
    while (collectionId && !visited.has(collectionId)) {
      visited.add(collectionId);
      const collection = byId.get(collectionId);
      if (!collection) break;
      visibleIds.add(collectionId);
      collectionId = String(collection.parentId || "");
    }
  }

  return visibleIds;
}

export function populatedCollections(collections = [], items = []) {
  const visibleIds = collectionIdsContainingItems(collections, items);
  return collections.filter(({ id }) => visibleIds.has(id));
}

export function isItemReorderDrop(draggedItem, targetItem, getItemId) {
  if (draggedItem?.type !== "item" || !targetItem) return false;

  const targetId = getItemId(targetItem);
  if (!draggedItem.id || draggedItem.id === targetId) return false;

  return (
    String(draggedItem.collectionId || "") ===
    String(targetItem.collectionId || "")
  );
}

export function collectionItemLifecycleActions(item, handlers = {}) {
  const archived = item?.status === "archived";
  return {
    archive: !archived && Boolean(handlers.onArchiveItem),
    delete: archived && Boolean(handlers.onDeleteItem),
    restore: archived && Boolean(handlers.onRestoreItem),
  };
}
