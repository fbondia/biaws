import type { Router, Request, Response } from "express";
import {
  deleteRequest,
  getRequest,
} from "../../repositories/requests/index.js";
import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { scopedQuery, auditDemand, asyncHandler } from "./helpers.js";

export function registerDeleteRequest(router: Router) {
  router.delete(
    "/:id",
    requireAllPermissions("demands.delete"),
    asyncHandler(async (req: Request, res: Response) => {
      const query = scopedQuery(req, "demands.delete");
      const before = (await getRequest(req.params.id, query)).request;
      const result = await deleteRequest(req.params.id, query);
      await auditDemand({
        req,
        action: "deleted",
        summary: "Melhoria excluída",
        before,
        after: null,
      });
      res.json(result);
    }),
  );
}
