import type { Router, Request, Response } from "express";
import {
  getIssue,
  updateIssueComment,
} from "../../../repositories/issues/index.js";
import {
  authorizationQuery,
  requireAllPermissions,
} from "../../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import { knowledgeContextMetadata } from "../../../repositories/shared/knowledgeContext.js";
import { asyncHandler } from "../helpers.js";

export function registerReplaceComment(router: Router) {
  router.put(
    "/:id/comments/:commentId",
    requireAllPermissions("issues.comment.update"),
    asyncHandler(async (req: Request, res: Response) => {
      const query = authorizationQuery(
        req.actor,
        "issues.comment.update",
        req.query,
      );
      const beforeResult = await getIssue(req.params.id, query);
      const before = beforeResult.comments.find(
        (comment) => String(comment._id) === req.params.commentId,
      );
      const result = await updateIssueComment(
        req.params.id,
        req.params.commentId,
        { ...req.body, updatedBy: req.actor.email || req.actor.userId },
        query,
      );
      const after = result.comments.find(
        (comment) => String(comment._id) === req.params.commentId,
      );
      await recordAuditEvent({
        actor: req.actor,
        action: "comment_updated",
        target: { type: "comment", id: req.params.commentId },
        root: { type: "issue", id: req.params.id },
        before,
        after,
        summary: "Comentário da issue atualizado",
        metadata: knowledgeContextMetadata(result.issue),
      });
      res.json(result);
    }),
  );
}
