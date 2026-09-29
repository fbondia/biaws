import { recordAuditEvent } from "../../repositories/audit/index.js";
import { updateResourceCollection } from "../../repositories/resourceCollections/index.js";
import { asyncHandler } from "../shared/asyncHandler.js";
import { authorize, query } from "./helpers.js";

export function registerUpdateResourceCollection(router) {
  router.patch(
    "/:resourceType/:collectionId",
    authorize("manage", { workspace: true }),
    asyncHandler(async (req, res) => {
      const result = await updateResourceCollection(
        req.params.resourceType,
        req.params.collectionId,
        { ...req.body, updatedBy: req.actor.email || req.actor.userId },
        query(req, "manage"),
      );
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
