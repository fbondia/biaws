import {
  actorCanAccessApplication,
  requireAllPermissions,
} from "../../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import {
  getApplication,
  restoreApplication,
} from "../../../repositories/catalog/index.js";
import { sendNotFound, asyncHandler } from "../helpers.js";

export function registerUpdateApplicationsRestore(router) {
  router.patch(
    "/applications/:applicationId/restore",
    requireAllPermissions("applications.archive"),
    asyncHandler(async (req, res) => {
      const before = actorCanAccessApplication(
        req.actor,
        "applications.archive",
        req.params.applicationId,
      )
        ? await getApplication(req.params.applicationId, {
            workspaceId: req.actor.workspaceId,
          })
        : null;
      if (!before) {
        sendNotFound(res, "APPLICATION_NOT_FOUND", "Application not found");
        return;
      }
      const after = await restoreApplication(
        req.params.applicationId,
        req.actor,
      );
      if (before.status !== after.status) {
        await recordAuditEvent({
          actor: req.actor,
          action: "restored",
          target: { type: "application", id: after.id, label: after.name },
          before,
          after,
          metadata: {
            workspaceId: after.workspaceId,
            applicationId: after.id,
          },
          summary: `Aplicação desarquivada: ${after.name}`,
        });
      }
      res.json({ application: after });
    }),
  );
}
