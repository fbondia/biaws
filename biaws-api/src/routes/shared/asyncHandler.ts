import type { NextFunction, Request, RequestHandler, Response } from "express";
import { resolveRouteReferences } from "./resolveRouteReferences.js";

export function asyncHandler(handler: RequestHandler) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

export function createReferenceHandler(rootType?: string | ((req: Request) => string | undefined)) {
  return (handler: RequestHandler) =>
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
      await resolveRouteReferences(req, typeof rootType === "function" ? rootType(req) : rootType);
      await handler(req, res, next);
    });
}
