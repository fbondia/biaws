import { getAuthenticatedActor } from "./auth.js";

export function createAuthenticationMiddleware(resolveActor) {
  return async function authenticationMiddleware(req, res, next) {
    try {
      const actor = await resolveActor(req);
      if (!actor) {
        res.status(401).json({
          error: {
            code: "UNAUTHENTICATED",
            message: "Authentication is required",
          },
        });
        return;
      }

      req.actor = actor;
      next();
    } catch (error) {
      const status = error?.statusCode || error?.status;
      if (status === 403) {
        res.status(403).json({
          error: {
            code: error.code || "WORKSPACE_FORBIDDEN",
            message: error.message,
          },
        });
        return;
      }
      next(error);
    }
  };
}

export const requireAuthentication = createAuthenticationMiddleware(
  getAuthenticatedActor,
);

export function requireWorkspaceContext(req, res, next) {
  if (!req.actor?.workspaceId) {
    res.status(400).json({
      error: {
        code: "WORKSPACE_REQUIRED",
        message:
          "X-Biaws-Workspace-Id is required when the actor can access multiple workspaces",
      },
    });
    return;
  }
  next();
}
