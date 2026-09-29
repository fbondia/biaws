import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import { revealSecret } from "../../../services/secretsService.js";
import { auditTarget, auditMetadata, asyncHandler } from "../helpers.js";

export function registerCreateReveal(router: Router) {
  router.post(
    "/:secretId/reveal",
    requireAllPermissions("secrets.value.reveal"),
    asyncHandler(async (req: Request, res: Response) => {
      const revealed = await revealSecret(req.params.secretId, req.actor);
      await recordAuditEvent({
        actor: req.actor,
        action: "revealed",
        target: auditTarget(revealed.secret),
        metadata: auditMetadata(revealed.secret),
        summary: `Segredo revelado: ${revealed.secret.name}`,
      });
      res.set({
        "Cache-Control": "no-store, private",
        Pragma: "no-cache",
      });
      res.json({ value: revealed.value, version: revealed.version });
    }),
  );
}
