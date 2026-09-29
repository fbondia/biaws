import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { getIntegration } from "../../../repositories/integrations/index.js";
import {
  sendNotFound,
  scopedApplicationEntity,
  asyncHandler,
} from "../helpers.js";

export function registerGetIntegration(router) {
  router.get(
    "/integrations/:integrationId",
    requireAllPermissions("integrations.read"),
    asyncHandler(async (req, res) => {
      const integration = await scopedApplicationEntity(
        req,
        "integrations.read",
        getIntegration,
        req.params.integrationId,
      );
      if (!integration) return sendNotFound(res, "integration");
      res.json({ integration });
    }),
  );
}
