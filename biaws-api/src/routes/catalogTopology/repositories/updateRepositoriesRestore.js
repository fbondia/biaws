import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  getRepository,
  restoreRepository,
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

const response = "repository";

const getter = getRepository;

const restore = restoreRepository;

export function registerUpdateRepositoriesRestore(router) {
  router.patch(
    "/repositories/:repositoryId/restore",
    requireAllPermissions(permission),
    asyncHandler(async (req, res) => {
      const id = req.params[parameter];
      const before = await scopedApplicationEntity(req, permission, getter, id);
      if (!before) return sendNotFound(res, type);
      const after = await restore(id, req.actor);
      if (before.status !== after.status) {
        await auditMutation({ req, type, action: "restored", before, after });
      }
      res.json({ [response]: after });
    }),
  );
}
