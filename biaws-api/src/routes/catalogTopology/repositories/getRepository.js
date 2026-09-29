import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { getRepository } from "../../../repositories/repositories/index.js";
import {
  sendNotFound,
  scopedApplicationEntity,
  asyncHandler,
} from "../helpers.js";

export function registerGetRepository(router) {
  router.get(
    "/repositories/:repositoryId",
    requireAllPermissions("repositories.read"),
    asyncHandler(async (req, res) => {
      const repository = await scopedApplicationEntity(
        req,
        "repositories.read",
        getRepository,
        req.params.repositoryId,
      );
      if (!repository) return sendNotFound(res, "repository");
      res.json({ repository });
    }),
  );
}
