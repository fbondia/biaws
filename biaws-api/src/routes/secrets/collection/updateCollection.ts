import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import {
  getAccessibleSecret,
  moveSecretToCollection,
} from "../../../services/secretsService.js";
import { auditTarget, auditMetadata, asyncHandler } from "../helpers.js";

export function registerUpdateCollection(router: Router) {
  router.patch(
    "/:secretId/collection",
    requireAllPermissions("secrets.metadata.read", "secrets.update"),
    asyncHandler(async (req: Request, res: Response) => {
      const before = await getAccessibleSecret(req.params.secretId, req.actor);
      const secret = await moveSecretToCollection(
        req.params.secretId,
        req.body?.collectionId,
        req.actor,
      );
      await recordAuditEvent({
        actor: req.actor,
        action: "updated",
        target: auditTarget(secret),
        before,
        after: secret,
        metadata: auditMetadata(secret),
        summary: `Segredo movido entre coleções: ${secret.name}`,
      });
      res.json({ secret });
    }),
  );
}
