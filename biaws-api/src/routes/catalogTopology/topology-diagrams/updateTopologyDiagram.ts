import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { getTopologyDiagram, updateTopologyDiagram } from "../../../repositories/topologyDiagrams/index.js";
import { sendNotFound, scopedApplicationEntity, auditMutation, asyncHandler } from "../helpers.js";

export function registerUpdateTopologyDiagram(router: Router) {
  router.patch(
    "/topology-diagrams/:diagramId",
    requireAllPermissions("applications.update"),
    asyncHandler(async (req: Request, res: Response) => {
      const before = await scopedApplicationEntity(
        req,
        "applications.update",
        getTopologyDiagram,
        req.params.diagramId,
      );
      if (!before) return sendNotFound(res, "topology-diagram");
      const after = await updateTopologyDiagram(req.params.diagramId, req.body, req.actor);
      if (!after) throw new Error("Mutation result is unavailable");
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
