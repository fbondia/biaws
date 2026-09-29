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

export function registerCreateTasksNote(router) {
  router.post(
    "/:id/tasks/:taskId/notes",
    requireAllPermissions("tasks.note.create"),
    asyncHandler(async (req, res) => {
      const query = scopedQuery(req, "tasks.note.create");
      const beforeDemand = (await getRequest(req.params.id, query)).request;
      const beforeTask = nestedById(beforeDemand.tasks, req.params.taskId);
      const result = await createRequestTaskNote(
        req.params.id,
        req.params.taskId,
        req.body,
        query,
      );
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
