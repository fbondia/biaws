import type { Router, Request } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { createResourceReadHandler } from "../../shared/resourceReadHandler.js";
import { readRequestResource } from "../../../repositories/requests/index.js";

export function registerListJourneys(router: Router) {
  router.get(
    "/:id/journeys",
    requireAllPermissions("demands.read"),
    createResourceReadHandler(
      "demand",
      "demands.read",
      async (req: Request, query: {} | undefined) => {
        const result = await readRequestResource(
          req.params.id,
          "journeys",
          req.params,
          query,
        );
        return result;
      },
    ),
  );
}
