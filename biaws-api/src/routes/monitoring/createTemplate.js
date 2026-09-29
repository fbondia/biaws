import {
  requireAllPermissions,
  requireWorkspaceScope,
} from "../../auth/authorizationMiddleware.js";
import { createMonitoringTemplate } from "../../repositories/monitoring/templates/index.js";
import { auditTemplateMutation, asyncHandler } from "./helpers.js";

export function registerCreateTemplate(router) {
  router.post(
    "/templates",
    requireAllPermissions("runtimes.update"),
    requireWorkspaceScope("runtimes.update"),
    asyncHandler(async (req, res) => {
      const template = await createMonitoringTemplate(req.body, req.actor);
      await auditTemplateMutation({ req, action: "created", after: template });
      res.status(201).json({ template });
    }),
  );
}
