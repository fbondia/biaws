import {
  getHomeDashboard,
  saveHomeConfiguration,
} from "../../repositories/home/index.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export function registerReplaceConfiguration(router) {
  router.put(
    "/configuration",
    asyncHandler(async (req, res) => {
      await saveHomeConfiguration(req.body, req.actor);
      res.json(await getHomeDashboard(req.actor));
    }),
  );
}
