import { Router } from "express";

import {
  createRequestNote,
  createRequestTask,
  createRequestTaskNote,
  createRequest,
  deleteRequest,
  deleteRequestNote,
  deleteRequestTask,
  deleteRequestTaskNote,
  getRequest,
  listRequests,
  reorderRequest,
  updateRequestNote,
  updateRequestTask,
  updateRequestTaskNote,
  updateRequest,
} from "../repositories/requestsRepository.js";
import { registerAttachmentRoutes } from "./attachmentRoutes.js";
import {
  authorizationQuery,
  requireAllPermissions,
  requireBodyFieldPermissions,
} from "../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../repositories/auditRepository.js";
import { knowledgeContextMetadata } from "../repositories/knowledgeContextRepository.js";

export const requestsRouter = Router();

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function documentId(document) {
  return String(document?.id || document?._id || "");
}

function nestedById(items, id) {
  return (items || []).find((item) => documentId(item) === String(id));
}

function scopedQuery(req, permission) {
  return authorizationQuery(req.actor, permission, req.query);
}

async function auditDemand({
  req,
  action,
  summary,
  before,
  after,
  targetType = "demand",
  targetId,
  targetLabel,
}) {
  const demandId = req.params.id || documentId(after || before);
  await recordAuditEvent({
    actor: req.actor,
    action,
    target: {
      type: targetType,
      id: targetId || demandId,
      label: targetLabel || after?.title || before?.title,
    },
    root: { type: "demand", id: demandId },
    before,
    after,
    summary,
    metadata: knowledgeContextMetadata(after || before),
  });
}

requestsRouter.get(
  "/",
  requireAllPermissions("demands.read"),
  asyncHandler(async (req, res) => {
    res.json(await listRequests(scopedQuery(req, "demands.read")));
  }),
);

requestsRouter.post(
  "/",
  requireBodyFieldPermissions(
    { specification: "demands.specification.update" },
    "demands.create",
  ),
  asyncHandler(async (req, res) => {
    const result = await createRequest(
      { ...req.body, createdBy: req.actor.email || req.actor.userId },
      scopedQuery(req, "demands.create"),
    );
    await auditDemand({
      req,
      action: "created",
      summary: "Melhoria criada",
      after: result.request,
    });
    res.status(201).json(result);
  }),
);

registerAttachmentRoutes(requestsRouter, "requests");

requestsRouter.put(
  "/:id",
  requireBodyFieldPermissions(
    { specification: "demands.specification.update" },
    "demands.update",
  ),
  asyncHandler(async (req, res) => {
    const query = scopedQuery(req, "demands.update");
    const before = (await getRequest(req.params.id, query)).request;
    const result = await updateRequest(
      req.params.id,
      { ...req.body, updatedBy: req.actor.email || req.actor.userId },
      query,
    );
    await auditDemand({
      req,
      action: "updated",
      summary: "Melhoria atualizada",
      before,
      after: result.request,
    });
    res.json(result);
  }),
);

requestsRouter.patch(
  "/:id/order",
  requireAllPermissions("demands.reorder"),
  asyncHandler(async (req, res) => {
    const query = scopedQuery(req, "demands.reorder");
    const before = (await getRequest(req.params.id, query)).request;
    const result = await reorderRequest(req.params.id, req.body, query);
    await auditDemand({
      req,
      action: "reordered",
      summary: "Melhoria reordenada",
      before,
      after: result.request,
    });
    res.json(result);
  }),
);

requestsRouter.post(
  "/:id/notes",
  requireAllPermissions("demands.note.create"),
  asyncHandler(async (req, res) => {
    const query = scopedQuery(req, "demands.note.create");
    const before = (await getRequest(req.params.id, query)).request;
    const result = await createRequestNote(req.params.id, req.body, query);
    const added = (result.request.notes || []).find(
      (note) => !nestedById(before.notes, documentId(note)),
    );
    await auditDemand({
      req,
      action: "note_added",
      summary: "Anotação adicionada à melhoria",
      before: null,
      after: added || req.body,
      targetType: "note",
      targetId: documentId(added) || "new",
      targetLabel: added?.content?.slice?.(0, 80),
    });
    res.status(201).json(result);
  }),
);

requestsRouter.put(
  "/:id/notes/:noteId",
  requireAllPermissions("demands.note.update"),
  asyncHandler(async (req, res) => {
    const query = scopedQuery(req, "demands.note.update");
    const beforeDemand = (await getRequest(req.params.id, query)).request;
    const before = nestedById(beforeDemand.notes, req.params.noteId);
    const result = await updateRequestNote(
      req.params.id,
      req.params.noteId,
      req.body,
      query,
    );
    const after = nestedById(result.request.notes, req.params.noteId);
    await auditDemand({
      req,
      action: "note_updated",
      summary: "Anotação da melhoria atualizada",
      before,
      after,
      targetType: "note",
      targetId: req.params.noteId,
    });
    res.json(result);
  }),
);

requestsRouter.delete(
  "/:id/notes/:noteId",
  requireAllPermissions("demands.note.delete"),
  asyncHandler(async (req, res) => {
    const query = scopedQuery(req, "demands.note.delete");
    const beforeDemand = (await getRequest(req.params.id, query)).request;
    const before = nestedById(beforeDemand.notes, req.params.noteId);
    const result = await deleteRequestNote(
      req.params.id,
      req.params.noteId,
      query,
    );
    await auditDemand({
      req,
      action: "note_deleted",
      summary: "Anotação da melhoria excluída",
      before,
      after: null,
      targetType: "note",
      targetId: req.params.noteId,
    });
    res.json(result);
  }),
);

requestsRouter.post(
  "/:id/tasks",
  requireAllPermissions("tasks.create"),
  asyncHandler(async (req, res) => {
    const query = scopedQuery(req, "tasks.create");
    const before = (await getRequest(req.params.id, query)).request;
    const result = await createRequestTask(req.params.id, req.body, query);
    const task = (result.request.tasks || []).find(
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

requestsRouter.put(
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

requestsRouter.delete(
  "/:id/tasks/:taskId",
  requireAllPermissions("tasks.delete"),
  asyncHandler(async (req, res) => {
    const query = scopedQuery(req, "tasks.delete");
    const beforeDemand = (await getRequest(req.params.id, query)).request;
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

requestsRouter.post(
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

requestsRouter.put(
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

requestsRouter.delete(
  "/:id/tasks/:taskId/notes/:noteId",
  requireAllPermissions("tasks.note.delete"),
  asyncHandler(async (req, res) => {
    const query = scopedQuery(req, "tasks.note.delete");
    const beforeDemand = (await getRequest(req.params.id, query)).request;
    const beforeTask = nestedById(beforeDemand.tasks, req.params.taskId);
    const result = await deleteRequestTaskNote(
      req.params.id,
      req.params.taskId,
      req.params.noteId,
      query,
    );
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

requestsRouter.delete(
  "/:id",
  requireAllPermissions("demands.delete"),
  asyncHandler(async (req, res) => {
    const query = scopedQuery(req, "demands.delete");
    const before = (await getRequest(req.params.id, query)).request;
    const result = await deleteRequest(req.params.id, query);
    await auditDemand({
      req,
      action: "deleted",
      summary: "Melhoria excluída",
      before,
      after: null,
    });
    res.json(result);
  }),
);
