import {
  getRequest,
  reorderRequest,
} from "../../../repositories/requests/index.js";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { scopedQuery, auditDemand, asyncHandler } from "../helpers.js";

export function registerUpdateOrder(router) {
  router.patch(
    "/:id/order",
    requireAllPermissions("demands.reorder"),
    asyncHandler(async (req, res) => {
      const query = scopedQuery(req, "demands.reorder");
      const before = (await getRequest(req.params.id, query)).request;
      const result = await reorderRequest(req.params.id, req.body, query);
      await auditDemand({
        req,
        action: "reordered",
        summary: "Melhoria reordenada",
        before,
        after: result.request,
      });
      res.json(result);
    }),
  );
}
