import type { Router, Request, Response } from "express";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import { removeWorkspaceMember } from "../../../repositories/catalog/workspaces/platform.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export function registerDeleteWorkspacesMember(router: Router) {
  router.delete(
    "/workspaces/:workspaceId/members/:userId",
    asyncHandler(async (req: Request, res: Response) => {
      const result = await removeWorkspaceMember(req.params.workspaceId, req.params.userId);
      await recordAuditEvent({
        actor: req.actor,
        action: "membership.removed",
        target: {
          type: "workspace-member",
          id: req.params.userId,
          label: String(req.params.userId),
        },
        root: {
          type: "workspace",
          id: req.params.workspaceId,
          label: String(req.params.workspaceId),
        },
        metadata: { workspaceId: req.params.workspaceId, platform: true },
        summary: "Usuário removido do workspace",
      });
      res.json(result);
    }),
  );
}
