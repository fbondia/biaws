import type { NextFunction } from "express";
import { textValue } from "../helpers/text.js";
import { resolveEntityReference } from "../repositories/shared/references.js";
import type { Actor, ErrorResponsePort, MiddlewareRequest } from "../types/http.js";

function forbidden(res: ErrorResponsePort, requiredPermissions: string[]) {
  res.status(403).json({
    error: {
      code: "FORBIDDEN",
      message: "The authenticated actor does not have the required permission",
      requiredPermissions,
    },
  });
}

export function actorHasPlatformPermission(actor: Partial<Actor> | null | undefined, permission: string) {
  return Array.isArray(actor?.platformPermissions) && actor.platformPermissions.includes(permission);
}

export function platformPermissionsForTechnicalRole(role: string) {
  const roles = String(role || "user")
    .split(",")
    .map((entry) => entry.trim());
  return roles.includes("admin") ? ["platform.workspaces.manage", "platform.audit.read"] : [];
}

export function requirePlatformPermissions(...requiredPermissions: string[]) {
  return function platformAuthorizationMiddleware(req: MiddlewareRequest, res: ErrorResponsePort, next: NextFunction) {
    if (!requiredPermissions.every((permission: string) => actorHasPlatformPermission(req.actor, permission))) {
      forbidden(res, requiredPermissions);
      return;
    }
    next();
  };
}

export function actorHasPermission(actor: Partial<Actor> | undefined, permission: string) {
  return Array.isArray(actor?.permissions) && actor.permissions.includes(permission);
}

export function actorPermissionScope(actor: Partial<Actor> | null | undefined, permission: string) {
  return actor?.permissionScopes?.[permission] || null;
}

export function actorCanAccessApplication(
  actor: Partial<Actor> | undefined,
  permission: string,
  applicationId: string | string[],
) {
  const scope = actorPermissionScope(actor, permission);
  return Boolean(scope?.workspace || scope?.applicationIds?.includes(String(applicationId || "")));
}

export function actorHasWorkspaceScope(actor: Partial<Actor> | undefined, permission: string) {
  return actorPermissionScope(actor, permission)?.workspace === true;
}

export function authorizationQuery(actor: Partial<Actor> | undefined, permission: string, query = {}) {
  const scope = actorPermissionScope(actor, permission);
  return {
    ...query,
    authorizationScope: {
      workspaceId: actor?.workspaceId || "",
      workspace: scope?.workspace === true,
      applicationIds: scope?.workspace ? [] : [...(scope?.applicationIds || [])],
    },
  };
}

export function requireApplicationAccess(permission: string, parameter = "applicationId") {
  return async function applicationAuthorizationMiddleware(
    req: MiddlewareRequest,
    res: ErrorResponsePort,
    next: NextFunction,
  ) {
    try {
      req.params![parameter] = await resolveEntityReference(
        "application",
        req.params![parameter],
        authorizationQuery(req.actor, permission),
      );
    } catch (error) {
      return next(error);
    }
    if (!actorCanAccessApplication(req.actor, permission, req.params![parameter])) {
      res.status(404).json({
        error: {
          code: "APPLICATION_NOT_FOUND",
          message: "Application not found",
        },
      });
      return;
    }
    next();
  };
}

export function requireApplicationPermissions(...permissions: string[]) {
  return async function applicationPermissionsMiddleware(
    req: MiddlewareRequest,
    res: ErrorResponsePort,
    next: NextFunction,
  ) {
    try {
      for (const permission of permissions) {
        req.params!.applicationId = await resolveEntityReference(
          "application",
          req.params!.applicationId,
          authorizationQuery(req.actor, permission),
        );
      }
    } catch (error) {
      return next(error);
    }
    const applicationId = req.params!.applicationId;
    if (!permissions.every((permission: string) => actorCanAccessApplication(req.actor, permission, applicationId))) {
      res.status(404).json({
        error: {
          code: "APPLICATION_NOT_FOUND",
          message: "Application not found",
        },
      });
      return;
    }
    next();
  };
}

export function requireWorkspaceScope(permission: string) {
  return function workspaceScopeAuthorizationMiddleware(
    req: MiddlewareRequest,
    res: ErrorResponsePort,
    next: NextFunction,
  ) {
    const requestedWorkspaceId = textValue(
      req.params?.workspaceId || req.body?.workspaceId || req.actor?.workspaceId || "",
    );
    if (requestedWorkspaceId !== req.actor?.workspaceId || !actorHasWorkspaceScope(req.actor, permission)) {
      res.status(404).json({
        error: {
          code: "WORKSPACE_NOT_FOUND",
          message: "Workspace not found",
        },
      });
      return;
    }
    next();
  };
}

export function requireAllPermissions(...requiredPermissions: string[]) {
  return function authorizationMiddleware(req: MiddlewareRequest, res: ErrorResponsePort, next: NextFunction) {
    if (!requiredPermissions.every((permission: string) => actorHasPermission(req.actor, permission))) {
      forbidden(res, requiredPermissions);
      return;
    }
    req.referencePermissions = requiredPermissions;
    next();
  };
}

export function requireAnyPermission(...requiredPermissions: string[]) {
  return function authorizationMiddleware(req: MiddlewareRequest, res: ErrorResponsePort, next: NextFunction) {
    if (!requiredPermissions.some((permission: string) => actorHasPermission(req.actor, permission))) {
      forbidden(res, requiredPermissions);
      return;
    }
    next();
  };
}

export function requireBodyFieldPermissions(
  fieldPermissions: Record<string, string>,
  fallbackPermission: string | null,
) {
  return function fieldAuthorizationMiddleware(req: MiddlewareRequest, res: ErrorResponsePort, next: NextFunction) {
    const fields = Object.keys(req.body || {});
    const required = [
      ...new Set(
        fields
          .map((field: string) => fieldPermissions[field] || fallbackPermission)
          .filter((permission): permission is string => Boolean(permission)),
      ),
    ];
    if (!required.every((permission: string) => actorHasPermission(req.actor, permission))) {
      forbidden(res, required);
      return;
    }
    req.referencePermissions = required;
    next();
  };
}

export function rejectDatabaseOverride(req: MiddlewareRequest, res: ErrorResponsePort, next: NextFunction) {
  const hasOverride =
    Object.hasOwn(req.query || {} || {}, "db") ||
    Object.hasOwn(req.query || {} || {}, "database") ||
    Object.hasOwn(req.body || {}, "db") ||
    Object.hasOwn(req.body || {}, "database");
  if (hasOverride) {
    res.status(400).json({
      error: {
        code: "DATABASE_OVERRIDE_FORBIDDEN",
        message: "Database selection is controlled by the server",
      },
    });
    return;
  }
  next();
}

export function requireIdentityAdminOperation(req: MiddlewareRequest, res: ErrorResponsePort, next: NextFunction) {
  const permissionByPath: Record<string, string> = {
    "/list-users": "users.read",
    "/create-user": "users.create",
    "/ban-user": "users.disable",
    "/unban-user": "users.disable",
    "/set-user-password": "users.password.reset",
    "/revoke-user-sessions": "users.update",
  };
  const permission = permissionByPath[req.path || ""];
  if (!permission || !actorHasPermission(req.actor, permission)) {
    forbidden(res, permission ? [permission] : []);
    return;
  }
  next();
}
