import { listAllWorkspaces } from "../../repositories/catalog/workspaces/platform.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export function registerListWorkspaces(router) {
  router.get(
    "/workspaces",
    asyncHandler(async (req, res) => {
      res.json(await listAllWorkspaces(req.query));
    }),
  );
}
