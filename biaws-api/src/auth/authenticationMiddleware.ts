import type { NextFunction } from "express";
import type { Actor, ErrorResponsePort, MiddlewareRequest } from "../types/http.js";
import { getAuthenticatedActor } from "./auth.js";

export function createAuthenticationMiddleware<R extends MiddlewareRequest>(
  resolveActor: (req: R) => Promise<Actor | null>,
) {
  return async function authenticationMiddleware(req: R, res: ErrorResponsePort, next: NextFunction) {
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
      const details = error instanceof Error ? error : undefined;
      const status = details?.statusCode || details?.status;
      if (status === 403) {
        res.status(403).json({
          error: {
            code: details?.code || "WORKSPACE_FORBIDDEN",
            message: details?.message,
          },
        });
        return;
      }
      next(error);
    }
  };
}

export const requireAuthentication = createAuthenticationMiddleware(getAuthenticatedActor);

export function requireWorkspaceContext(req: MiddlewareRequest, res: ErrorResponsePort, next: NextFunction) {
  if (!req.actor?.workspaceId) {
    res.status(400).json({
      error: {
        code: "WORKSPACE_REQUIRED",
        message: "X-Biaws-Workspace-Id is required when the actor can access multiple workspaces",
      },
    });
    return;
  }
  next();
}
