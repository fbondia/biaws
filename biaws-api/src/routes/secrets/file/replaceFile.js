import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import { writeSecretFile } from "../../../services/secretsService.js";
import {
  uploadSecretFile,
  auditTarget,
  auditMetadata,
  asyncHandler,
} from "../helpers.js";

export function registerReplaceFile(router) {
  router.put(
    "/:secretId/file",
    requireAllPermissions("secrets.value.write"),
    uploadSecretFile.single("file"),
    asyncHandler(async (req, res) => {
      const secret = await writeSecretFile(
        req.params.secretId,
        req.file,
        req.actor,
      );
      await recordAuditEvent({
        actor: req.actor,
        action: "version.created",
        target: auditTarget(secret),
        metadata: auditMetadata(secret),
        summary: `Nova versão de arquivo gravada para o segredo: ${secret.name}`,
      });
      res.json({ secret });
    }),
  );
}
