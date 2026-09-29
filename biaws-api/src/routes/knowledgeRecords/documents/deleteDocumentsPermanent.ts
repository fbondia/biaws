import type { Router, Request, Response } from "express";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import { deleteDocument } from "../../../repositories/documents/index.js";
import { deleteStoredAttachments } from "../../../services/attachmentService.js";
import { knowledgeContextMetadata } from "../../../repositories/shared/knowledgeContext.js";
import { authorize, query, currentDocument, sendNotFound, asyncHandler } from "../helpers.js";

export function registerDeleteDocumentsPermanent(router: Router) {
  router.delete(
    "/documents/:id/permanent",
    authorize("archive"),
    asyncHandler(async (req: Request, res: Response) => {
      const before = await currentDocument(req, "archive");
      if (!before) return sendNotFound(res);
      const result = await deleteDocument(req.params.id, query(req, "archive"));
      const attachmentCleanup = await deleteStoredAttachments("documents", before);
      await recordAuditEvent({
        actor: req.actor,
        action: "deleted",
        target: {
          type: "document",
          id: before.id,
          label: before.title,
        },
        before,
        after: null,
        summary: "Documento excluído definitivamente",
        metadata: knowledgeContextMetadata(before),
      });
      res.json({ ...result, attachmentCleanup });
    }),
  );
}
