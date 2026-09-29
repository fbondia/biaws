import { asyncHandler } from "../../shared/asyncHandler.js";
import { changeWorkspaceStatus } from "../helpers.js";

export function registerCreateWorkspacesReactivate(router) {
  router.post(
    "/workspaces/:workspaceId/reactivate",
    asyncHandler((req, res) => changeWorkspaceStatus(req, res, "active")),
  );
}
