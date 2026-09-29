import type { Router, Request, Response } from "express";
import { recordAuditEvent } from "../../repositories/audit/index.js";
import { updateResourceCollection } from "../../repositories/resourceCollections/index.js";
import { asyncHandler } from "../shared/asyncHandler.js";
import { authorize, query } from "./helpers.js";

export function registerUpdateResourceCollection(router: Router) {
  router.patch(
    "/:resourceType/:collectionId",
    authorize("manage", { workspace: true }),
    asyncHandler(async (req: Request, res: Response) => {
      const result = await updateResourceCollection(
        req.params.resourceType,
        req.params.collectionId,
        { ...req.body, updatedBy: req.actor.email || req.actor.userId },
        query(req, "manage"),
      );
      if (!result.collection) {
        res.status(404).json({
          error: {
            code: "COLLECTION_NOT_FOUND",
            message: "Collection not found",
          },
        });
        return;
      }
      await recordAuditEvent({
        actor: req.actor,
        action: "updated",
        target: {
          type: `${req.params.resourceType}_collection`,
          id: result.collection.id,
          label: result.collection.name,
        },
        after: result.collection,
        summary: `Coleção de ${req.params.resourceType} atualizada`,
      });
      res.json(result);
    }),
  );
}
