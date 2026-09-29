import { resolveRouteReferences } from "./resolveRouteReferences.js";

export function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

export function createReferenceHandler(rootType) {
  return (handler) =>
    asyncHandler(async (req, res, next) => {
      await resolveRouteReferences(
        req,
        typeof rootType === "function" ? rootType(req) : rootType,
      );
      await handler(req, res, next);
    });
}
