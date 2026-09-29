import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  deleteRepository,
  getRepository,
} from "../../../repositories/repositories/index.js";
import {
  sendNotFound,
  scopedApplicationEntity,
  auditMutation,
  asyncHandler,
} from "../helpers.js";

const parameter = "repositoryId";

const permission = "repositories.archive";

const type = "repository";

const getter = getRepository;

const remove = deleteRepository;

export function registerDeleteRepositoriesPermanent(router: Router) {
  router.delete(
    "/repositories/:repositoryId/permanent",
    requireAllPermissions(permission),
    asyncHandler(async (req: Request, res: Response) => {
      const id = req.params[parameter];
      const before = await scopedApplicationEntity(req, permission, getter, id);
      if (!before) return sendNotFound(res, type);
      await remove(id);
      await auditMutation({
        req,
        type,
        action: "deleted",
        before,
        after: null,
      });
      res.json({ deleted: true, id: before.id });
    }),
  );
}
