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

export function registerReplaceTaxonomy(router) {
  router.put(
    "/taxonomy",
    requireAllPermissions("taxonomy.manage"),
    asyncHandler(async (req, res) => {
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
