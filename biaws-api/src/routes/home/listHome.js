import { getHomeDashboard } from "../../repositories/home/index.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export function registerListHome(router) {
  router.get(
    "/",
    asyncHandler(async (req, res) => {
      res.json(await getHomeDashboard(req.actor));
    }),
  );
}
