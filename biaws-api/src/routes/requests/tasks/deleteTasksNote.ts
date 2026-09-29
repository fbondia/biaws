import type { Router, Request, Response } from "express";
import { deleteRequestTaskNote, getRequest } from "../../../repositories/requests/index.js";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { nestedById, scopedQuery, auditDemand, asyncHandler } from "../helpers.js";

export function registerDeleteTasksNote(router: Router) {
  router.delete(
    "/:id/tasks/:taskId/notes/:noteId",
    requireAllPermissions("tasks.note.delete"),
    asyncHandler(async (req: Request, res: Response) => {
      const query = scopedQuery(req, "tasks.note.delete");
      const beforeDemand = (await getRequest(req.params.id, query)).request;
      if (!beforeDemand) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Demand not found" } });
      const beforeTask = nestedById(beforeDemand.tasks, req.params.taskId);
      const result = await deleteRequestTaskNote(req.params.id, req.params.taskId, req.params.noteId, query);
      if (!result.request) throw new Error("Updated demand could not be read");
      const afterTask = nestedById(result.request.tasks, req.params.taskId);
      await auditDemand({
        req,
        action: "task_note_deleted",
        summary: "Anotação da tarefa excluída",
        before: beforeTask?.notes || [],
        after: afterTask?.notes || [],
        targetType: "task",
        targetId: req.params.taskId,
        targetLabel: beforeTask?.title,
      });
      res.json(result);
    }),
  );
}
