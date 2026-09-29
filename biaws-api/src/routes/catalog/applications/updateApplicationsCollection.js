import {
  actorCanAccessApplication,
  requireAllPermissions,
} from "../../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import {
  getApplication,
  moveApplicationToCollection,
} from "../../../repositories/catalog/index.js";
import { sendNotFound, asyncHandler } from "../helpers.js";

export function registerUpdateApplicationsCollection(router) {
  router.patch(
    "/applications/:applicationId/collection",
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
      const after = await moveApplicationToCollection(
        before.id,
        req.body?.collectionId,
        req.actor,
      );
      await recordAuditEvent({
        actor: req.actor,
        action: "updated",
        target: { type: "application", id: after.id, label: after.name },
        before,
        after,
        metadata: { workspaceId: after.workspaceId },
        summary: `Aplicação movida entre coleções: ${after.name}`,
      });
      res.json({ application: after });
    }),
  );
}
