import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  getTopologyDiagram,
  updateTopologyDiagram,
} from "../../../repositories/topologyDiagrams/index.js";
import {
  sendNotFound,
  scopedApplicationEntity,
  auditMutation,
  asyncHandler,
} from "../helpers.js";

export function registerUpdateTopologyDiagram(router) {
  router.patch(
    "/topology-diagrams/:diagramId",
    requireAllPermissions("applications.update"),
    asyncHandler(async (req, res) => {
      const before = await scopedApplicationEntity(
        req,
        "applications.update",
        getTopologyDiagram,
        req.params.diagramId,
      );
      if (!before) return sendNotFound(res, "topology-diagram");
      const after = await updateTopologyDiagram(
        req.params.diagramId,
        req.body,
        req.actor,
      );
      await auditMutation({
        req,
        type: "topology-diagram",
        action: "updated",
        before,
        after,
      });
      res.json({ diagram: after });
    }),
  );
}
