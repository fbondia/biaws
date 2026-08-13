function compareNames(left, right) {
  return String(left || "").localeCompare(String(right || ""), "pt-BR", {
    sensitivity: "base",
  });
}

export function buildRuntimeDocumentTree(collections = [], documents = []) {
  const collectionById = new Map(
    collections.map((collection) => [collection.id, collection]),
  );
  const documentsByCollection = new Map();

  for (const document of documents) {
    const collectionId = collectionById.has(document.collectionId)
      ? document.collectionId
      : "";
    const items = documentsByCollection.get(collectionId) || [];
    items.push(document);
    documentsByCollection.set(collectionId, items);
  }

  for (const [collectionId, items] of documentsByCollection) {
    documentsByCollection.set(
      collectionId,
      [...items].sort((left, right) => compareNames(left.title, right.title)),
    );
  }

  const relevantCollectionIds = new Set();
  for (const collectionId of documentsByCollection.keys()) {
    const visited = new Set();
    let currentId = collectionId;
    while (
      currentId &&
      collectionById.has(currentId) &&
      !visited.has(currentId)
    ) {
      visited.add(currentId);
      relevantCollectionIds.add(currentId);
      currentId = collectionById.get(currentId).parentId || "";
    }
  }

  const childrenByParent = new Map();
  for (const collection of collections) {
    if (!relevantCollectionIds.has(collection.id)) continue;
    const parentId = relevantCollectionIds.has(collection.parentId)
      ? collection.parentId
      : "";
    const children = childrenByParent.get(parentId) || [];
    children.push(collection);
    childrenByParent.set(parentId, children);
  }
  for (const [parentId, children] of childrenByParent) {
    childrenByParent.set(
      parentId,
      [...children].sort((left, right) => compareNames(left.name, right.name)),
    );
  }

  function materialize(collection, visited = new Set()) {
    if (visited.has(collection.id)) return null;
    const nextVisited = new Set(visited);
    nextVisited.add(collection.id);
    return {
      ...collection,
      documents: documentsByCollection.get(collection.id) || [],
      children: (childrenByParent.get(collection.id) || [])
        .map((child) => materialize(child, nextVisited))
        .filter(Boolean),
    };
  }

  return {
    documents: documentsByCollection.get("") || [],
    collections: (childrenByParent.get("") || [])
      .map((collection) => materialize(collection))
      .filter(Boolean),
  };
}
