import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import { downloadSecretFile } from "../../../services/secretsService.js";
import { auditTarget, auditMetadata, asyncHandler } from "../helpers.js";

export function registerCreateDownload(router: Router) {
  router.post(
    "/:secretId/download",
    requireAllPermissions("secrets.value.reveal"),
    asyncHandler(async (req: Request, res: Response) => {
      const downloaded = await downloadSecretFile(
        req.params.secretId,
        req.actor,
      );
      await recordAuditEvent({
        actor: req.actor,
        action: "revealed",
        target: auditTarget(downloaded.secret),
        metadata: auditMetadata(downloaded.secret),
        summary: `Arquivo secreto baixado: ${downloaded.secret.name}`,
      });
      const fallbackName = downloaded.fileName.replace(/[\r\n"]/gu, "_");
      const encodedName = encodeURIComponent(downloaded.fileName);
      res.set({
        "Cache-Control": "no-store, private",
        Pragma: "no-cache",
        "Content-Type": downloaded.mediaType,
        "Content-Length": String(downloaded.content.length),
        "Content-Disposition": `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`,
        "X-Content-Type-Options": "nosniff",
      });
      res.send(downloaded.content);
    }),
  );
}
