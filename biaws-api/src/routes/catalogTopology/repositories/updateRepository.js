import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  getRepository,
  updateRepository,
} from "../../../repositories/repositories/index.js";
import {
  sendNotFound,
  scopedApplicationEntity,
  auditMutation,
  asyncHandler,
} from "../helpers.js";

export function registerUpdateRepository(router) {
  router.patch(
    "/repositories/:repositoryId",
    requireAllPermissions("repositories.update"),
    asyncHandler(async (req, res) => {
      const before = await scopedApplicationEntity(
        req,
        "repositories.update",
        getRepository,
        req.params.repositoryId,
      );
      if (!before) return sendNotFound(res, "repository");
      const after = await updateRepository(
        req.params.repositoryId,
        req.body,
        req.actor,
      );
      await auditMutation({
        req,
        type: "repository",
        action: "updated",
        before,
        after,
      });
      res.json({ repository: after });
    }),
  );
}
