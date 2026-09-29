import type { Router, Request, Response } from "express";
import {
  getRequest,
  moveRequestToCollection,
} from "../../../repositories/requests/index.js";
import { assertResourceCollection } from "../../../repositories/resourceCollections/index.js";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { scopedQuery, auditDemand, asyncHandler } from "../helpers.js";

export function registerUpdateCollection(router: Router) {
  router.patch(
    "/:id/collection",
    requireAllPermissions("demands.update"),
    asyncHandler(async (req: Request, res: Response) => {
      const query = scopedQuery(req, "demands.update");
      const before = (await getRequest(req.params.id, query)).request;
      const collectionId = await assertResourceCollection(
        "demands",
        req.body?.collectionId,
        req.actor.workspaceId,
        query,
      );
      const result = await moveRequestToCollection(
        req.params.id,
        collectionId,
        query,
      );
      await auditDemand({
        req,
        action: "updated",
        summary: "Melhoria movida entre coleções",
        before,
        after: result.request,
      });
      res.json(result);
    }),
  );
}
