import type { Router, Request, Response } from "express";
import { getRequest, updateRequestTaskNote } from "../../../repositories/requests/index.js";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { nestedById, scopedQuery, auditDemand, asyncHandler } from "../helpers.js";

export function registerReplaceTasksNote(router: Router) {
  router.put(
    "/:id/tasks/:taskId/notes/:noteId",
    requireAllPermissions("tasks.note.update"),
    asyncHandler(async (req: Request, res: Response) => {
      const query = scopedQuery(req, "tasks.note.update");
      const beforeDemand = (await getRequest(req.params.id, query)).request;
      if (!beforeDemand) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Demand not found" } });
      const beforeTask = nestedById(beforeDemand.tasks, req.params.taskId);
      const result = await updateRequestTaskNote(req.params.id, req.params.taskId, req.params.noteId, req.body, query);
      if (!result.request) throw new Error("Updated demand could not be read");
      const afterTask = nestedById(result.request.tasks, req.params.taskId);
      await auditDemand({
        req,
        action: "task_note_updated",
        summary: "Anotação da tarefa atualizada",
        before: beforeTask?.notes || [],
        after: afterTask?.notes || [],
        targetType: "task",
        targetId: req.params.taskId,
        targetLabel: afterTask?.title,
      });
      res.json(result);
    }),
  );
}
