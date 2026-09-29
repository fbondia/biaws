import { createIssueComment } from "../../../repositories/issues/index.js";
import {
  authorizationQuery,
  requireAllPermissions,
} from "../../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import { knowledgeContextMetadata } from "../../../repositories/shared/knowledgeContext.js";
import { asyncHandler } from "../helpers.js";

export function registerCreateComment(router) {
  router.post(
    "/:id/comments",
    requireAllPermissions("issues.comment.create"),
    asyncHandler(async (req, res) => {
      const query = authorizationQuery(
        req.actor,
        "issues.comment.create",
        req.query,
      );
      const result = await createIssueComment(
        req.params.id,
        { ...req.body, createdBy: req.actor.email || req.actor.userId },
        query,
      );
      const comment = result.comments.find(
        (item) => String(item._id) === result.createdCommentId,
      );
      await recordAuditEvent({
        actor: req.actor,
        action: "comment_added",
        target: { type: "comment", id: comment?._id || comment?.hash },
        root: { type: "issue", id: req.params.id },
        after: comment,
        summary: "Comentário adicionado à issue",
        metadata: knowledgeContextMetadata(result.issue),
      });
      res.status(201).json(result);
    }),
  );
}
