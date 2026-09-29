import { listWorkspaces } from "../../repositories/catalog/index.js";
import { asyncHandler } from "./helpers.js";

export function registerListWorkspaces(router) {
  router.get(
    "/workspaces",
    asyncHandler(async (req, res) => {
      res.json(
        await listWorkspaces({
          workspaceIds: req.actor.workspaces.map(({ id }) => id),
        }),
      );
    }),
  );
}
