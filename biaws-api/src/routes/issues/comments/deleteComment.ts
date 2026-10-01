import type { Router, Request, Response } from "express";
import { deleteIssueComment, getIssue } from "../../../repositories/issues/index.js";
import { authorizationQuery, requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import { knowledgeContextMetadata } from "../../../repositories/shared/knowledgeContext.js";
import { asyncHandler } from "../helpers.js";

export function registerDeleteComment(router: Router) {
  router.delete(
    "/:id/comments/:commentId",
    requireAllPermissions("issues.comment.delete"),
    asyncHandler(async (req: Request, res: Response) => {
      const query = authorizationQuery(req.actor, "issues.comment.delete", req.query);
      const beforeResult = await getIssue(req.params.id, query);
      const before = beforeResult.comments.find((comment) => String(comment._id) === req.params.commentId);
      const result = await deleteIssueComment(
        req.params.id,
        req.params.commentId,
        { deletedBy: req.actor.email || req.actor.userId },
        query,
      );
      await recordAuditEvent({
        actor: req.actor,
        action: "comment_deleted",
        target: { type: "comment", id: req.params.commentId },
        root: { type: "issue", id: req.params.id },
        before,
        after: null,
        summary: "Comentário da issue excluído",
        metadata: knowledgeContextMetadata(result.issue),
      });
      res.json(result);
    }),
  );
}
