import type { Router, Request, Response } from "express";
import { getIssue, updateIssue } from "../../repositories/issues/index.js";
import {
  authorizationQuery,
  requireBodyFieldPermissions,
} from "../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../repositories/audit/index.js";
import { knowledgeContextMetadata } from "../../repositories/shared/knowledgeContext.js";
import { asyncHandler } from "./helpers.js";

export function registerUpdateIssue(router: Router) {
  router.patch(
    "/:id",
    requireBodyFieldPermissions(
      { status: "issues.status.update", type: "issues.update" },
      "issues.update",
    ),
    asyncHandler(async (req: Request, res: Response) => {
      const scopePermission = Object.keys(req.body || {}).some(
        (field: string) => field !== "status",
      )
        ? "issues.update"
        : "issues.status.update";
      const scopedQuery = authorizationQuery(
        req.actor,
        scopePermission,
        req.query,
      );
      const before = (await getIssue(req.params.id, scopedQuery)).issue;
      const result = await updateIssue(
        req.params.id,
        { ...req.body, updatedBy: req.actor.email || req.actor.userId },
        scopedQuery,
      );
      await recordAuditEvent({
        actor: req.actor,
        action: Object.hasOwn(req.body, "status")
          ? "status_changed"
          : "updated",
        target: {
          type: "issue",
          id: req.params.id,
          label: result.issue?.title,
        },
        before,
        after: result.issue,
        summary: "Issue atualizada",
        metadata: knowledgeContextMetadata(result.issue),
      });
      res.json(result);
    }),
  );
}
