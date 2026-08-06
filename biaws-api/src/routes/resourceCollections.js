import { Router } from "express";

import {
  authorizationQuery,
  requireAllPermissions,
  requireWorkspaceScope,
} from "../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../repositories/auditRepository.js";
import {
  assertResourceCollectionType,
  createResourceCollection,
  deleteResourceCollection,
  listResourceCollections,
  updateResourceCollection,
} from "../repositories/resourceCollectionsRepository.js";

export const resourceCollectionsRouter = Router();

const PERMISSIONS = Object.freeze({
  applications: { read: "applications.read", manage: "applications.update" },
  secrets: { read: "secrets.metadata.read", manage: "secrets.update" },
  skills: { read: "skills.read", manage: "skills.publish" },
  servers: { read: "servers.read", manage: "servers.update" },
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

function authorize(operation, { workspace = false } = {}) {
  return (req, res, next) => {
    try {
      const type = assertResourceCollectionType(req.params.resourceType);
      const permission = PERMISSIONS[type][operation];
      const permissionMiddleware = requireAllPermissions(permission);
      permissionMiddleware(req, res, (error) => {
        if (error || !workspace) return next(error);
        requireWorkspaceScope(permission)(req, res, next);
      });
    } catch (error) {
      next(error);
    }
  };
}

function query(req, operation) {
  const type = assertResourceCollectionType(req.params.resourceType);
  return authorizationQuery(req.actor, PERMISSIONS[type][operation], req.query);
}

resourceCollectionsRouter.get(
  "/:resourceType",
  authorize("read"),
  asyncHandler(async (req, res) => {
    res.json(
      await listResourceCollections(
        req.params.resourceType,
        query(req, "read"),
      ),
    );
  }),
);

resourceCollectionsRouter.post(
  "/:resourceType",
  authorize("manage", { workspace: true }),
  asyncHandler(async (req, res) => {
    const result = await createResourceCollection(
      req.params.resourceType,
      { ...req.body, createdBy: req.actor.email || req.actor.userId },
      query(req, "manage"),
    );
    await recordAuditEvent({
      actor: req.actor,
      action: "created",
      target: {
        type: `${req.params.resourceType}_collection`,
        id: result.collection.id,
        label: result.collection.name,
      },
      after: result.collection,
      summary: `Coleção de ${req.params.resourceType} criada`,
    });
    res.status(201).json(result);
  }),
);

resourceCollectionsRouter.patch(
  "/:resourceType/:collectionId",
  authorize("manage", { workspace: true }),
  asyncHandler(async (req, res) => {
    const result = await updateResourceCollection(
      req.params.resourceType,
      req.params.collectionId,
      { ...req.body, updatedBy: req.actor.email || req.actor.userId },
      query(req, "manage"),
    );
    await recordAuditEvent({
      actor: req.actor,
      action: "updated",
      target: {
        type: `${req.params.resourceType}_collection`,
        id: result.collection.id,
        label: result.collection.name,
      },
      after: result.collection,
      summary: `Coleção de ${req.params.resourceType} atualizada`,
    });
    res.json(result);
  }),
);

resourceCollectionsRouter.delete(
  "/:resourceType/:collectionId",
  authorize("manage", { workspace: true }),
  asyncHandler(async (req, res) => {
    const result = await deleteResourceCollection(
      req.params.resourceType,
      req.params.collectionId,
      query(req, "manage"),
    );
    await recordAuditEvent({
      actor: req.actor,
      action: "deleted",
      target: {
        type: `${req.params.resourceType}_collection`,
        id: result.collection.id,
        label: result.collection.name,
      },
      before: result.collection,
      summary: `Coleção de ${req.params.resourceType} excluída`,
    });
    res.json(result);
  }),
);
