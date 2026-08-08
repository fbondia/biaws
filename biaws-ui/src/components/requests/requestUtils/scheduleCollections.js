function sortCollections(collections) {
  return [...collections].sort((first, second) =>
    first.name.localeCompare(second.name, "pt-BR", { sensitivity: "base" }),
  );
}

export function requestsInCollectionBranch(
  collections = [],
  requests = [],
  collectionId = "",
) {
  if (!collectionId) return requests;

  const childrenByParent = new Map();
  for (const collection of collections) {
    const children = childrenByParent.get(collection.parentId || "") || [];
    children.push(collection.id);
    childrenByParent.set(collection.parentId || "", children);
  }

  const branchIds = new Set([collectionId]);
  const pendingIds = [...(childrenByParent.get(collectionId) || [])];

  while (pendingIds.length) {
    const currentId = pendingIds.pop();
    if (!currentId || branchIds.has(currentId)) continue;
    branchIds.add(currentId);
    pendingIds.push(...(childrenByParent.get(currentId) || []));
  }

  return requests.filter((request) =>
    branchIds.has(request.collectionId || ""),
  );
}

export function buildScheduleCollectionRows(collections = [], items = []) {
  const knownCollectionIds = new Set(
    collections.map((collection) => collection.id),
  );
  const childrenByParent = new Map();
  const itemsByCollection = new Map();

  for (const collection of collections) {
    const parentId = knownCollectionIds.has(collection.parentId)
      ? collection.parentId
      : "";
    const children = childrenByParent.get(parentId) || [];
    children.push(collection);
    childrenByParent.set(parentId, children);
  }

  for (const [parentId, children] of childrenByParent) {
    childrenByParent.set(parentId, sortCollections(children));
  }

  for (const item of items) {
    const requestedCollectionId = item.request?.collectionId || "";
    const collectionId = knownCollectionIds.has(requestedCollectionId)
      ? requestedCollectionId
      : "";
    const groupedItems = itemsByCollection.get(collectionId) || [];
    groupedItems.push(item);
    itemsByCollection.set(collectionId, groupedItems);
  }

  function visitCollection(collection, depth, ancestors) {
    if (ancestors.has(collection.id)) return [];

    const nextAncestors = new Set(ancestors).add(collection.id);
    const childRows = (childrenByParent.get(collection.id) || []).flatMap(
      (child) => visitCollection(child, depth + 1, nextAncestors),
    );
    const itemRows = (itemsByCollection.get(collection.id) || []).map(
      (item) => ({ kind: "item", item, depth: depth + 1 }),
    );
    const contentRows = [...childRows, ...itemRows];
    const itemCount = contentRows.reduce(
      (total, row) => total + (row.kind === "item" ? 1 : 0),
      0,
    );

    if (!itemCount) return [];

    return [
      {
        kind: "collection",
        id: collection.id,
        name: collection.name,
        depth,
        itemCount,
      },
      ...contentRows,
    ];
  }

  const collectionRows = (childrenByParent.get("") || []).flatMap(
    (collection) => visitCollection(collection, 1, new Set()),
  );
  const rootItemRows = (itemsByCollection.get("") || []).map((item) => ({
    kind: "item",
    item,
    depth: 1,
  }));

  if (!items.length) return [];

  return [
    {
      kind: "collection",
      id: "",
      name: "Raiz",
      depth: 0,
      itemCount: items.length,
    },
    ...collectionRows,
    ...rootItemRows,
  ];
}
