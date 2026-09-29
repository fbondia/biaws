import type { Router, Request, Response } from "express";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import { moveDocument } from "../../../repositories/documents/index.js";
import { knowledgeContextMetadata } from "../../../repositories/shared/knowledgeContext.js";
import { authorize, query, actorId, currentDocument, sendNotFound, asyncHandler } from "../helpers.js";

export function registerUpdateDocumentsCollection(router: Router) {
  router.patch(
    "/documents/:id/collection",
    authorize("update"),
    asyncHandler(async (req: Request, res: Response) => {
      const before = await currentDocument(req, "update");
      if (!before) return sendNotFound(res);
      const result = await moveDocument(
        req.params.id,
        req.body.collectionId,
        { updatedBy: actorId(req) },
        query(req, "update"),
      );
      await recordAuditEvent({
        actor: req.actor,
        action: "updated",
        target: {
          type: "document",
          id: result.document.id,
          label: result.document.title,
        },
        before,
        after: result.document,
        summary: "Documento movido entre coleções",
        metadata: knowledgeContextMetadata(result.document),
      });
      res.json(result);
    }),
  );
}
