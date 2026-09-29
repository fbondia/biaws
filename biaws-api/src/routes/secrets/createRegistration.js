import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../repositories/audit/index.js";
import { registerSecretMetadata } from "../../services/secretsService.js";
import { auditTarget, auditMetadata, asyncHandler } from "./helpers.js";

export function registerCreateRegistration(router) {
  router.post(
    "/registrations",
    requireAllPermissions("secrets.metadata.create"),
    asyncHandler(async (req, res) => {
      const secret = await registerSecretMetadata(req.body, req.actor);
      await recordAuditEvent({
        actor: req.actor,
        action: "registered",
        target: auditTarget(secret),
        after: secret,
        metadata: auditMetadata(secret),
        summary: `Necessidade de segredo registrada: ${secret.name}`,
      });
      res.status(201).json({ secret });
    }),
  );
}
