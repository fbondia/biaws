import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import { archiveSecret, getAccessibleSecret } from "../../../services/secretsService.js";
import { auditTarget, auditMetadata, asyncHandler } from "../helpers.js";

export function registerCreateArchive(router: Router) {
  router.post(
    "/:secretId/archive",
    requireAllPermissions("secrets.metadata.read", "secrets.archive"),
    asyncHandler(async (req: Request, res: Response) => {
      const before = await getAccessibleSecret(req.params.secretId, req.actor);
      const secret = await archiveSecret(req.params.secretId, req.actor);
      await recordAuditEvent({
        actor: req.actor,
        action: "archived",
        target: auditTarget(secret),
        before,
        after: secret,
        metadata: auditMetadata(secret),
        summary: `Segredo arquivado: ${secret.name}`,
      });
      res.json({ secret });
    }),
  );
}
