import { createIssue } from "../../repositories/issues/index.js";
import {
  authorizationQuery,
  requireBodyFieldPermissions,
} from "../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../repositories/audit/index.js";
import { knowledgeContextMetadata } from "../../repositories/shared/knowledgeContext.js";
import { asyncHandler } from "./helpers.js";

export function registerCreateIssue(router) {
  router.post(
    "/",
    requireBodyFieldPermissions(
      { comment: "issues.comment.create" },
      "issues.create",
    ),
    asyncHandler(async (req, res) => {
      const result = await createIssue(
        { ...req.body, createdBy: req.actor.email || req.actor.userId },
        authorizationQuery(req.actor, "issues.create", req.query),
      );
      await recordAuditEvent({
        actor: req.actor,
        action: "created",
        target: {
          type: "issue",
          id: result.issue.id,
          label: result.issue.title,
        },
        after: result.issue,
        summary: "Issue criada",
        metadata: knowledgeContextMetadata(result.issue),
      });
      if (req.body.comment && result.comments?.length) {
        const comment = result.comments.at(-1);
        await recordAuditEvent({
          actor: req.actor,
          action: "comment_added",
          target: { type: "comment", id: comment._id || comment.hash },
          root: { type: "issue", id: result.issue.id },
          after: comment,
          summary: "Comentário inicial adicionado",
          metadata: knowledgeContextMetadata(result.issue),
        });
      }
      res.status(201).json(result);
    }),
  );
}
