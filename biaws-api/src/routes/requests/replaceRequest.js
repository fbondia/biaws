import {
  getRequest,
  updateRequest,
} from "../../repositories/requests/index.js";
import { requireBodyFieldPermissions } from "../../auth/authorizationMiddleware.js";
import { scopedQuery, auditDemand, asyncHandler } from "./helpers.js";

export function registerReplaceRequest(router) {
  router.put(
    "/:id",
    requireBodyFieldPermissions(
      { specification: "demands.specification.update" },
      "demands.update",
    ),
    asyncHandler(async (req, res) => {
      const query = scopedQuery(req, "demands.update");
      const before = (await getRequest(req.params.id, query)).request;
      const result = await updateRequest(
        req.params.id,
        { ...req.body, updatedBy: req.actor.email || req.actor.userId },
        query,
      );
      await auditDemand({
        req,
        action: "updated",
        summary: "Melhoria atualizada",
        before,
        after: result.request,
      });
      res.json(result);
    }),
  );
}
