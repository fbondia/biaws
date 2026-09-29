import { asyncHandler } from "../../shared/asyncHandler.js";
import { changeWorkspaceStatus } from "../helpers.js";

export function registerCreateWorkspacesArchive(router) {
  router.post(
    "/workspaces/:workspaceId/archive",
    asyncHandler((req, res) => changeWorkspaceStatus(req, res, "archived")),
  );
}
