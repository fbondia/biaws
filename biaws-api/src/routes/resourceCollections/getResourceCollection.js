import { listResourceCollections } from "../../repositories/resourceCollections/index.js";
import { asyncHandler } from "../shared/asyncHandler.js";
import { authorize, query } from "./helpers.js";

export function registerGetResourceCollection(router) {
  router.get(
    "/:resourceType",
    authorize("read"),
    asyncHandler(async (req, res) => {
      res.json(
        await listResourceCollections(
          req.params.resourceType,
          query(req, "read"),
        ),
      );
    }),
  );
}
