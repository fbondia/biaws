import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  archiveRuntime,
  getRuntime,
} from "../../../repositories/deployments/index.js";
import {
  sendNotFound,
  scopedApplicationEntity,
  auditMutation,
  asyncHandler,
} from "../helpers.js";

export function registerUpdateRuntimesArchive(router) {
  router.patch(
    "/runtimes/:runtimeId/archive",
    requireAllPermissions("runtimes.archive"),
    asyncHandler(async (req, res) => {
      const before = await scopedApplicationEntity(
        req,
        "runtimes.archive",
        getRuntime,
        req.params.runtimeId,
      );
      if (!before) return sendNotFound(res, "runtime");
      const after = await archiveRuntime(req.params.runtimeId, req.actor);
      if (before.status !== after.status) {
        await auditMutation({
          req,
          type: "runtime",
          action: "archived",
          before,
          after,
        });
      }
      res.json({ runtime: after });
    }),
  );
}
