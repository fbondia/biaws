export function replicationTargets(workspaces = [], currentWorkspaceId = "") {
  return workspaces
    .filter(
      ({ id, status }) => id !== currentWorkspaceId && status !== "archived",
    )
    .toSorted((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

export function failedReplicationWorkspaceIds(results = []) {
  return results
    .filter(({ status }) => status === "failed")
    .map(({ workspace }) => workspace.id);
}

const DEFAULT_BULK_REPLICATION_CONCURRENCY = 4;

function fallbackWorkspace(workspaces, workspaceId) {
  return (
    workspaces.find(({ id }) => id === workspaceId) || {
      id: workspaceId,
      name: workspaceId,
    }
  );
}

function itemCountLabel(count) {
  return count === 1 ? "1 item" : `${count} itens`;
}

function failedItemsLabel(items) {
  const labels = [...new Set(items.map(({ label }) => label))];
  const visible = labels.slice(0, 3).join(", ");
  const remaining = labels.length - 3;
  return remaining > 0 ? `${visible} e mais ${remaining}` : visible;
}

function failureReasonLabel(results) {
  const reasons = [
    ...new Set(
      results
        .map(({ error }) => String(error?.message || "").trim())
        .filter(Boolean),
    ),
  ];
  if (!reasons.length) return "";
  const visible = reasons.slice(0, 2).join("; ");
  const remaining = reasons.length - 2;
  return ` Motivo${reasons.length === 1 ? "" : "s"}: ${visible}${
    remaining > 0 ? `; e mais ${remaining}` : ""
  }.`;
}

function aggregateWorkspaceResults(
  itemResults,
  destinationWorkspaceIds,
  workspaces,
) {
  return destinationWorkspaceIds.map((workspaceId) => {
    const results = itemResults.filter(
      ({ workspace }) => workspace.id === workspaceId,
    );
    const failed = results.filter(({ status }) => status === "failed");
    const succeeded = results.length - failed.length;
    const total = results.length;
    const workspace =
      results[0]?.workspace || fallbackWorkspace(workspaces, workspaceId);

    if (!failed.length) {
      return {
        workspace,
        status: "created",
        message: `${itemCountLabel(total)} replicado${total === 1 ? "" : "s"}.`,
      };
    }

    const failures = failedItemsLabel(
      failed.map(({ sourceItem }) => sourceItem),
    );
    const reasons = failureReasonLabel(failed);
    return {
      workspace,
      status: "failed",
      message:
        succeeded > 0
          ? `${succeeded} de ${total} itens replicados. Falharam: ${failures}.${reasons}`
          : `${
              total === 1
                ? "O item não foi replicado"
                : `Nenhum dos ${itemCountLabel(total)} foi replicado`
            }. Falharam: ${failures}.${reasons}`,
    };
  });
}

export async function replicateItemsInBulk({
  concurrency = DEFAULT_BULK_REPLICATION_CONCURRENCY,
  destinationWorkspaceIds = [],
  getItemId = (item) => item.id,
  getItemLabel = (item) => item.label || item.name || item.id,
  items = [],
  replicateItem,
  workspaces = [],
}) {
  const normalizedConcurrency = Math.max(
    1,
    Math.min(Number(concurrency) || 1, items.length || 1),
  );
  const itemResults = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      const sourceItem = {
        id: String(getItemId(item)),
        label: String(getItemLabel(item)),
      };

      try {
        const payload = await replicateItem(item, destinationWorkspaceIds);
        const byWorkspaceId = new Map(
          (payload.results || []).map((result) => [
            result.workspace.id,
            result,
          ]),
        );
        itemResults[index] = destinationWorkspaceIds.map((workspaceId) => {
          const result = byWorkspaceId.get(workspaceId);
          return result
            ? { ...result, sourceItem }
            : {
                workspace: fallbackWorkspace(workspaces, workspaceId),
                status: "failed",
                sourceItem,
              };
        });
      } catch (error) {
        itemResults[index] = destinationWorkspaceIds.map((workspaceId) => ({
          workspace: fallbackWorkspace(workspaces, workspaceId),
          status: "failed",
          error: {
            message: error?.message || "Não foi possível replicar o item",
          },
          sourceItem,
        }));
      }
    }
  }

  await Promise.all(
    Array.from({ length: normalizedConcurrency }, () => worker()),
  );

  const flattenedResults = itemResults.flat();
  const failed = flattenedResults.filter(
    ({ status }) => status === "failed",
  ).length;
  return {
    results: aggregateWorkspaceResults(
      flattenedResults,
      destinationWorkspaceIds,
      workspaces,
    ),
    summary: {
      total: flattenedResults.length,
      succeeded: flattenedResults.length - failed,
      failed,
    },
  };
}
