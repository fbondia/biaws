function sortCollections(collections) {
  return [...collections].sort((first, second) =>
    first.name.localeCompare(second.name, "pt-BR", { sensitivity: "base" }),
  );
}

function emptyTotals(months) {
  return {
    planned: 0,
    executed: 0,
    months: Object.fromEntries(
      months.map((month) => [month, { planned: 0, executed: 0 }]),
    ),
  };
}

function requestTotals(request, months) {
  const totals = emptyTotals(months);

  for (const journey of request.journeys || []) {
    const planned = Number(journey.plannedJourneys) || 0;
    const executed = Number(journey.executedJourneys) || 0;
    totals.planned += planned;
    totals.executed += executed;

    if (totals.months[journey.month]) {
      totals.months[journey.month].planned += planned;
      totals.months[journey.month].executed += executed;
    }
  }

  return totals;
}

function addTotals(target, source, months) {
  target.planned += source.planned;
  target.executed += source.executed;
  for (const month of months) {
    target.months[month].planned += source.months[month].planned;
    target.months[month].executed += source.months[month].executed;
  }
}

export function buildJourneyCollectionRows(
  collections = [],
  requests = [],
  months = [],
) {
  const knownCollectionIds = new Set(
    collections.map((collection) => collection.id),
  );
  const childrenByParent = new Map();
  const requestsByCollection = new Map();

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

  for (const request of requests) {
    const requestedCollectionId = request.collectionId || "";
    const collectionId = knownCollectionIds.has(requestedCollectionId)
      ? requestedCollectionId
      : "";
    const groupedRequests = requestsByCollection.get(collectionId) || [];
    groupedRequests.push(request);
    requestsByCollection.set(collectionId, groupedRequests);
  }

  function visitCollection(collection, depth, ancestors) {
    if (ancestors.has(collection.id)) {
      return { rows: [], totals: emptyTotals(months), itemCount: 0 };
    }

    const nextAncestors = new Set(ancestors).add(collection.id);
    const totals = emptyTotals(months);
    const childRows = [];
    let itemCount = 0;

    for (const child of childrenByParent.get(collection.id) || []) {
      const childResult = visitCollection(child, depth + 1, nextAncestors);
      childRows.push(...childResult.rows);
      addTotals(totals, childResult.totals, months);
      itemCount += childResult.itemCount;
    }

    const itemRows = (requestsByCollection.get(collection.id) || []).map(
      (request) => {
        const itemTotals = requestTotals(request, months);
        addTotals(totals, itemTotals, months);
        itemCount += 1;
        return { kind: "item", request, depth: depth + 1, totals: itemTotals };
      },
    );

    if (!itemCount) return { rows: [], totals, itemCount: 0 };

    return {
      rows: [
        {
          kind: "collection",
          id: collection.id,
          name: collection.name,
          depth,
          itemCount,
          totals,
        },
        ...childRows,
        ...itemRows,
      ],
      totals,
      itemCount,
    };
  }

  const totals = emptyTotals(months);
  const collectionRows = [];

  for (const collection of childrenByParent.get("") || []) {
    const result = visitCollection(collection, 1, new Set());
    collectionRows.push(...result.rows);
    addTotals(totals, result.totals, months);
  }

  const rootTotals = emptyTotals(months);
  const rootItemRows = (requestsByCollection.get("") || []).map((request) => {
    const itemTotals = requestTotals(request, months);
    addTotals(rootTotals, itemTotals, months);
    addTotals(totals, itemTotals, months);
    return { kind: "item", request, depth: 2, totals: itemTotals };
  });
  const rootRows = rootItemRows.length
    ? [
        {
          kind: "collection",
          id: "__root__",
          name: "Raiz",
          depth: 1,
          itemCount: rootItemRows.length,
          totals: rootTotals,
        },
        ...rootItemRows,
      ]
    : [];

  if (!requests.length) return [];

  return [
    {
      kind: "collection",
      id: "",
      name: "Total geral",
      depth: 0,
      itemCount: requests.length,
      totals,
    },
    ...collectionRows,
    ...rootRows,
  ];
}
