import { Router } from "express";

import {
  authorizationQuery,
  requireAllPermissions,
} from "../auth/authorizationMiddleware.js";
import { listAuditEvents } from "../repositories/auditRepository.js";

export const auditRouter = Router();

const readPermissionByType = {
  issue: "issues.read",
  demand: "demands.read",
  task: "demands.read",
  procedure: "procedures.read",
  business_rule: "business_rules.read",
  architecture_decision: "architecture_decisions.read",
  taxonomy: "taxonomy.read",
  skill: "skills.read",
  application: "applications.read",
  workspace: "workspaces.read",
  component: "components.read",
  integration: "integrations.read",
  repository: "repositories.read",
  server: "servers.read",
  deployment: "deployments.read",
  runtime: "runtimes.read",
};

function authorizeAuditRead(req, res, next) {
  const permission = readPermissionByType[req.params.entityType];
  if (!permission) {
    res.status(404).json({
      error: {
        code: "AUDIT_ENTITY_NOT_FOUND",
        message: "Unsupported audit entity",
      },
    });
    return;
  }
  requireAllPermissions(permission)(req, res, next);
}

auditRouter.get(
  "/:entityType/:entityId",
  authorizeAuditRead,
  async (req, res, next) => {
    try {
      res.json({
        events: await listAuditEvents(
          req.params.entityType,
          req.params.entityId,
          authorizationQuery(
            req.actor,
            readPermissionByType[req.params.entityType],
            req.query,
          ),
        ),
      });
    } catch (error) {
      next(error);
    }
  },
);
