import type { Request, Response } from "express";
import { recordAuditEvent } from "../../repositories/audit/index.js";
import { getWorkspace, setWorkspaceStatus } from "../../repositories/catalog/workspaces/platform.js";

export async function changeWorkspaceStatus(req: Request, res: Response, status: string) {
  const before = await getWorkspace(req.params.workspaceId);
  if (status === "archived" && String(req.body.confirmation || "") !== before?.name) {
    res.status(422).json({
      error: {
        code: "WORKSPACE_CONFIRMATION_REQUIRED",
        message: "Type the workspace name to confirm archiving",
      },
    });
    return;
  }
  const workspace = await setWorkspaceStatus(req.params.workspaceId, status, req.actor);
  if (!workspace) throw new Error("Updated workspace could not be read");
  await recordAuditEvent({
    actor: req.actor,
    action: status === "archived" ? "archived" : "reactivated",
    target: { type: "workspace", id: workspace.id, label: workspace.name },
    before,
    after: workspace,
    metadata: { workspaceId: workspace.id, platform: true },
    summary:
      status === "archived" ? `Workspace arquivado: ${workspace.name}` : `Workspace reativado: ${workspace.name}`,
  });
  res.json({ workspace });
}
