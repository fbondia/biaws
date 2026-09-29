import {
  requireAllPermissions,
  requireWorkspaceScope,
} from "../../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import { createApplication } from "../../../repositories/catalog/index.js";
import { asyncHandler } from "../helpers.js";

export function registerCreateWorkspacesApplication(router) {
  router.post(
    "/workspaces/:workspaceId/applications",
    requireAllPermissions("applications.create"),
    requireWorkspaceScope("applications.create"),
    asyncHandler(async (req, res) => {
      const application = await createApplication(
        req.params.workspaceId,
        req.body,
        req.actor,
      );
      await recordAuditEvent({
        actor: req.actor,
        action: "created",
        target: {
          type: "application",
          id: application.id,
          label: application.name,
        },
        after: application,
        metadata: {
          workspaceId: application.workspaceId,
          applicationId: application.id,
        },
        summary: `Aplicação criada: ${application.name}`,
      });
      res.status(201).json({ application });
    }),
  );
}
