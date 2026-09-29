import { getCollectionNavigationPreference } from "../../../repositories/userPreferences/index.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export function registerGetCollectionNavigation(router) {
  router.get(
    "/collection-navigation/:context",
    asyncHandler(async (req, res) => {
      res.json(
        await getCollectionNavigationPreference(req.params.context, req.actor),
      );
    }),
  );
}
