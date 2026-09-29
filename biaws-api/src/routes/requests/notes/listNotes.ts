import type { Router, Request } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { createResourceReadHandler } from "../../shared/resourceReadHandler.js";
import { readRequestResource } from "../../../repositories/requests/index.js";

export function registerListNotes(router: Router) {
  router.get(
    "/:id/notes",
    requireAllPermissions("demands.read"),
    createResourceReadHandler(
      "demand",
      "demands.read",
      async (req: Request, query: {} | undefined) => {
        const result = await readRequestResource(
          req.params.id,
          "notes",
          req.params,
          query,
        );
        return result;
      },
    ),
  );
}
