import { recordAuditEvent } from "../../../repositories/audit/index.js";
import { archiveDocument } from "../../../repositories/documents/index.js";
import { knowledgeContextMetadata } from "../../../repositories/shared/knowledgeContext.js";
import {
  authorize,
  query,
  actorId,
  currentDocument,
  sendNotFound,
  asyncHandler,
} from "../helpers.js";

export function registerDeleteDocument(router) {
  router.delete(
    "/documents/:id",
    authorize("archive"),
    asyncHandler(async (req, res) => {
      const before = await currentDocument(req, "archive");
      if (!before) return sendNotFound(res);
      const result = await archiveDocument(
        req.params.id,
        { documentType: before.documentType, updatedBy: actorId(req) },
        query(req, "archive"),
      );
      await recordAuditEvent({
        actor: req.actor,
        action: "archived",
        target: {
          type: "document",
          id: result.document.id,
          label: result.document.title,
        },
        before,
        after: result.document,
        summary: "Documento arquivado",
        metadata: knowledgeContextMetadata(result.document),
      });
      res.json(result);
    }),
  );
}
