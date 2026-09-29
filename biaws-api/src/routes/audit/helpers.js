import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";

export const readPermissionByType = {
  issue: "issues.read",
  demand: "demands.read",
  task: "demands.read",
  document: "documents.read",
  taxonomy: "taxonomy.read",
  skill: "skills.read",
  application: "applications.read",
  workspace: "workspaces.read",
  component: "components.read",
  integration: "integrations.read",
  repository: "repositories.read",
  server: "servers.read",
  deployment: "deployments.read",
  runtime: "runtimes.read",
};

export function authorizeAuditRead(req, res, next) {
  const permission = readPermissionByType[req.params.entityType];
  if (!permission) {
    res.status(404).json({
      error: {
        code: "AUDIT_ENTITY_NOT_FOUND",
        message: "Unsupported audit entity",
      },
    });
    return;
  }
  requireAllPermissions(permission)(req, res, next);
}
