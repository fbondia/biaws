import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../repositories/audit/index.js";
import {
  getAccessibleSecret,
  updateSecret,
} from "../../services/secretsService.js";
import { auditTarget, auditMetadata, asyncHandler } from "./helpers.js";

export function registerUpdateSecret(router: Router) {
  router.patch(
    "/:secretId",
    requireAllPermissions("secrets.metadata.read", "secrets.update"),
    asyncHandler(async (req: Request, res: Response) => {
      const before = await getAccessibleSecret(req.params.secretId, req.actor);
      const secret = await updateSecret(
        req.params.secretId,
        req.body,
        req.actor,
      );
      if (!secret) {
        res.status(404).json({
          error: { code: "SECRET_NOT_FOUND", message: "Secret not found" },
        });
        return;
      }
      await recordAuditEvent({
        actor: req.actor,
        action: "updated",
        target: auditTarget(secret),
        before,
        after: secret,
        metadata: auditMetadata(secret),
        summary: `Segredo alterado: ${secret.name}`,
      });
      res.json({ secret });
    }),
  );
}
