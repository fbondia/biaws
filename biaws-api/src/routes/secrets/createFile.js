import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../repositories/audit/index.js";
import { createFileSecret } from "../../services/secretsService.js";
import {
  uploadSecretFile,
  auditTarget,
  auditMetadata,
  asyncHandler,
} from "./helpers.js";

export function registerCreateFile(router) {
  router.post(
    "/files",
    requireAllPermissions("secrets.create", "secrets.value.write"),
    uploadSecretFile.single("file"),
    asyncHandler(async (req, res) => {
      const secret = await createFileSecret(req.body, req.file, req.actor);
      await recordAuditEvent({
        actor: req.actor,
        action: "created",
        target: auditTarget(secret),
        after: secret,
        metadata: auditMetadata(secret),
        summary: `Arquivo secreto criado: ${secret.name}`,
      });
      res.status(201).json({ secret });
    }),
  );
}
