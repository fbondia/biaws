import { Router } from "express";

import {
  actorCanAccessApplication,
  authorizationQuery,
  requireAllPermissions,
  requireWorkspaceScope,
} from "../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../repositories/auditRepository.js";
import { assertApplicationCanArchive } from "../repositories/deploymentsRepository.js";
import {
  archiveApplication,
  createApplication,
  getApplication,
  getWorkspace,
  listApplications,
  listWorkspaces,
  moveApplicationToCollection,
  updateApplication,
} from "../repositories/catalogRepository.js";

export const catalogRouter = Router();

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function sendNotFound(res, code, message) {
  res.status(404).json({ error: { code, message } });
}

catalogRouter.get(
  "/workspaces",
  requireAllPermissions("workspaces.read"),
  asyncHandler(async (req, res) => {
    res.json(
      await listWorkspaces({
        workspaceIds: req.actor.workspaces.map(({ id }) => id),
      }),
    );
  }),
);

catalogRouter.get(
  "/workspaces/:workspaceId",
  requireAllPermissions("workspaces.read"),
  asyncHandler(async (req, res) => {
    const workspace =
      req.params.workspaceId === req.actor.workspaceId
        ? await getWorkspace(req.params.workspaceId)
        : null;
    if (!workspace) {
      sendNotFound(res, "WORKSPACE_NOT_FOUND", "Workspace not found");
      return;
    }
    res.json({ workspace });
  }),
);

catalogRouter.get(
  "/workspaces/:workspaceId/applications",
  requireAllPermissions("applications.read"),
  (req, res, next) =>
    req.params.workspaceId === req.actor.workspaceId
      ? next()
      : sendNotFound(res, "WORKSPACE_NOT_FOUND", "Workspace not found"),
  asyncHandler(async (req, res) => {
    res.json(
      await listApplications(
        req.params.workspaceId,
        authorizationQuery(req.actor, "applications.read", req.query),
      ),
    );
  }),
);

catalogRouter.post(
  "/workspaces/:workspaceId/applications",
  requireAllPermissions("applications.create"),
  requireWorkspaceScope("applications.create"),
  asyncHandler(async (req, res) => {
    const application = await createApplication(
      req.params.workspaceId,
      req.body,
      req.actor,
    );
    await recordAuditEvent({
      actor: req.actor,
      action: "created",
      target: {
        type: "application",
        id: application.id,
        label: application.name,
      },
      after: application,
      metadata: {
        workspaceId: application.workspaceId,
        applicationId: application.id,
      },
      summary: `Aplicação criada: ${application.name}`,
    });
    res.status(201).json({ application });
  }),
);

catalogRouter.get(
  "/applications/:applicationId",
  requireAllPermissions("applications.read"),
  asyncHandler(async (req, res) => {
    const application = actorCanAccessApplication(
      req.actor,
      "applications.read",
      req.params.applicationId,
    )
      ? await getApplication(req.params.applicationId, {
          workspaceId: req.actor.workspaceId,
        })
      : null;
    if (!application) {
      sendNotFound(res, "APPLICATION_NOT_FOUND", "Application not found");
      return;
    }
    res.json({ application });
  }),
);

catalogRouter.patch(
  "/applications/:applicationId/collection",
  requireAllPermissions("applications.update"),
  asyncHandler(async (req, res) => {
    const before = actorCanAccessApplication(
      req.actor,
      "applications.update",
      req.params.applicationId,
    )
      ? await getApplication(req.params.applicationId, {
          workspaceId: req.actor.workspaceId,
        })
      : null;
    if (!before) {
      sendNotFound(res, "APPLICATION_NOT_FOUND", "Application not found");
      return;
    }
    const after = await moveApplicationToCollection(
      before.id,
      req.body?.collectionId,
      req.actor,
    );
    await recordAuditEvent({
      actor: req.actor,
      action: "updated",
      target: { type: "application", id: after.id, label: after.name },
      before,
      after,
      metadata: { workspaceId: after.workspaceId },
      summary: `Aplicação movida entre coleções: ${after.name}`,
    });
    res.json({ application: after });
  }),
);

catalogRouter.patch(
  "/applications/:applicationId",
  requireAllPermissions("applications.update"),
  asyncHandler(async (req, res) => {
    const before = actorCanAccessApplication(
      req.actor,
      "applications.update",
      req.params.applicationId,
    )
      ? await getApplication(req.params.applicationId, {
          workspaceId: req.actor.workspaceId,
        })
      : null;
    if (!before) {
      sendNotFound(res, "APPLICATION_NOT_FOUND", "Application not found");
      return;
    }
    const after = await updateApplication(
      req.params.applicationId,
      req.body,
      req.actor,
    );
    await recordAuditEvent({
      actor: req.actor,
      action: "updated",
      target: { type: "application", id: after.id, label: after.name },
      before,
      after,
      metadata: {
        workspaceId: after.workspaceId,
        applicationId: after.id,
      },
      summary: `Aplicação atualizada: ${after.name}`,
    });
    res.json({ application: after });
  }),
);

catalogRouter.patch(
  "/applications/:applicationId/archive",
  requireAllPermissions("applications.archive"),
  asyncHandler(async (req, res) => {
    const before = actorCanAccessApplication(
      req.actor,
      "applications.archive",
      req.params.applicationId,
    )
      ? await getApplication(req.params.applicationId, {
          workspaceId: req.actor.workspaceId,
        })
      : null;
    if (!before) {
      sendNotFound(res, "APPLICATION_NOT_FOUND", "Application not found");
      return;
    }
    if (before.status !== "archived") {
      await assertApplicationCanArchive(req.params.applicationId);
    }
    const after = await archiveApplication(req.params.applicationId, req.actor);
    if (before.status !== after.status) {
      await recordAuditEvent({
        actor: req.actor,
        action: "archived",
        target: { type: "application", id: after.id, label: after.name },
        before,
        after,
        metadata: {
          workspaceId: after.workspaceId,
          applicationId: after.id,
        },
        summary: `Aplicação arquivada: ${after.name}`,
      });
    }
    res.json({ application: after });
  }),
);
