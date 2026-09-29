import type { Request } from "express";
import { authorizationQuery } from "../../auth/authorizationMiddleware.js";
import {
  resolveEntityReference,
  resolveTaskReference,
} from "../../repositories/shared/references.js";

const PARAMETER_TYPES = {
  applicationId: "application",
  componentId: "component",
  integrationId: "integration",
  repositoryId: "repository",
  serverId: "server",
  deploymentId: "deployment",
  runtimeId: "runtime",
  secretId: "secret",
};

export async function resolveRouteReferences(req: Request, rootType?: string) {
  const permissions = req.referencePermissions || [];
  if (!permissions.length) return;
  const query = authorizationQuery(req.actor, permissions[0], req.query);
  for (const [parameter, type] of Object.entries({
    ...(rootType ? { id: rootType } : {}),
    ...PARAMETER_TYPES,
  })) {
    if (!req.params[parameter]) continue;
    // Resolve within every permission's scope before giving a handler its ID.
    for (const permission of permissions) {
      req.params[parameter] = await resolveEntityReference(
        type,
        req.params[parameter],
        authorizationQuery(req.actor, permission, req.query),
        type === "runtime" && req.query.deploymentId
          ? { deploymentId: req.query.deploymentId }
          : {},
      );
    }
  }
  if (rootType === "demand" && req.params.taskId) {
    req.params.taskId = await resolveTaskReference(
      req.params.taskId,
      req.params.id,
      query,
    );
  }
}
