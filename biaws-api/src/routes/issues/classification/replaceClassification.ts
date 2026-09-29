import type { Router, Request, Response } from "express";
import { getIssue, saveIssueClassification } from "../../../repositories/issues/index.js";
import { authorizationQuery, requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import { knowledgeContextMetadata } from "../../../repositories/shared/knowledgeContext.js";
import { asyncHandler } from "../helpers.js";

export function registerReplaceClassification(router: Router) {
  router.put(
    "/:id/classification",
    requireAllPermissions("issues.classification.update"),
    asyncHandler(async (req: Request, res: Response) => {
      const scopedQuery = authorizationQuery(req.actor, "issues.classification.update", req.query);
      const before = (await getIssue(req.params.id, scopedQuery)).issue;
      const result = await saveIssueClassification(
        req.params.id,
        { ...req.body, updatedBy: req.actor.email || req.actor.userId },
        scopedQuery,
      );
      await recordAuditEvent({
        actor: req.actor,
        action: "classification_updated",
        target: {
          type: "issue",
          id: req.params.id,
          label: result.issue?.title,
        },
        before: before?.classification || null,
        after: result.issue?.classification || null,
        summary: "Classificação da issue atualizada",
        metadata: knowledgeContextMetadata(result.issue),
      });
      res.json(result);
    }),
  );
}
