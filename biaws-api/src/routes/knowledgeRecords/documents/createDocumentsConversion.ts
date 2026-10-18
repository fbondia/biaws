import type { Router, Request, Response } from "express";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import { convertDocument } from "../../../repositories/documents/conversion.js";
import { knowledgeContextMetadata } from "../../../repositories/shared/knowledgeContext.js";
import { actorId, authorize, query, asyncHandler } from "../helpers.js";

export function registerCreateDocumentsConversion(router: Router) {
  router.post(
    "/documents/:id/convert",
    authorize("update"),
    asyncHandler(async (req: Request, res: Response) => {
      const { previousDocument, ...result } = await convertDocument(
        req.params.id,
        {
          ...req.body,
          updatedBy: actorId(req),
        },
        query(req, "update"),
      );
      await recordAuditEvent({
        actor: req.actor,
        action: "updated",
        target: { type: "document", id: result.document.id, label: result.document.title },
        before: previousDocument,
        after: result.document,
        summary: req.body.mode === "catalog-item" ? "Documento incorporado ao catálogo" : "Tipo de documento alterado",
        metadata: { ...knowledgeContextMetadata(result.document), sourceDocumentId: result.sourceDocumentId },
      });
      res.json(result);
    }),
  );
}
