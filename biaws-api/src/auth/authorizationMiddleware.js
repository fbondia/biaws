function forbidden(res, requiredPermissions) {
  res.status(403).json({
    error: {
      code: "FORBIDDEN",
      message: "The authenticated actor does not have the required permission",
      requiredPermissions,
    },
  });
}

export function actorHasPermission(actor, permission) {
  return (
    Array.isArray(actor?.permissions) && actor.permissions.includes(permission)
  );
}

export function actorPermissionScope(actor, permission) {
  return actor?.permissionScopes?.[permission] || null;
}

export function actorCanAccessApplication(actor, permission, applicationId) {
  const scope = actorPermissionScope(actor, permission);
  return Boolean(
    scope?.workspace ||
    scope?.applicationIds?.includes(String(applicationId || "")),
  );
}

export function actorHasWorkspaceScope(actor, permission) {
  return actorPermissionScope(actor, permission)?.workspace === true;
}

export function authorizationQuery(actor, permission, query = {}) {
  const scope = actorPermissionScope(actor, permission);
  return {
    ...query,
    authorizationScope: {
      workspaceId: actor?.workspaceId || "",
      workspace: scope?.workspace === true,
      applicationIds: scope?.workspace
        ? []
        : [...(scope?.applicationIds || [])],
    },
  };
}

export function requireApplicationAccess(
  permission,
  parameter = "applicationId",
) {
  return function applicationAuthorizationMiddleware(req, res, next) {
    if (
      !actorCanAccessApplication(req.actor, permission, req.params[parameter])
    ) {
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

export function requireApplicationPermissions(...permissions) {
  return function applicationPermissionsMiddleware(req, res, next) {
    const applicationId = req.params.applicationId;
    if (
      !permissions.every((permission) =>
        actorCanAccessApplication(req.actor, permission, applicationId),
      )
    ) {
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

export function requireWorkspaceScope(permission) {
  return function workspaceScopeAuthorizationMiddleware(req, res, next) {
    const requestedWorkspaceId = String(
      req.params.workspaceId ||
        req.body?.workspaceId ||
        req.actor?.workspaceId ||
        "",
    );
    if (
      requestedWorkspaceId !== req.actor?.workspaceId ||
      !actorHasWorkspaceScope(req.actor, permission)
    ) {
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

export function requireAllPermissions(...requiredPermissions) {
  return function authorizationMiddleware(req, res, next) {
    if (
      !requiredPermissions.every((permission) =>
        actorHasPermission(req.actor, permission),
      )
    ) {
      forbidden(res, requiredPermissions);
      return;
    }
    next();
  };
}

export function requireAnyPermission(...requiredPermissions) {
  return function authorizationMiddleware(req, res, next) {
    if (
      !requiredPermissions.some((permission) =>
        actorHasPermission(req.actor, permission),
      )
    ) {
      forbidden(res, requiredPermissions);
      return;
    }
    next();
  };
}

export function requireBodyFieldPermissions(
  fieldPermissions,
  fallbackPermission,
) {
  return function fieldAuthorizationMiddleware(req, res, next) {
    const fields = Object.keys(req.body || {});
    const required = [
      ...new Set(
        fields
          .map((field) => fieldPermissions[field] || fallbackPermission)
          .filter(Boolean),
      ),
    ];
    if (
      !required.every((permission) => actorHasPermission(req.actor, permission))
    ) {
      forbidden(res, required);
      return;
    }
    next();
  };
}

export function rejectDatabaseOverride(req, res, next) {
  const hasOverride =
    Object.hasOwn(req.query || {}, "db") ||
    Object.hasOwn(req.query || {}, "database") ||
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

export function requireIdentityAdminOperation(req, res, next) {
  const permissionByPath = {
    "/list-users": "users.read",
    "/create-user": "users.create",
    "/ban-user": "users.disable",
    "/unban-user": "users.disable",
    "/set-user-password": "users.password.reset",
    "/revoke-user-sessions": "users.update",
  };
  const permission = permissionByPath[req.path];
  if (!permission || !actorHasPermission(req.actor, permission)) {
    forbidden(res, permission ? [permission] : []);
    return;
  }
  next();
}
