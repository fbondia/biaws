import type { Router, Request, Response } from "express";
import {
  actorCanAccessApplication,
  requireAllPermissions,
} from "../../../auth/authorizationMiddleware.js";
import {
  getRepository,
  listRepositoryComponents,
} from "../../../repositories/repositories/index.js";
import {
  sendNotFound,
  scopedApplicationEntity,
  asyncHandler,
} from "../helpers.js";

export function registerListRepositoriesComponents(router: Router) {
  router.get(
    "/repositories/:repositoryId/components",
    requireAllPermissions("repositories.read", "components.read"),
    asyncHandler(async (req: Request, res: Response) => {
      const repository = await scopedApplicationEntity(
        req,
        "repositories.read",
        getRepository,
        req.params.repositoryId,
      );
      if (
        !repository ||
        !actorCanAccessApplication(
          req.actor,
          "components.read",
          repository.applicationId,
        )
      ) {
        return sendNotFound(res, "repository");
      }
      res.json(
        await listRepositoryComponents(req.params.repositoryId, req.query),
      );
    }),
  );
}
