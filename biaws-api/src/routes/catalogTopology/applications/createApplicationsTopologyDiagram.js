import {
  requireAllPermissions,
  requireApplicationAccess,
} from "../../../auth/authorizationMiddleware.js";
import { createTopologyDiagram } from "../../../repositories/topologyDiagrams/index.js";
import { auditMutation, asyncHandler } from "../helpers.js";

export function registerCreateApplicationsTopologyDiagram(router) {
  router.post(
    "/applications/:applicationId/topology-diagrams",
    requireAllPermissions("applications.update"),
    requireApplicationAccess("applications.update"),
    asyncHandler(async (req, res) => {
      const diagram = await createTopologyDiagram(
        req.params.applicationId,
        req.body,
        req.actor,
      );
      await auditMutation({
        req,
        type: "topology-diagram",
        action: "created",
        after: diagram,
      });
      res.status(201).json({ diagram });
    }),
  );
}
