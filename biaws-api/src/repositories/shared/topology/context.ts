import { createCatalogError } from "./errors.js";
import { getApplication } from "../../catalog/applications/queries.js";
import { getWorkspace } from "../../catalog/workspaces/queries.js";

export async function requireOperationalWorkspace(
  workspaceId: string | string[],
  { active = false } = {},
) {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) {
    throw createCatalogError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  }
  if (active && workspace.status !== "active") {
    throw createCatalogError(
      409,
      "WORKSPACE_ARCHIVED",
      "Workspace is archived",
    );
  }
  return workspace;
}

export async function requireOperationalApplication(
  applicationId: string | string[],
  {
    active = false,
    workspaceId,
  }: { active?: boolean; workspaceId?: string } = {},
) {
  const application = await getApplication(applicationId, { workspaceId });
  if (!application) {
    throw createCatalogError(
      404,
      "APPLICATION_NOT_FOUND",
      "Application not found",
    );
  }
  await requireOperationalWorkspace(application.workspaceId, { active });
  if (active && application.status !== "active") {
    throw createCatalogError(
      409,
      "APPLICATION_ARCHIVED",
      "Application is archived",
    );
  }
  return application;
}
