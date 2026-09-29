import type { Router, Request, Response } from "express";
import { recordAuditEvent } from "../../repositories/audit/index.js";
import { createDocument, documentTypeConfig } from "../../repositories/documents/index.js";
import { knowledgeContextMetadata } from "../../repositories/shared/knowledgeContext.js";
import { authorize, query, actorId, typeFor, asyncHandler } from "./helpers.js";

export function registerCreateDocument(router: Router) {
  router.post(
    "/documents",
    authorize("create"),
    asyncHandler(async (req: Request, res: Response) => {
      const documentType = typeFor(req, req.body);
      if (!documentType) {
        res.status(422).json({
          error: {
            code: "INVALID_DOCUMENT_TYPE",
            message: "documentType é obrigatório",
          },
        });
        return;
      }
      const result = await createDocument({ ...req.body, documentType, createdBy: actorId(req) }, query(req, "create"));
      const document = result.document;
      if (!document) throw new Error("Created document could not be read");
      await recordAuditEvent({
        actor: req.actor,
        action: "created",
        target: { type: "document", id: document.id, label: document.title },
        after: document,
        summary: `${documentTypeConfig(document.documentType).label} criada`,
        metadata: knowledgeContextMetadata(document),
      });
      res.status(201).json(result);
    }),
  );
}
