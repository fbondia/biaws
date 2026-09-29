import { updateMonitoringPanelPreference } from "../../repositories/userPreferences/index.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export function registerReplaceMonitoringPanel(router) {
  router.put(
    "/monitoring-panel",
    asyncHandler(async (req, res) => {
      res.json(await updateMonitoringPanelPreference(req.body, req.actor));
    }),
  );
}
