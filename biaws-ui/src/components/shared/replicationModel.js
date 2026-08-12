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
