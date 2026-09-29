import type { Router, Request, Response } from "express";
import { getCollectionNavigationPreference } from "../../../repositories/userPreferences/index.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export function registerGetCollectionNavigation(router: Router) {
  router.get(
    "/collection-navigation/:context",
    asyncHandler(async (req: Request, res: Response) => {
      res.json(await getCollectionNavigationPreference(req.params.context, req.actor));
    }),
  );
}
