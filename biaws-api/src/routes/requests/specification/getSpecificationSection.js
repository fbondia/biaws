import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { createResourceReadHandler } from "../../shared/resourceReadHandler.js";
import { readRequestResource } from "../../../repositories/requests/index.js";

export function registerGetSpecificationSection(router) {
  router.get(
    "/:id/specification/sections/:sectionId",
    requireAllPermissions("demands.read"),
    createResourceReadHandler("demand", "demands.read", async (req, query) => {
      const result = await readRequestResource(
        req.params.id,
        "section",
        req.params,
        query,
      );
      return result;
    }),
  );
}
