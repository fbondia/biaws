import type { Router, Request, Response } from "express";
import { recordAuditEvent } from "../../repositories/audit/index.js";
import { deleteResourceCollection } from "../../repositories/resourceCollections/index.js";
import { asyncHandler } from "../shared/asyncHandler.js";
import { authorize, query } from "./helpers.js";

export function registerDeleteResourceCollection(router: Router) {
  router.delete(
    "/:resourceType/:collectionId",
    authorize("manage", { workspace: true }),
    asyncHandler(async (req: Request, res: Response) => {
      const result = await deleteResourceCollection(
        req.params.resourceType,
        req.params.collectionId,
        query(req, "manage"),
      );
      await recordAuditEvent({
        actor: req.actor,
        action: "deleted",
        target: {
          type: `${req.params.resourceType}_collection`,
          id: result.collection.id,
          label: result.collection.name,
        },
        before: result.collection,
        summary: `Coleção de ${req.params.resourceType} excluída`,
      });
      res.json(result);
    }),
  );
}
