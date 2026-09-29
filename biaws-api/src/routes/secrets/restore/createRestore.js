import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import {
  getAccessibleSecret,
  restoreSecret,
} from "../../../services/secretsService.js";
import { auditTarget, auditMetadata, asyncHandler } from "../helpers.js";

export function registerCreateRestore(router) {
  router.post(
    "/:secretId/restore",
    requireAllPermissions("secrets.metadata.read", "secrets.archive"),
    asyncHandler(async (req, res) => {
      const before = await getAccessibleSecret(req.params.secretId, req.actor);
      const secret = await restoreSecret(req.params.secretId, req.actor);
      await recordAuditEvent({
        actor: req.actor,
        action: "restored",
        target: auditTarget(secret),
        before,
        after: secret,
        metadata: auditMetadata(secret),
        summary: `Segredo desarquivado: ${secret.name}`,
      });
      res.json({ secret });
    }),
  );
}
