import type { Router, Request, Response } from "express";
import { recordAuditEvent } from "../../repositories/audit/index.js";
import { createResourceCollection } from "../../repositories/resourceCollections/index.js";
import { asyncHandler } from "../shared/asyncHandler.js";
import { authorize, query } from "./helpers.js";

export function registerCreateResourceCollection(router: Router) {
  router.post(
    "/:resourceType",
    authorize("manage", { workspace: true }),
    asyncHandler(async (req: Request, res: Response) => {
      const result = await createResourceCollection(
        req.params.resourceType,
        { ...req.body, createdBy: req.actor.email || req.actor.userId },
        query(req, "manage"),
      );
      await recordAuditEvent({
        actor: req.actor,
        action: "created",
        target: {
          type: `${req.params.resourceType}_collection`,
          id: result.collection.id,
          label: result.collection.name,
        },
        after: result.collection,
        summary: `Coleção de ${req.params.resourceType} criada`,
      });
      res.status(201).json(result);
    }),
  );
}
