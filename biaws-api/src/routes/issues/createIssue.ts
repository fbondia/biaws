import type { Router, Request, Response } from "express";
import { createIssue } from "../../repositories/issues/index.js";
import { authorizationQuery, requireBodyFieldPermissions } from "../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../repositories/audit/index.js";
import { knowledgeContextMetadata } from "../../repositories/shared/knowledgeContext.js";
import { asyncHandler } from "./helpers.js";

export function registerCreateIssue(router: Router) {
  router.post(
    "/",
    requireBodyFieldPermissions({ comment: "issues.comment.create" }, "issues.create"),
    asyncHandler(async (req: Request, res: Response) => {
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
        if (!comment) throw new Error("Created comment could not be read");
        await recordAuditEvent({
          actor: req.actor,
          action: "comment_added",
          target: { type: "comment", id: comment._id },
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
