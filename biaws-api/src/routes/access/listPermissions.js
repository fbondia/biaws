import { PERMISSION_CATALOG } from "../../../../shared/index.js";
import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";

export function registerListPermissions(router) {
  router.get(
    "/permissions",
    requireAllPermissions("roles.read"),
    (req, res) => {
      res.json({ permissions: PERMISSION_CATALOG });
    },
  );
}
