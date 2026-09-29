import type { Request, Response, NextFunction } from "express";
import { getUserAccess } from "../../repositories/access/index.js";

export async function requireWorkspaceUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const access = await getUserAccess(req.params.userId, {
      workspaceId: req.actor.workspaceId ?? undefined,
    });
    if (!access.groupIds.length) {
      res.status(404).json({
        error: { code: "USER_NOT_FOUND", message: "User not found" },
      });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}
