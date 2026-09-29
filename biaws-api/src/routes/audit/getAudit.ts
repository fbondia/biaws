import type { Router, Request, Response, NextFunction } from "express";
import { authorizationQuery } from "../../auth/authorizationMiddleware.js";
import { listAuditEvents } from "../../repositories/audit/index.js";
import { resolveAuditReference } from "../../repositories/shared/references.js";
import { readPermissionByType, authorizeAuditRead } from "./helpers.js";

export function registerGetAudit(router: Router) {
  router.get(
    "/:entityType/:entityId",
    authorizeAuditRead,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const entityType = String(
          req.params.entityType,
        ) as keyof typeof readPermissionByType;
        const query = authorizationQuery(
          req.actor,
          readPermissionByType[entityType],
          req.query,
        );
        const entityId = await resolveAuditReference(
          entityType,
          String(req.params.entityId),
          query,
        );
        res.json({
          events: await listAuditEvents(entityType, entityId, query),
        });
      } catch (error) {
        next(error);
      }
    },
  );
}
