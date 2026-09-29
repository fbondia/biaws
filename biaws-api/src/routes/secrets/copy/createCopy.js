import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import { revealSecret } from "../../../services/secretsService.js";
import { auditTarget, auditMetadata, asyncHandler } from "../helpers.js";

export function registerCreateCopy(router) {
  router.post(
    "/:secretId/copy",
    requireAllPermissions("secrets.value.reveal"),
    asyncHandler(async (req, res) => {
      const copied = await revealSecret(req.params.secretId, req.actor);
      await recordAuditEvent({
        actor: req.actor,
        action: "copied",
        target: auditTarget(copied.secret),
        metadata: auditMetadata(copied.secret),
        summary: `Valor do segredo copiado: ${copied.secret.name}`,
      });
      res.set({
        "Cache-Control": "no-store, private",
        Pragma: "no-cache",
      });
      res.json({ value: copied.value, version: copied.version });
    }),
  );
}
