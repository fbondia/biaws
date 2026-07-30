import { Router } from "express";

import {
  createProcedureCollection,
  createProcedure,
  deleteProcedureCollection,
  deleteProcedure,
  getProcedure,
  listProcedureCollections,
  listProcedures,
  moveProcedureToCollection,
  updateProcedureCollection,
  updateProcedure,
} from "../repositories/proceduresRepository.js";
import { registerAttachmentRoutes } from "./attachmentRoutes.js";
import {
  authorizationQuery,
  requireAllPermissions,
  requireWorkspaceScope,
} from "../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../repositories/auditRepository.js";
import { knowledgeContextMetadata } from "../repositories/knowledgeContextRepository.js";

export const proceduresRouter = Router();

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

proceduresRouter.get(
  "/",
  requireAllPermissions("procedures.read"),
  asyncHandler(async (req, res) =>
    res.json(
      await listProcedures(
        authorizationQuery(req.actor, "procedures.read", req.query),
      ),
    ),
  ),
);
proceduresRouter.post(
  "/",
  requireAllPermissions("procedures.create"),
  asyncHandler(async (req, res) => {
    const result = await createProcedure(
      { ...req.body, createdBy: req.actor.email || req.actor.userId },
      authorizationQuery(req.actor, "procedures.create", req.query),
    );
    await recordAuditEvent({
      actor: req.actor,
      action: "created",
      target: {
        type: "procedure",
        id: result.procedure.id,
        label: result.procedure.title,
      },
      after: result.procedure,
      summary: "Procedimento criado",
      metadata: knowledgeContextMetadata(result.procedure),
    });
    res.status(201).json(result);
  }),
);

proceduresRouter.get(
  "/collections",
  requireAllPermissions("procedures.read"),
  requireWorkspaceScope("procedures.read"),
  asyncHandler(async (req, res) =>
    res.json(
      await listProcedureCollections(
        authorizationQuery(req.actor, "procedures.read", req.query),
      ),
    ),
  ),
);

proceduresRouter.post(
  "/collections",
  requireAllPermissions("procedures.create"),
  requireWorkspaceScope("procedures.create"),
  asyncHandler(async (req, res) => {
    const result = await createProcedureCollection(
      { ...req.body, createdBy: req.actor.email || req.actor.userId },
      authorizationQuery(req.actor, "procedures.create", req.query),
    );
    await recordAuditEvent({
      actor: req.actor,
      action: "created",
      target: {
        type: "procedure_collection",
        id: result.collection.id,
        label: result.collection.name,
      },
      after: result.collection,
      summary: "Coleção de procedimentos criada",
    });
    res.status(201).json(result);
  }),
);

proceduresRouter.patch(
  "/collections/:collectionId",
  requireAllPermissions("procedures.update"),
  requireWorkspaceScope("procedures.update"),
  asyncHandler(async (req, res) => {
    const result = await updateProcedureCollection(
      req.params.collectionId,
      { ...req.body, updatedBy: req.actor.email || req.actor.userId },
      authorizationQuery(req.actor, "procedures.update", req.query),
    );
    await recordAuditEvent({
      actor: req.actor,
      action: "updated",
      target: {
        type: "procedure_collection",
        id: result.collection.id,
        label: result.collection.name,
      },
      after: result.collection,
      summary: "Coleção de procedimentos atualizada",
    });
    res.json(result);
  }),
);

proceduresRouter.delete(
  "/collections/:collectionId",
  requireAllPermissions("procedures.delete"),
  requireWorkspaceScope("procedures.delete"),
  asyncHandler(async (req, res) => {
    const result = await deleteProcedureCollection(
      req.params.collectionId,
      authorizationQuery(req.actor, "procedures.delete", req.query),
    );
    await recordAuditEvent({
      actor: req.actor,
      action: "deleted",
      target: {
        type: "procedure_collection",
        id: result.collection.id,
        label: result.collection.name,
      },
      before: result.collection,
      summary: "Coleção de procedimentos excluída",
    });
    res.json(result);
  }),
);

proceduresRouter.patch(
  "/:id/collection",
  requireAllPermissions("procedures.update"),
  requireWorkspaceScope("procedures.update"),
  asyncHandler(async (req, res) => {
    const query = authorizationQuery(req.actor, "procedures.update", req.query);
    const before = (await getProcedure(req.params.id, query)).procedure;
    const result = await moveProcedureToCollection(
      req.params.id,
      req.body.collectionId,
      { updatedBy: req.actor.email || req.actor.userId },
      query,
    );
    await recordAuditEvent({
      actor: req.actor,
      action: "updated",
      target: {
        type: "procedure",
        id: req.params.id,
        label: result.procedure?.title,
      },
      before,
      after: result.procedure,
      summary: "Procedimento movido entre coleções",
      metadata: knowledgeContextMetadata(result.procedure),
    });
    res.json(result);
  }),
);

registerAttachmentRoutes(proceduresRouter, "procedures");
proceduresRouter.get(
  "/:id",
  requireAllPermissions("procedures.read"),
  asyncHandler(async (req, res) => {
    const result = await getProcedure(
      req.params.id,
      authorizationQuery(req.actor, "procedures.read", req.query),
    );
    if (!result.procedure) {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: `Procedure not found: ${req.params.id}`,
        },
      });
      return;
    }
    res.json(result);
  }),
);
proceduresRouter.put(
  "/:id",
  requireAllPermissions("procedures.update"),
  asyncHandler(async (req, res) => {
    const query = authorizationQuery(req.actor, "procedures.update", req.query);
    const before = (await getProcedure(req.params.id, query)).procedure;
    const result = await updateProcedure(
      req.params.id,
      { ...req.body, updatedBy: req.actor.email || req.actor.userId },
      query,
    );
    await recordAuditEvent({
      actor: req.actor,
      action: "updated",
      target: {
        type: "procedure",
        id: req.params.id,
        label: result.procedure?.title,
      },
      before,
      after: result.procedure,
      summary: "Procedimento atualizado",
      metadata: knowledgeContextMetadata(result.procedure),
    });
    res.json(result);
  }),
);
proceduresRouter.delete(
  "/:id",
  requireAllPermissions("procedures.delete"),
  asyncHandler(async (req, res) => {
    const query = authorizationQuery(req.actor, "procedures.delete", req.query);
    const before = (await getProcedure(req.params.id, query)).procedure;
    const result = await deleteProcedure(req.params.id, query);
    await recordAuditEvent({
      actor: req.actor,
      action: "deleted",
      target: { type: "procedure", id: req.params.id, label: before?.title },
      before,
      summary: "Procedimento excluído",
      metadata: knowledgeContextMetadata(before),
    });
    res.json(result);
  }),
);
