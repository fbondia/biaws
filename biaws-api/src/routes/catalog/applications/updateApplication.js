import {
  actorCanAccessApplication,
  requireAllPermissions,
} from "../../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import {
  getApplication,
  updateApplication,
} from "../../../repositories/catalog/index.js";
import { sendNotFound, asyncHandler } from "../helpers.js";

export function registerUpdateApplication(router) {
  router.patch(
    "/applications/:applicationId",
    requireAllPermissions("applications.update"),
    asyncHandler(async (req, res) => {
      const before = actorCanAccessApplication(
        req.actor,
        "applications.update",
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
      const after = await updateApplication(
        req.params.applicationId,
        req.body,
        req.actor,
      );
      await recordAuditEvent({
        actor: req.actor,
        action: "updated",
        target: { type: "application", id: after.id, label: after.name },
        before,
        after,
        metadata: {
          workspaceId: after.workspaceId,
          applicationId: after.id,
        },
        summary: `Aplicação atualizada: ${after.name}`,
      });
      res.json({ application: after });
    }),
  );
}
