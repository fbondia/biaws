import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { listRuntimeMonitoringTimeline } from "../../../repositories/monitoring/events/index.js";
import {
  scopedRuntime,
  sendRuntimeNotFound,
  asyncHandler,
} from "../helpers.js";

export function registerListRuntimesTimeline(router) {
  router.get(
    "/runtimes/:runtimeReference/timeline",
    requireAllPermissions("runtimes.read"),
    asyncHandler(async (req, res) => {
      const runtime = await scopedRuntime(req, "runtimes.read");
      if (!runtime) return sendRuntimeNotFound(res);
      res.json(
        await listRuntimeMonitoringTimeline(runtime.id, {
          ...req.query,
          workspaceId: req.actor.workspaceId,
        }),
      );
    }),
  );
}
