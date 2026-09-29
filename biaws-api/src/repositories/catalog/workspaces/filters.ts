export function buildOperationalWorkspaceFilter(workspaceId: string | string[]) {
  return {
    id: String(workspaceId),
  };
}
