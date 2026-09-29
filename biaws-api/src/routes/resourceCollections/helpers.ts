import type { Request, Response, NextFunction } from "express";
import {
  authorizationQuery,
  requireAllPermissions,
  requireWorkspaceScope,
} from "../../auth/authorizationMiddleware.js";
import { assertResourceCollectionType } from "../../repositories/resourceCollections/index.js";

export const PERMISSIONS = Object.freeze({
  applications: { read: "applications.read", manage: "applications.update" },
  documents: { read: "documents.read", manage: "documents.update" },
  demands: { read: "demands.read", manage: "demands.update" },
  secrets: { read: "secrets.metadata.read", manage: "secrets.update" },
  skills: { read: "skills.read", manage: "skills.publish" },
  servers: { read: "servers.read", manage: "servers.update" },
});

export function authorize(operation: "read" | "manage", { workspace = false } = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const type = assertResourceCollectionType(req.params.resourceType);
      const permission = PERMISSIONS[type][operation];
      const permissionMiddleware = requireAllPermissions(permission);
      permissionMiddleware(req, res, (error: unknown) => {
        if (error || !workspace) return next(error);
        requireWorkspaceScope(permission)(req, res, next);
      });
    } catch (error) {
      next(error);
    }
  };
}

export function query(req: Request, operation: "read" | "manage") {
  const type = assertResourceCollectionType(req.params.resourceType);
  return authorizationQuery(req.actor, PERMISSIONS[type][operation], req.query);
}
