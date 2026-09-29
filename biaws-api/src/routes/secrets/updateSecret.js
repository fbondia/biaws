import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../repositories/audit/index.js";
import {
  getAccessibleSecret,
  updateSecret,
} from "../../services/secretsService.js";
import { auditTarget, auditMetadata, asyncHandler } from "./helpers.js";

export function registerUpdateSecret(router) {
  router.patch(
    "/:secretId",
    requireAllPermissions("secrets.metadata.read", "secrets.update"),
    asyncHandler(async (req, res) => {
      const before = await getAccessibleSecret(req.params.secretId, req.actor);
      const secret = await updateSecret(
        req.params.secretId,
        req.body,
        req.actor,
      );
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
