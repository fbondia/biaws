import type { Router, Request, Response } from "express";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import { setWorkspaceMemberGroups } from "../../../repositories/catalog/workspaces/platform.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export function registerReplaceWorkspacesMember(router: Router) {
  router.put(
    "/workspaces/:workspaceId/members/:userId",
    asyncHandler(async (req: Request, res: Response) => {
      const access = await setWorkspaceMemberGroups(
        req.params.workspaceId,
        req.params.userId,
        req.body.groupIds,
        req.actor,
      );
      await recordAuditEvent({
        actor: req.actor,
        action: "membership.updated",
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
        after: access,
        metadata: { workspaceId: req.params.workspaceId, platform: true },
        summary: "Vínculo de usuário atualizado",
      });
      res.json({ access });
    }),
  );
}
