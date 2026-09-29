import { listOptionLists } from "../../repositories/optionLists/index.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export function registerListRuntime(router) {
  router.get(
    "/runtime",
    asyncHandler(async (req, res) => {
      res.json(
        await listOptionLists({
          ...req.query,
          authorizationScope: {
            workspaceId: req.actor.workspaceId,
            workspace: true,
            applicationIds: [],
          },
        }),
      );
    }),
  );
}
