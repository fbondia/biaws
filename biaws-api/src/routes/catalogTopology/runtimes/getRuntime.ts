import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { getRuntime } from "../../../repositories/deployments/index.js";
import { sendNotFound, scopedApplicationEntity, asyncHandler } from "../helpers.js";

export function registerGetRuntime(router: Router) {
  router.get(
    "/runtimes/:runtimeId",
    requireAllPermissions("runtimes.read"),
    asyncHandler(async (req: Request, res: Response) => {
      const runtime = await scopedApplicationEntity(req, "runtimes.read", getRuntime, req.params.runtimeId);
      if (!runtime) return sendNotFound(res, "runtime");
      res.json({ runtime });
    }),
  );
}
