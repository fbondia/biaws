import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { getRuntime, updateRuntime } from "../../../repositories/deployments/index.js";
import { recalculateRuntimeMonitoringExpiration } from "../../../repositories/monitoring/events/index.js";
import { sendNotFound, scopedApplicationEntity, auditMutation, asyncHandler } from "../helpers.js";

export function registerUpdateRuntime(router: Router) {
  router.patch(
    "/runtimes/:runtimeId",
    requireAllPermissions("runtimes.update"),
    asyncHandler(async (req: Request, res: Response) => {
      const before = await scopedApplicationEntity(req, "runtimes.update", getRuntime, req.params.runtimeId);
      if (!before) return sendNotFound(res, "runtime");
      const after = await updateRuntime(req.params.runtimeId, req.body, req.actor);
      if (!after) throw new Error("Mutation result is unavailable");
      if (before.monitoringRetentionDays !== after.monitoringRetentionDays) {
        await recalculateRuntimeMonitoringExpiration(after.id, after.monitoringRetentionDays, {
          workspaceId: req.actor.workspaceId ?? undefined,
        });
      }
      await auditMutation({
        req,
        type: "runtime",
        action: "updated",
        before,
        after,
      });
      res.json({ runtime: after });
    }),
  );
}
