import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  deleteDeployment,
  getDeployment,
} from "../../../repositories/deployments/index.js";
import {
  sendNotFound,
  scopedApplicationEntity,
  auditMutation,
  asyncHandler,
} from "../helpers.js";

const parameter = "deploymentId";

const permission = "deployments.archive";

const type = "deployment";

const getter = getDeployment;

const remove = deleteDeployment;

export function registerDeleteDeploymentsPermanent(router) {
  router.delete(
    "/deployments/:deploymentId/permanent",
    requireAllPermissions(permission),
    asyncHandler(async (req, res) => {
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
