import { Router } from "express";

import {
  authorizationQuery,
  requireAllPermissions,
} from "../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../repositories/auditRepository.js";
import { knowledgeContextMetadata } from "../repositories/knowledgeContextRepository.js";
import {
  addKnowledgeObservation,
  archiveKnowledgeRecord,
  createKnowledgeRecord,
  getKnowledgeRecord,
  knowledgeRecordConfig,
  listKnowledgeObservations,
  listKnowledgeRecords,
  listKnowledgeRevisions,
  moveKnowledgeRecord,
  updateKnowledgeRecord,
} from "../repositories/knowledgeRecordsRepository.js";

export const knowledgeRecordsRouter = Router();

const PERMISSIONS = Object.freeze({
  "business-rules": {
    read: "business_rules.read",
    create: "business_rules.create",
    update: "business_rules.update",
    archive: "business_rules.archive",
  },
  "architecture-decisions": {
    read: "architecture_decisions.read",
    create: "architecture_decisions.create",
    update: "architecture_decisions.update",
    archive: "architecture_decisions.archive",
  },
});

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function permission(req, operation) {
  knowledgeRecordConfig(req.params.type);
  return PERMISSIONS[req.params.type][operation];
}

function authorize(operation) {
  return (req, res, next) => {
    try {
      requireAllPermissions(permission(req, operation))(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function query(req, operation) {
  return authorizationQuery(req.actor, permission(req, operation), req.query);
}

function actorId(req) {
  return req.actor.email || req.actor.userId;
}

async function currentRecord(req, operation = "read") {
  const config = knowledgeRecordConfig(req.params.type);
  const payload = await getKnowledgeRecord(
    req.params.type,
    req.params.id,
    query(req, operation),
  );
  return payload[config.itemKey];
}

knowledgeRecordsRouter.get(
  "/:type",
  authorize("read"),
  asyncHandler(async (req, res) => {
    res.json(await listKnowledgeRecords(req.params.type, query(req, "read")));
  }),
);

knowledgeRecordsRouter.post(
  "/:type",
  authorize("create"),
  asyncHandler(async (req, res) => {
    const config = knowledgeRecordConfig(req.params.type);
    const result = await createKnowledgeRecord(
      req.params.type,
      { ...req.body, createdBy: actorId(req) },
      query(req, "create"),
    );
    const record = result[config.itemKey];
    await recordAuditEvent({
      actor: req.actor,
      action: "created",
      target: { type: config.entityType, id: record.id, label: record.title },
      after: record,
      summary: `${config.label} criada`,
      metadata: knowledgeContextMetadata(record),
    });
    res.status(201).json(result);
  }),
);

knowledgeRecordsRouter.get(
  "/:type/:id/revisions",
  authorize("read"),
  asyncHandler(async (req, res) => {
    res.json(
      await listKnowledgeRevisions(
        req.params.type,
        req.params.id,
        query(req, "read"),
      ),
    );
  }),
);

knowledgeRecordsRouter.get(
  "/:type/:id/observations",
  authorize("read"),
  asyncHandler(async (req, res) => {
    res.json(
      await listKnowledgeObservations(
        req.params.type,
        req.params.id,
        query(req, "read"),
      ),
    );
  }),
);

knowledgeRecordsRouter.post(
  "/:type/:id/observations",
  authorize("update"),
  asyncHandler(async (req, res) => {
    const config = knowledgeRecordConfig(req.params.type);
    const record = await currentRecord(req, "update");
    if (!record) {
      res
        .status(404)
        .json({
          error: {
            code: "KNOWLEDGE_RECORD_NOT_FOUND",
            message: `${config.label} não encontrada`,
          },
        });
      return;
    }
    const result = await addKnowledgeObservation(
      req.params.type,
      req.params.id,
      { ...req.body, createdBy: actorId(req) },
      query(req, "update"),
    );
    await recordAuditEvent({
      actor: req.actor,
      action: "created",
      target: {
        type: `${config.entityType}_observation`,
        id: result.observation.id,
        label: "Observação",
      },
      root: { type: config.entityType, id: record.id },
      after: result.observation,
      summary: "Observação adicionada",
      metadata: knowledgeContextMetadata(record),
    });
    res.status(201).json(result);
  }),
);

knowledgeRecordsRouter.patch(
  "/:type/:id/collection",
  authorize("update"),
  asyncHandler(async (req, res) => {
    const config = knowledgeRecordConfig(req.params.type);
    const before = await currentRecord(req, "update");
    const result = await moveKnowledgeRecord(
      req.params.type,
      req.params.id,
      req.body.collectionId,
      { updatedBy: actorId(req) },
      query(req, "update"),
    );
    const after = result[config.itemKey];
    await recordAuditEvent({
      actor: req.actor,
      action: "updated",
      target: { type: config.entityType, id: after.id, label: after.title },
      before,
      after,
      summary: `${config.label} movida entre coleções`,
      metadata: knowledgeContextMetadata(after),
    });
    res.json(result);
  }),
);

knowledgeRecordsRouter.get(
  "/:type/:id",
  authorize("read"),
  asyncHandler(async (req, res) => {
    const config = knowledgeRecordConfig(req.params.type);
    const result = await getKnowledgeRecord(
      req.params.type,
      req.params.id,
      query(req, "read"),
    );
    if (!result[config.itemKey]) {
      res
        .status(404)
        .json({
          error: {
            code: "KNOWLEDGE_RECORD_NOT_FOUND",
            message: `${config.label} não encontrada`,
          },
        });
      return;
    }
    res.json(result);
  }),
);

knowledgeRecordsRouter.put(
  "/:type/:id",
  authorize("update"),
  asyncHandler(async (req, res) => {
    const config = knowledgeRecordConfig(req.params.type);
    const before = await currentRecord(req, "update");
    const result = await updateKnowledgeRecord(
      req.params.type,
      req.params.id,
      { ...req.body, updatedBy: actorId(req) },
      query(req, "update"),
    );
    const after = result[config.itemKey];
    await recordAuditEvent({
      actor: req.actor,
      action: "updated",
      target: { type: config.entityType, id: after.id, label: after.title },
      before,
      after,
      summary: `${config.label} atualizada`,
      metadata: knowledgeContextMetadata(after),
    });
    res.json(result);
  }),
);

knowledgeRecordsRouter.delete(
  "/:type/:id",
  authorize("archive"),
  asyncHandler(async (req, res) => {
    const config = knowledgeRecordConfig(req.params.type);
    const before = await currentRecord(req, "archive");
    const result = await archiveKnowledgeRecord(
      req.params.type,
      req.params.id,
      { updatedBy: actorId(req) },
      query(req, "archive"),
    );
    const after = result[config.itemKey];
    await recordAuditEvent({
      actor: req.actor,
      action: "archived",
      target: { type: config.entityType, id: after.id, label: after.title },
      before,
      after,
      summary: `${config.label} arquivada`,
      metadata: knowledgeContextMetadata(after),
    });
    res.json(result);
  }),
);
