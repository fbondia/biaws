import { recordAuditEvent } from "../../../repositories/audit/index.js";
import {
  getWorkspace,
  updateWorkspace,
} from "../../../repositories/catalog/workspaces/platform.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export function registerUpdateWorkspace(router) {
  router.patch(
    "/workspaces/:workspaceId",
    asyncHandler(async (req, res) => {
      const before = await getWorkspace(req.params.workspaceId);
      const workspace = await updateWorkspace(
        req.params.workspaceId,
        req.body,
        req.actor,
      );
      await recordAuditEvent({
        actor: req.actor,
        action: "updated",
        target: { type: "workspace", id: workspace.id, label: workspace.name },
        before,
        after: workspace,
        metadata: { workspaceId: workspace.id, platform: true },
        summary: `Workspace alterado: ${workspace.name}`,
      });
      res.json({ workspace });
    }),
  );
}
