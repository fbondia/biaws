import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { listRuntimeActiveMonitors } from "../../../repositories/monitoring/activeMonitors/index.js";
import {
  scopedRuntime,
  sendRuntimeNotFound,
  asyncHandler,
} from "../helpers.js";

export function registerListRuntimesActiveMonitors(router: Router) {
  router.get(
    "/runtimes/:runtimeReference/active-monitors",
    requireAllPermissions("runtimes.read"),
    asyncHandler(async (req: Request, res: Response) => {
      const runtime = await scopedRuntime(req, "runtimes.read");
      if (!runtime) return sendRuntimeNotFound(res);
      res.json(
        await listRuntimeActiveMonitors(runtime.id, {
          ...req.query,
          workspaceId: req.actor.workspaceId ?? undefined,
        }),
      );
    }),
  );
}
