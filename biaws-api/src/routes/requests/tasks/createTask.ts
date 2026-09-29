import type { Router, Request, Response } from "express";
import {
  createRequestTask,
  getRequest,
} from "../../../repositories/requests/index.js";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  documentId,
  nestedById,
  scopedQuery,
  auditDemand,
  requireDemandDocument,
  asyncHandler,
} from "../helpers.js";

export function registerCreateTask(router: Router) {
  router.post(
    "/:id/tasks",
    requireAllPermissions("tasks.create"),
    asyncHandler(async (req: Request, res: Response) => {
      const query = scopedQuery(req, "tasks.create");
      const before = requireDemandDocument(
        (await getRequest(req.params.id, query)).request,
      );
      const result = await createRequestTask(req.params.id, req.body, query);
      const task = (requireDemandDocument(result.request).tasks || []).find(
        (item) => !nestedById(before.tasks, documentId(item)),
      );
      await auditDemand({
        req,
        action: "task_created",
        summary: "Tarefa criada",
        before: null,
        after: task || req.body,
        targetType: "task",
        targetId: documentId(task) || "new",
        targetLabel: task?.title,
      });
      res.status(201).json(result);
    }),
  );
}
