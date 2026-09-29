import type { Router, Request, Response } from "express";
import { actorCanAccessApplication, requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import { deleteApplication, getApplication } from "../../../repositories/catalog/index.js";
import { sendNotFound, asyncHandler } from "../helpers.js";

export function registerDeleteApplicationsPermanent(router: Router) {
  router.delete(
    "/applications/:applicationId/permanent",
    requireAllPermissions("applications.archive"),
    asyncHandler(async (req: Request, res: Response) => {
      const before = actorCanAccessApplication(req.actor, "applications.archive", req.params.applicationId)
        ? await getApplication(req.params.applicationId, {
            workspaceId: req.actor.workspaceId,
          })
        : null;
      if (!before) {
        sendNotFound(res, "APPLICATION_NOT_FOUND", "Application not found");
        return;
      }
      await deleteApplication(req.params.applicationId);
      await recordAuditEvent({
        actor: req.actor,
        action: "deleted",
        target: { type: "application", id: before.id, label: before.name },
        before,
        after: null,
        metadata: {
          workspaceId: before.workspaceId,
          applicationId: before.id,
        },
        summary: `Aplicação excluída definitivamente: ${before.name}`,
      });
      res.json({ deleted: true, id: before.id });
    }),
  );
}
