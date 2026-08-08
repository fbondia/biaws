import { Router } from "express";

import {
  actorHasPermission,
  authorizationQuery,
  requireAnyPermission,
} from "../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../repositories/auditRepository.js";
import {
  addDocumentObservation,
  archiveDocument,
  createDocument,
  documentTypeConfig,
  getDocument,
  listDocumentObservations,
  listDocumentRevisions,
  listDocuments,
  moveDocument,
  updateDocument,
} from "../repositories/documentsRepository.js";
import { knowledgeContextMetadata } from "../repositories/knowledgeContextRepository.js";

export const knowledgeRecordsRouter = Router();

const LEGACY_TYPES = Object.freeze({
  "business-rules": {
    documentType: "business-rule",
    itemKey: "businessRule",
    permission: "business_rules",
  },
  "architecture-decisions": {
    documentType: "architecture-decision",
    itemKey: "architectureDecision",
    permission: "architecture_decisions",
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

function routeConfig(type) {
  if (type === "documents")
    return { itemKey: "document", permission: "documents" };
  const legacy = LEGACY_TYPES[type];
  if (!legacy) {
    const error = new Error(`Tipo de conhecimento não suportado: ${type}`);
    error.statusCode = 404;
    error.code = "KNOWLEDGE_RECORD_TYPE_NOT_FOUND";
    throw error;
  }
  return legacy;
}

function operationPermissions(req, operation) {
  const config = routeConfig(req.params.type);
  return req.params.type === "documents"
    ? [`documents.${operation}`]
    : [`documents.${operation}`, `${config.permission}.${operation}`];
}

function authorize(operation) {
  return (req, res, next) => {
    try {
      requireAnyPermission(...operationPermissions(req, operation))(
        req,
        res,
        next,
      );
    } catch (error) {
      next(error);
    }
  };
}

function effectivePermission(req, operation) {
  return operationPermissions(req, operation).find((permission) =>
    actorHasPermission(req.actor, permission),
  );
}

function query(req, operation, additions = {}) {
  return authorizationQuery(req.actor, effectivePermission(req, operation), {
    ...req.query,
    ...additions,
  });
}

function actorId(req) {
  return req.actor.email || req.actor.userId;
}

function typeFor(req, payload = {}) {
  const config = routeConfig(req.params.type);
  const documentType =
    config.documentType || payload.documentType || req.query.documentType;
  if (documentType) documentTypeConfig(documentType);
  return documentType;
}

function responseFor(req, result) {
  const config = routeConfig(req.params.type);
  if (config.itemKey === "document") return result;
  return { meta: result.meta, [config.itemKey]: result.document };
}

async function currentDocument(req, operation = "read") {
  const result = await getDocument(req.params.id, query(req, operation));
  const document = result.document;
  const requiredType = routeConfig(req.params.type).documentType;
  return document && (!requiredType || document.documentType === requiredType)
    ? document
    : null;
}

function sendNotFound(res) {
  res.status(404).json({
    error: { code: "DOCUMENT_NOT_FOUND", message: "Documento não encontrado" },
  });
}

knowledgeRecordsRouter.get(
  "/:type",
  authorize("read"),
  asyncHandler(async (req, res) => {
    const documentType = typeFor(req);
    res.json(
      await listDocuments(
        query(req, "read", documentType ? { documentType } : {}),
      ),
    );
  }),
);

knowledgeRecordsRouter.post(
  "/:type",
  authorize("create"),
  asyncHandler(async (req, res) => {
    const documentType = typeFor(req, req.body);
    if (!documentType) {
      res.status(422).json({
        error: {
          code: "INVALID_DOCUMENT_TYPE",
          message: "documentType é obrigatório",
        },
      });
      return;
    }
    const result = await createDocument(
      { ...req.body, documentType, createdBy: actorId(req) },
      query(req, "create"),
    );
    const document = result.document;
    await recordAuditEvent({
      actor: req.actor,
      action: "created",
      target: { type: "document", id: document.id, label: document.title },
      after: document,
      summary: `${documentTypeConfig(document.documentType).label} criada`,
      metadata: knowledgeContextMetadata(document),
    });
    res.status(201).json(responseFor(req, result));
  }),
);

knowledgeRecordsRouter.get(
  "/:type/:id/revisions",
  authorize("read"),
  asyncHandler(async (req, res) => {
    if (!(await currentDocument(req))) return sendNotFound(res);
    res.json(await listDocumentRevisions(req.params.id, query(req, "read")));
  }),
);

knowledgeRecordsRouter.get(
  "/:type/:id/observations",
  authorize("read"),
  asyncHandler(async (req, res) => {
    if (!(await currentDocument(req))) return sendNotFound(res);
    res.json(await listDocumentObservations(req.params.id, query(req, "read")));
  }),
);

knowledgeRecordsRouter.post(
  "/:type/:id/observations",
  authorize("update"),
  asyncHandler(async (req, res) => {
    const document = await currentDocument(req, "update");
    if (!document) return sendNotFound(res);
    const result = await addDocumentObservation(
      req.params.id,
      { ...req.body, createdBy: actorId(req) },
      query(req, "update"),
    );
    await recordAuditEvent({
      actor: req.actor,
      action: "created",
      target: {
        type: "document_observation",
        id: result.observation.id,
        label: "Observação",
      },
      root: { type: "document", id: document.id },
      after: result.observation,
      summary: "Observação adicionada",
      metadata: knowledgeContextMetadata(document),
    });
    res.status(201).json(result);
  }),
);

knowledgeRecordsRouter.patch(
  "/:type/:id/collection",
  authorize("update"),
  asyncHandler(async (req, res) => {
    const before = await currentDocument(req, "update");
    if (!before) return sendNotFound(res);
    const result = await moveDocument(
      req.params.id,
      req.body.collectionId,
      { updatedBy: actorId(req) },
      query(req, "update"),
    );
    await recordAuditEvent({
      actor: req.actor,
      action: "updated",
      target: {
        type: "document",
        id: result.document.id,
        label: result.document.title,
      },
      before,
      after: result.document,
      summary: "Documento movido entre coleções",
      metadata: knowledgeContextMetadata(result.document),
    });
    res.json(responseFor(req, result));
  }),
);

knowledgeRecordsRouter.get(
  "/:type/:id",
  authorize("read"),
  asyncHandler(async (req, res) => {
    const document = await currentDocument(req);
    if (!document) return sendNotFound(res);
    res.json(
      responseFor(req, {
        meta: { collection: "documents" },
        document,
      }),
    );
  }),
);

knowledgeRecordsRouter.put(
  "/:type/:id",
  authorize("update"),
  asyncHandler(async (req, res) => {
    const before = await currentDocument(req, "update");
    if (!before) return sendNotFound(res);
    const documentType = typeFor(req, req.body) || before.documentType;
    const result = await updateDocument(
      req.params.id,
      { ...req.body, documentType, updatedBy: actorId(req) },
      query(req, "update"),
    );
    await recordAuditEvent({
      actor: req.actor,
      action: "updated",
      target: {
        type: "document",
        id: result.document.id,
        label: result.document.title,
      },
      before,
      after: result.document,
      summary: `${documentTypeConfig(result.document.documentType).label} atualizada`,
      metadata: knowledgeContextMetadata(result.document),
    });
    res.json(responseFor(req, result));
  }),
);

knowledgeRecordsRouter.delete(
  "/:type/:id",
  authorize("archive"),
  asyncHandler(async (req, res) => {
    const before = await currentDocument(req, "archive");
    if (!before) return sendNotFound(res);
    const result = await archiveDocument(
      req.params.id,
      { documentType: before.documentType, updatedBy: actorId(req) },
      query(req, "archive"),
    );
    await recordAuditEvent({
      actor: req.actor,
      action: "archived",
      target: {
        type: "document",
        id: result.document.id,
        label: result.document.title,
      },
      before,
      after: result.document,
      summary: "Documento arquivado",
      metadata: knowledgeContextMetadata(result.document),
    });
    res.json(responseFor(req, result));
  }),
);
