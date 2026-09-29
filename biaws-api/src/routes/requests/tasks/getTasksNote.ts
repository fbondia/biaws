import type { Router, Request } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { createResourceReadHandler } from "../../shared/resourceReadHandler.js";
import { readRequestResource } from "../../../repositories/requests/index.js";

export function registerGetTasksNote(router: Router) {
  router.get(
    "/:id/tasks/:taskId/notes/:noteId",
    requireAllPermissions("demands.read"),
    createResourceReadHandler(
      "demand",
      "demands.read",
      async (req: Request, query: {} | undefined) => {
        const result = await readRequestResource(
          req.params.id,
          "task-note",
          req.params,
          query,
        );
        return result;
      },
    ),
  );
}
