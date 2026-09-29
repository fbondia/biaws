import { recordAuditEvent } from "../../repositories/audit/index.js";
import { provisionWorkspace } from "../../repositories/catalog/workspaces/platform.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export function registerCreateWorkspace(router) {
  router.post(
    "/workspaces",
    asyncHandler(async (req, res) => {
      const result = await provisionWorkspace(req.body, req.actor);
      await recordAuditEvent({
        actor: req.actor,
        action: "created",
        target: {
          type: "workspace",
          id: result.workspace.id,
          label: result.workspace.name,
        },
        after: result.workspace,
        metadata: { workspaceId: result.workspace.id, platform: true },
        summary: `Workspace criado: ${result.workspace.name}`,
      });
      res.status(201).json(result);
    }),
  );
}
