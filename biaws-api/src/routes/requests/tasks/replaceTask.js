import {
  getRequest,
  updateRequestTask,
} from "../../../repositories/requests/index.js";
import { requireBodyFieldPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  nestedById,
  scopedQuery,
  auditDemand,
  asyncHandler,
} from "../helpers.js";

export function registerReplaceTask(router) {
  router.put(
    "/:id/tasks/:taskId",
    requireBodyFieldPermissions(
      { status: "tasks.status.update" },
      "tasks.update",
    ),
    asyncHandler(async (req, res) => {
      const permission = Object.keys(req.body || {}).some(
        (field) => field !== "status",
      )
        ? "tasks.update"
        : "tasks.status.update";
      const query = scopedQuery(req, permission);
      const beforeDemand = (await getRequest(req.params.id, query)).request;
      const before = nestedById(beforeDemand.tasks, req.params.taskId);
      const result = await updateRequestTask(
        req.params.id,
        req.params.taskId,
        req.body,
        query,
      );
      const after = nestedById(result.request.tasks, req.params.taskId);
      await auditDemand({
        req,
        action: Object.hasOwn(req.body, "status")
          ? "task_status_changed"
          : "task_updated",
        summary: "Tarefa atualizada",
        before,
        after,
        targetType: "task",
        targetId: req.params.taskId,
        targetLabel: after?.title,
      });
      res.json(result);
    }),
  );
}
