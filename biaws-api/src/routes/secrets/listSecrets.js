import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { listAccessibleSecrets } from "../../services/secretsService.js";
import { asyncHandler } from "./helpers.js";

export function registerListSecrets(router) {
  router.get(
    "/",
    requireAllPermissions("secrets.metadata.read"),
    asyncHandler(async (req, res) => {
      res.json(await listAccessibleSecrets(req.query, req.actor));
    }),
  );
}
