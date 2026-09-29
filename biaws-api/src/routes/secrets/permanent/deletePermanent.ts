import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import {
  deleteSecret,
  getAccessibleSecret,
} from "../../../services/secretsService.js";
import { auditTarget, auditMetadata, asyncHandler } from "../helpers.js";

export function registerDeletePermanent(router: Router) {
  router.delete(
    "/:secretId/permanent",
    requireAllPermissions("secrets.metadata.read", "secrets.archive"),
    asyncHandler(async (req: Request, res: Response) => {
      const before = await getAccessibleSecret(req.params.secretId, req.actor);
      await deleteSecret(req.params.secretId, req.actor);
      await recordAuditEvent({
        actor: req.actor,
        action: "deleted",
        target: auditTarget(before),
        before,
        after: null,
        metadata: auditMetadata(before),
        summary: `Segredo excluído definitivamente: ${before.name}`,
      });
      res.json({ deleted: true, id: before.id });
    }),
  );
}
