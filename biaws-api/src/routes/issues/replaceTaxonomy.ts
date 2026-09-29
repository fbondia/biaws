import type { Router, Request, Response } from "express";
import {
  getIssueTaxonomy,
  saveIssueTaxonomy,
} from "../../repositories/issues/taxonomy.js";
import {
  authorizationQuery,
  requireAllPermissions,
} from "../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../repositories/audit/index.js";
import { asyncHandler } from "./helpers.js";

export function registerReplaceTaxonomy(router: Router) {
  router.put(
    "/taxonomy",
    requireAllPermissions("taxonomy.manage"),
    asyncHandler(async (req: Request, res: Response) => {
      const query = authorizationQuery(req.actor, "taxonomy.manage", req.query);
      const before = (await getIssueTaxonomy(query)).taxonomy;
      const result = await saveIssueTaxonomy(
        { ...req.body, updatedBy: req.actor.email || req.actor.userId },
        query,
      );
      await recordAuditEvent({
        actor: req.actor,
        action: before ? "updated" : "created",
        target: { type: "taxonomy", id: "biaws", label: "Taxonomia de issues" },
        before,
        after: result.taxonomy,
        summary: "Taxonomia atualizada",
      });
      res.json(result);
    }),
  );
}
