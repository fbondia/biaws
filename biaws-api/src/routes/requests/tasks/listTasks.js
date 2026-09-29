import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { createResourceReadHandler } from "../../shared/resourceReadHandler.js";
import { readRequestResource } from "../../../repositories/requests/index.js";

export function registerListTasks(router) {
  router.get(
    "/:id/tasks",
    requireAllPermissions("demands.read"),
    createResourceReadHandler("demand", "demands.read", async (req, query) => {
      const result = await readRequestResource(
        req.params.id,
        "tasks",
        req.params,
        query,
      );
      return result;
    }),
  );
}
