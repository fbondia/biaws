import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import { writeSecretValue } from "../../../services/secretsService.js";
import { auditTarget, auditMetadata, asyncHandler } from "../helpers.js";

export function registerReplaceValue(router: Router) {
  router.put(
    "/:secretId/value",
    requireAllPermissions("secrets.value.write"),
    asyncHandler(async (req: Request, res: Response) => {
      const secret = await writeSecretValue(
        req.params.secretId,
        req.body?.value,
        req.actor,
      );
      await recordAuditEvent({
        actor: req.actor,
        action: "version.created",
        target: auditTarget(secret),
        metadata: auditMetadata(secret),
        summary: `Nova versão gravada para o segredo: ${secret.name}`,
      });
      res.json({ secret });
    }),
  );
}
