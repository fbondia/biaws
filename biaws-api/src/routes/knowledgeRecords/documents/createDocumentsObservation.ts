import type { Router, Request, Response } from "express";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import { addDocumentObservation } from "../../../repositories/documents/index.js";
import { knowledgeContextMetadata } from "../../../repositories/shared/knowledgeContext.js";
import { authorize, query, actorId, currentDocument, sendNotFound, asyncHandler } from "../helpers.js";

export function registerCreateDocumentsObservation(router: Router) {
  router.post(
    "/documents/:id/observations",
    authorize("update"),
    asyncHandler(async (req: Request, res: Response) => {
      const document = await currentDocument(req, "update");
      if (!document) return sendNotFound(res);
      const result = await addDocumentObservation(
        req.params.id,
        { ...req.body, createdBy: actorId(req) },
        query(req, "update"),
      );
      await recordAuditEvent({
        actor: req.actor,
        action: "created",
        target: {
          type: "document_observation",
          id: result.observation.id,
          label: "Observação",
        },
        root: { type: "document", id: document.id },
        after: result.observation,
        summary: "Observação adicionada",
        metadata: knowledgeContextMetadata(document),
      });
      res.status(201).json(result);
    }),
  );
}
