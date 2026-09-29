import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { getAccessibleSecret } from "../../services/secretsService.js";
import { asyncHandler } from "./helpers.js";

export function registerGetSecret(router) {
  router.get(
    "/:secretId",
    requireAllPermissions("secrets.metadata.read"),
    asyncHandler(async (req, res) => {
      res.json({
        secret: await getAccessibleSecret(req.params.secretId, req.actor),
      });
    }),
  );
}
