import { recordAuditEvent } from "../../../repositories/audit/index.js";
import {
  documentTypeConfig,
  updateDocument,
} from "../../../repositories/documents/index.js";
import { knowledgeContextMetadata } from "../../../repositories/shared/knowledgeContext.js";
import {
  authorize,
  query,
  actorId,
  typeFor,
  currentDocument,
  sendNotFound,
  asyncHandler,
} from "../helpers.js";

export function registerReplaceDocument(router) {
  router.put(
    "/documents/:id",
    authorize("update"),
    asyncHandler(async (req, res) => {
      const before = await currentDocument(req, "update");
      if (!before) return sendNotFound(res);
      const documentType = typeFor(req, req.body) || before.documentType;
      const result = await updateDocument(
        req.params.id,
        { ...req.body, documentType, updatedBy: actorId(req) },
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
        summary: `${documentTypeConfig(result.document.documentType).label} atualizada`,
        metadata: knowledgeContextMetadata(result.document),
      });
      res.json(result);
    }),
  );
}
