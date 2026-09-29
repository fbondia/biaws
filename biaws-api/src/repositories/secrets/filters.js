export function accessFilter({ workspaceId, workspace, applicationIds }) {
  const filter = { workspaceId: String(workspaceId) };
  if (workspace !== true) {
    filter.applicationId = {
      $in: [...new Set((applicationIds || []).map(String))],
    };
  }
  return filter;
}
