import { updateCollectionNavigationPreference } from "../../../repositories/userPreferences/index.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export function registerUpdateCollectionNavigation(router) {
  router.patch(
    "/collection-navigation/:context",
    asyncHandler(async (req, res) => {
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
