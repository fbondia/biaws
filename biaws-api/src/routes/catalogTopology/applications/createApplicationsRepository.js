import {
  requireAllPermissions,
  requireApplicationAccess,
} from "../../../auth/authorizationMiddleware.js";
import { createRepository } from "../../../repositories/repositories/index.js";
import { auditMutation, asyncHandler } from "../helpers.js";

export function registerCreateApplicationsRepository(router) {
  router.post(
    "/applications/:applicationId/repositories",
    requireAllPermissions("repositories.create"),
    requireApplicationAccess("repositories.create"),
    asyncHandler(async (req, res) => {
      const repository = await createRepository(
        req.params.applicationId,
        req.body,
        req.actor,
      );
      await auditMutation({
        req,
        type: "repository",
        action: "created",
        after: repository,
      });
      res.status(201).json({ repository });
    }),
  );
}
