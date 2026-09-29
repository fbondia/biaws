import { authorizationQuery } from "../../auth/authorizationMiddleware.js";
import { listAuditEvents } from "../../repositories/audit/index.js";
import { resolveAuditReference } from "../../repositories/shared/references.js";
import { readPermissionByType, authorizeAuditRead } from "./helpers.js";

export function registerGetAudit(router) {
  router.get(
    "/:entityType/:entityId",
    authorizeAuditRead,
    async (req, res, next) => {
      try {
        const query = authorizationQuery(
          req.actor,
          readPermissionByType[req.params.entityType],
          req.query,
        );
        req.params.entityId = await resolveAuditReference(
          req.params.entityType,
          req.params.entityId,
          query,
        );
        res.json({
          events: await listAuditEvents(
            req.params.entityType,
            req.params.entityId,
            query,
          ),
        });
      } catch (error) {
        next(error);
      }
    },
  );
}
