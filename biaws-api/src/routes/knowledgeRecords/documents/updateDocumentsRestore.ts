import type { Router, Request, Response } from "express";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import { restoreDocument } from "../../../repositories/documents/index.js";
import { knowledgeContextMetadata } from "../../../repositories/shared/knowledgeContext.js";
import {
  authorize,
  query,
  actorId,
  currentDocument,
  sendNotFound,
  asyncHandler,
} from "../helpers.js";

export function registerUpdateDocumentsRestore(router: Router) {
  router.patch(
    "/documents/:id/restore",
    authorize("archive"),
    asyncHandler(async (req: Request, res: Response) => {
      const before = await currentDocument(req, "archive");
      if (!before) return sendNotFound(res);
      const result = await restoreDocument(
        req.params.id,
        { documentType: before.documentType, updatedBy: actorId(req) },
        query(req, "archive"),
      );
      if (!result.document) return sendNotFound(res);
      await recordAuditEvent({
        actor: req.actor,
        action: "restored",
        target: {
          type: "document",
          id: result.document.id,
          label: result.document.title,
        },
        before,
        after: result.document,
        summary: "Documento desarquivado",
        metadata: knowledgeContextMetadata(result.document),
      });
      res.json(result);
    }),
  );
}
