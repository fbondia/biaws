import type { Request, Response, Router } from "express";

import { authorizationQuery, requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../repositories/audit/index.js";
import { transferTaxonomyReferences } from "../../repositories/issues/taxonomyTransfer.js";
import { asyncHandler } from "./helpers.js";

export function registerTransferTaxonomy(router: Router) {
  router.post(
    "/taxonomy/transfer",
    requireAllPermissions("taxonomy.manage"),
    asyncHandler(async (req: Request, res: Response) => {
      const result = await transferTaxonomyReferences(
        { ...req.body, updatedBy: req.actor.email || req.actor.userId },
        authorizationQuery(req.actor, "taxonomy.manage", req.query),
      );
      await recordAuditEvent({
        actor: req.actor,
        action: "updated",
        target: { type: "taxonomy", id: "biaws", label: "Taxonomia de issues e documentos" },
        before: { sourceTaxonomyId: result.transfer.sourceTaxonomyId },
        after: result.transfer,
        summary: `Vínculos de taxonomia transferidos para ${result.transfer.destinationTaxonomyId}`,
      });
      res.json(result);
    }),
  );
}
