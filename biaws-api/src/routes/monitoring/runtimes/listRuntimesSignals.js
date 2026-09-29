import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { listRuntimeMonitoringSignals } from "../../../repositories/monitoring/events/index.js";
import {
  scopedRuntime,
  sendRuntimeNotFound,
  asyncHandler,
} from "../helpers.js";

export function registerListRuntimesSignals(router) {
  router.get(
    "/runtimes/:runtimeReference/signals",
    requireAllPermissions("runtimes.read"),
    asyncHandler(async (req, res) => {
      const runtime = await scopedRuntime(req, "runtimes.read");
      if (!runtime) return sendRuntimeNotFound(res);
      res.json(
        await listRuntimeMonitoringSignals(runtime.id, {
          ...req.query,
          workspaceId: req.actor.workspaceId,
        }),
      );
    }),
  );
}
