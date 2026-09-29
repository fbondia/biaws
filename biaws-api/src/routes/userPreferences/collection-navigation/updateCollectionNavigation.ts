import type { Router, Request, Response } from "express";
import { updateCollectionNavigationPreference } from "../../../repositories/userPreferences/index.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export function registerUpdateCollectionNavigation(router: Router) {
  router.patch(
    "/collection-navigation/:context",
    asyncHandler(async (req: Request, res: Response) => {
      res.json(
        await updateCollectionNavigationPreference(
          req.params.context,
          req.body,
          req.actor,
        ),
      );
    }),
  );
}
