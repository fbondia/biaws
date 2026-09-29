import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { getTopologyDiagram } from "../../../repositories/topologyDiagrams/index.js";
import {
  sendNotFound,
  scopedApplicationEntity,
  asyncHandler,
} from "../helpers.js";

export function registerGetTopologyDiagram(router) {
  router.get(
    "/topology-diagrams/:diagramId",
    requireAllPermissions("applications.read"),
    asyncHandler(async (req, res) => {
      const diagram = await scopedApplicationEntity(
        req,
        "applications.read",
        getTopologyDiagram,
        req.params.diagramId,
      );
      if (!diagram) return sendNotFound(res, "topology-diagram");
      res.json({ diagram });
    }),
  );
}
