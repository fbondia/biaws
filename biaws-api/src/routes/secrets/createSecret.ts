import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../repositories/audit/index.js";
import { createSecret } from "../../services/secretsService.js";
import { auditTarget, auditMetadata, asyncHandler } from "./helpers.js";

export function registerCreateSecret(router: Router) {
  router.post(
    "/",
    requireAllPermissions("secrets.create", "secrets.value.write"),
    asyncHandler(async (req: Request, res: Response) => {
      const secret = await createSecret(req.body, req.actor);
      await recordAuditEvent({
        actor: req.actor,
        action: "created",
        target: auditTarget(secret),
        after: secret,
        metadata: auditMetadata(secret),
        summary: `Segredo criado: ${secret.name}`,
      });
      res.status(201).json({ secret });
    }),
  );
}
