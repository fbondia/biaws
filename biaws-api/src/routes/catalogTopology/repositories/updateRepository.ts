import type { Router, Request, Response } from "express";
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

export function registerUpdateRepository(router: Router) {
  router.patch(
    "/repositories/:repositoryId",
    requireAllPermissions("repositories.update"),
    asyncHandler(async (req: Request, res: Response) => {
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
      if (!after) throw new Error("Mutation result is unavailable");
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
