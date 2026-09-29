import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { archiveRepository, getRepository } from "../../../repositories/repositories/index.js";
import { sendNotFound, scopedApplicationEntity, auditMutation, asyncHandler } from "../helpers.js";

export function registerUpdateRepositoriesArchive(router: Router) {
  router.patch(
    "/repositories/:repositoryId/archive",
    requireAllPermissions("repositories.archive"),
    asyncHandler(async (req: Request, res: Response) => {
      const before = await scopedApplicationEntity(req, "repositories.archive", getRepository, req.params.repositoryId);
      if (!before) return sendNotFound(res, "repository");
      const after = await archiveRepository(req.params.repositoryId, req.actor);
      if (!after) throw new Error("Mutation result is unavailable");
      if (before.status !== after.status) {
        await auditMutation({
          req,
          type: "repository",
          action: "archived",
          before,
          after,
        });
      }
      res.json({ repository: after });
    }),
  );
}
