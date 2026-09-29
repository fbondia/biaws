import type { Router, Request, Response } from "express";
import {
  deleteRequestTask,
  getRequest,
} from "../../../repositories/requests/index.js";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  nestedById,
  scopedQuery,
  auditDemand,
  requireDemandDocument,
  asyncHandler,
} from "../helpers.js";

export function registerDeleteTask(router: Router) {
  router.delete(
    "/:id/tasks/:taskId",
    requireAllPermissions("tasks.delete"),
    asyncHandler(async (req: Request, res: Response) => {
      const query = scopedQuery(req, "tasks.delete");
      const beforeDemand = requireDemandDocument(
        (await getRequest(req.params.id, query)).request,
      );
      const before = nestedById(beforeDemand.tasks, req.params.taskId);
      const result = await deleteRequestTask(
        req.params.id,
        req.params.taskId,
        query,
      );
      await auditDemand({
        req,
        action: "task_deleted",
        summary: "Tarefa excluída",
        before,
        after: null,
        targetType: "task",
        targetId: req.params.taskId,
        targetLabel: before?.title,
      });
      res.json(result);
    }),
  );
}
