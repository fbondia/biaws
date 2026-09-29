import type { Router, Request, Response } from "express";
import {
  createRequestTaskNote,
  getRequest,
} from "../../../repositories/requests/index.js";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  nestedById,
  scopedQuery,
  auditDemand,
  asyncHandler,
} from "../helpers.js";

export function registerCreateTasksNote(router: Router) {
  router.post(
    "/:id/tasks/:taskId/notes",
    requireAllPermissions("tasks.note.create"),
    asyncHandler(async (req: Request, res: Response) => {
      const query = scopedQuery(req, "tasks.note.create");
      const beforeDemand = (await getRequest(req.params.id, query)).request;
      if (!beforeDemand)
        return res
          .status(404)
          .json({ error: { code: "NOT_FOUND", message: "Demand not found" } });
      const beforeTask = nestedById(beforeDemand.tasks, req.params.taskId);
      const result = await createRequestTaskNote(
        req.params.id,
        req.params.taskId,
        req.body,
        query,
      );
      if (!result.request) throw new Error("Updated demand could not be read");
      const afterTask = nestedById(result.request.tasks, req.params.taskId);
      await auditDemand({
        req,
        action: "task_note_added",
        summary: "Anotação adicionada à tarefa",
        before: beforeTask?.notes || [],
        after: afterTask?.notes || [],
        targetType: "task",
        targetId: req.params.taskId,
        targetLabel: afterTask?.title,
      });
      res.status(201).json(result);
    }),
  );
}
