import { createRequest } from "../../repositories/requests/index.js";
import { requireBodyFieldPermissions } from "../../auth/authorizationMiddleware.js";
import { scopedQuery, auditDemand, asyncHandler } from "./helpers.js";

export function registerCreateRequest(router) {
  router.post(
    "/",
    requireBodyFieldPermissions(
      { specification: "demands.specification.update" },
      "demands.create",
    ),
    asyncHandler(async (req, res) => {
      const result = await createRequest(
        { ...req.body, createdBy: req.actor.email || req.actor.userId },
        scopedQuery(req, "demands.create"),
      );
      await auditDemand({
        req,
        action: "created",
        summary: "Melhoria criada",
        after: result.request,
      });
      res.status(201).json(result);
    }),
  );
}
