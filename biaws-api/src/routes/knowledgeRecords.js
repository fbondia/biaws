import { Router } from "express";

import {
  actorHasPermission,
  actorHasWorkspaceScope,
  authorizationQuery,
  requireAllPermissions,
} from "../auth/authorizationMiddleware.js";
import { resolveUserAuthorization } from "../repositories/accessRepository.js";
import { recordAuditEvent } from "../repositories/auditRepository.js";
import {
  addDocumentObservation,
  archiveDocument,
  createDocument,
  deleteDocument,
  documentReplicationPayload,
  documentTypeConfig,
  getDocument,
  listDocumentObservations,
  listDocumentRevisions,
  listDocuments,
  moveDocument,
  updateDocument,
} from "../repositories/documentsRepository.js";
import { deleteStoredAttachments } from "../services/attachmentService.js";
import { knowledgeContextMetadata } from "../repositories/knowledgeContextRepository.js";
import { registerAttachmentRoutes } from "./attachmentRoutes.js";

export const knowledgeRecordsRouter = Router();

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function authorize(operation) {
  return requireAllPermissions(`documents.${operation}`);
}

function query(req, operation, additions = {}) {
  return authorizationQuery(req.actor, `documents.${operation}`, {
    ...req.query,
    ...additions,
  });
}

function actorId(req) {
  return req.actor.email || req.actor.userId;
}

function typeFor(req, payload = {}) {
  const documentType = payload.documentType || req.query.documentType;
  if (documentType) documentTypeConfig(documentType);
  return documentType;
}

async function currentDocument(req, operation = "read") {
  const result = await getDocument(req.params.id, query(req, operation));
  return result.document;
}

function sendNotFound(res) {
  res.status(404).json({
    error: { code: "DOCUMENT_NOT_FOUND", message: "Documento não encontrado" },
  });
}

knowledgeRecordsRouter.get(
  "/documents",
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
  "/documents",
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
    res.status(201).json(result);
  }),
);

registerAttachmentRoutes(knowledgeRecordsRouter, "documents", "/documents");

knowledgeRecordsRouter.post(
  "/documents/:id/replicate",
  authorize("read"),
  asyncHandler(async (req, res) => {
    const source = await currentDocument(req);
    if (!source) return sendNotFound(res);
    const destinationWorkspaceId = String(
      req.body.destinationWorkspaceId || "",
    ).trim();
    if (!destinationWorkspaceId) {
      res.status(422).json({
        error: {
          code: "DESTINATION_WORKSPACE_REQUIRED",
          message: "O workspace de destino é obrigatório",
        },
      });
      return;
    }
    if (destinationWorkspaceId === req.actor.workspaceId) {
      res.status(422).json({
        error: {
          code: "SAME_WORKSPACE_REPLICATION",
          message: "Selecione um workspace diferente do atual",
        },
      });
      return;
    }

    const destinationAuthorization = await resolveUserAuthorization(
      req.actor.userId,
      destinationWorkspaceId,
    );
    const destinationActor = { ...req.actor, ...destinationAuthorization };
    if (
      !actorHasPermission(destinationActor, "documents.create") ||
      !actorHasWorkspaceScope(destinationActor, "documents.create")
    ) {
      res.status(403).json({
        error: {
          code: "DESTINATION_DOCUMENT_CREATE_FORBIDDEN",
          message:
            "Você não possui permissão para criar documentos gerais neste workspace",
          requiredPermissions: ["documents.create"],
        },
      });
      return;
    }

    const result = await createDocument(
      { ...documentReplicationPayload(source), createdBy: actorId(req) },
      {
        ...authorizationQuery(destinationActor, "documents.create"),
        allowWorkspaceContext: true,
      },
    );
    const document = result.document;
    const destinationWorkspace = req.actor.workspaces.find(
      ({ id }) => id === destinationWorkspaceId,
    );
    await recordAuditEvent({
      actor: destinationActor,
      action: "created",
      target: { type: "document", id: document.id, label: document.title },
      after: document,
      summary: `Documento replicado de ${source.workspaceId}`,
      metadata: {
        ...knowledgeContextMetadata(document),
        sourceDocumentId: source.id,
        sourceWorkspaceId: source.workspaceId,
      },
    });
    res.status(201).json({
      ...result,
      destinationWorkspace: destinationWorkspace || {
        id: destinationWorkspaceId,
        name: destinationWorkspaceId,
      },
    });
  }),
);

knowledgeRecordsRouter.get(
  "/documents/:id/revisions",
  authorize("read"),
  asyncHandler(async (req, res) => {
    if (!(await currentDocument(req))) return sendNotFound(res);
    res.json(await listDocumentRevisions(req.params.id, query(req, "read")));
  }),
);

knowledgeRecordsRouter.get(
  "/documents/:id/observations",
  authorize("read"),
  asyncHandler(async (req, res) => {
    if (!(await currentDocument(req))) return sendNotFound(res);
    res.json(await listDocumentObservations(req.params.id, query(req, "read")));
  }),
);

knowledgeRecordsRouter.post(
  "/documents/:id/observations",
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
  "/documents/:id/collection",
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
    res.json(result);
  }),
);

knowledgeRecordsRouter.get(
  "/documents/:id",
  authorize("read"),
  asyncHandler(async (req, res) => {
    const document = await currentDocument(req);
    if (!document) return sendNotFound(res);
    res.json({ meta: { collection: "documents" }, document });
  }),
);

knowledgeRecordsRouter.put(
  "/documents/:id",
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
    res.json(result);
  }),
);

knowledgeRecordsRouter.delete(
  "/documents/:id/permanent",
  authorize("archive"),
  asyncHandler(async (req, res) => {
    const before = await currentDocument(req, "archive");
    if (!before) return sendNotFound(res);
    const result = await deleteDocument(req.params.id, query(req, "archive"));
    const attachmentCleanup = await deleteStoredAttachments(
      "documents",
      before,
    );
    await recordAuditEvent({
      actor: req.actor,
      action: "deleted",
      target: {
        type: "document",
        id: before.id,
        label: before.title,
      },
      before,
      after: null,
      summary: "Documento excluído definitivamente",
      metadata: knowledgeContextMetadata(before),
    });
    res.json({ ...result, attachmentCleanup });
  }),
);

knowledgeRecordsRouter.delete(
  "/documents/:id",
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
    res.json(result);
  }),
);
