import {
  getRequest,
  updateRequestTaskNote,
} from "../../../repositories/requests/index.js";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  nestedById,
  scopedQuery,
  auditDemand,
  asyncHandler,
} from "../helpers.js";

export function registerReplaceTasksNote(router) {
  router.put(
    "/:id/tasks/:taskId/notes/:noteId",
    requireAllPermissions("tasks.note.update"),
    asyncHandler(async (req, res) => {
      const query = scopedQuery(req, "tasks.note.update");
      const beforeDemand = (await getRequest(req.params.id, query)).request;
      const beforeTask = nestedById(beforeDemand.tasks, req.params.taskId);
      const result = await updateRequestTaskNote(
        req.params.id,
        req.params.taskId,
        req.params.noteId,
        req.body,
        query,
      );
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
