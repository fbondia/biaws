import { Router } from "express";
import { fromNodeHeaders } from "better-auth/node";

import { getAuth } from "../auth/auth.js";
import { requirePlatformPermissions } from "../auth/authorizationMiddleware.js";
import { listPermissionGroups } from "../repositories/accessRepository.js";
import {
  listAuditEvents,
  recordAuditEvent,
} from "../repositories/auditRepository.js";
import {
  getWorkspace,
  getWorkspaceSummary,
  listAllWorkspaces,
  listWorkspaceMembers,
  provisionWorkspace,
  removeWorkspaceMember,
  setWorkspaceMemberGroups,
  setWorkspaceStatus,
  updateWorkspace,
} from "../repositories/platformWorkspaceRepository.js";

export const platformRouter = Router();

function asyncHandler(handler) {
  return async function platformHandler(req, res, next) {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

platformRouter.use(requirePlatformPermissions("platform.workspaces.manage"));

platformRouter.get(
  "/users",
  asyncHandler(async (req, res) => {
    const auth = await getAuth();
    const payload = await auth.api.listUsers({
      headers: fromNodeHeaders(req.headers),
      query: { limit: 100 },
    });
    res.json({ users: payload.users || [] });
  }),
);

platformRouter.get(
  "/workspaces",
  asyncHandler(async (req, res) => {
    res.json(await listAllWorkspaces(req.query));
  }),
);

platformRouter.post(
  "/workspaces",
  asyncHandler(async (req, res) => {
    const result = await provisionWorkspace(req.body, req.actor);
    await recordAuditEvent({
      actor: req.actor,
      action: "created",
      target: {
        type: "workspace",
        id: result.workspace.id,
        label: result.workspace.name,
      },
      after: result.workspace,
      metadata: { workspaceId: result.workspace.id, platform: true },
      summary: `Workspace criado: ${result.workspace.name}`,
    });
    res.status(201).json(result);
  }),
);

platformRouter.get(
  "/workspaces/:workspaceId",
  asyncHandler(async (req, res) => {
    const workspace = await getWorkspace(req.params.workspaceId);
    if (!workspace) {
      res.status(404).json({
        error: { code: "WORKSPACE_NOT_FOUND", message: "Workspace not found" },
      });
      return;
    }
    res.json({ workspace });
  }),
);

platformRouter.patch(
  "/workspaces/:workspaceId",
  asyncHandler(async (req, res) => {
    const before = await getWorkspace(req.params.workspaceId);
    const workspace = await updateWorkspace(
      req.params.workspaceId,
      req.body,
      req.actor,
    );
    await recordAuditEvent({
      actor: req.actor,
      action: "updated",
      target: { type: "workspace", id: workspace.id, label: workspace.name },
      before,
      after: workspace,
      metadata: { workspaceId: workspace.id, platform: true },
      summary: `Workspace alterado: ${workspace.name}`,
    });
    res.json({ workspace });
  }),
);

async function changeWorkspaceStatus(req, res, status) {
  const before = await getWorkspace(req.params.workspaceId);
  if (
    status === "archived" &&
    String(req.body.confirmation || "") !== before?.name
  ) {
    res.status(422).json({
      error: {
        code: "WORKSPACE_CONFIRMATION_REQUIRED",
        message: "Type the workspace name to confirm archiving",
      },
    });
    return;
  }
  const workspace = await setWorkspaceStatus(
    req.params.workspaceId,
    status,
    req.actor,
  );
  await recordAuditEvent({
    actor: req.actor,
    action: status === "archived" ? "archived" : "reactivated",
    target: { type: "workspace", id: workspace.id, label: workspace.name },
    before,
    after: workspace,
    metadata: { workspaceId: workspace.id, platform: true },
    summary:
      status === "archived"
        ? `Workspace arquivado: ${workspace.name}`
        : `Workspace reativado: ${workspace.name}`,
  });
  res.json({ workspace });
}

platformRouter.post(
  "/workspaces/:workspaceId/archive",
  asyncHandler((req, res) => changeWorkspaceStatus(req, res, "archived")),
);

platformRouter.post(
  "/workspaces/:workspaceId/reactivate",
  asyncHandler((req, res) => changeWorkspaceStatus(req, res, "active")),
);

platformRouter.get(
  "/workspaces/:workspaceId/summary",
  asyncHandler(async (req, res) => {
    res.json({ summary: await getWorkspaceSummary(req.params.workspaceId) });
  }),
);

platformRouter.get(
  "/workspaces/:workspaceId/groups",
  asyncHandler(async (req, res) => {
    res.json({
      groups: await listPermissionGroups({
        workspaceId: req.params.workspaceId,
        includeInactive: true,
      }),
    });
  }),
);

platformRouter.get(
  "/workspaces/:workspaceId/members",
  asyncHandler(async (req, res) => {
    res.json({ members: await listWorkspaceMembers(req.params.workspaceId) });
  }),
);

platformRouter.put(
  "/workspaces/:workspaceId/members/:userId",
  asyncHandler(async (req, res) => {
    const access = await setWorkspaceMemberGroups(
      req.params.workspaceId,
      req.params.userId,
      req.body.groupIds,
      req.actor,
    );
    await recordAuditEvent({
      actor: req.actor,
      action: "membership.updated",
      target: {
        type: "workspace-member",
        id: req.params.userId,
        label: req.params.userId,
      },
      root: {
        type: "workspace",
        id: req.params.workspaceId,
        label: req.params.workspaceId,
      },
      after: access,
      metadata: { workspaceId: req.params.workspaceId, platform: true },
      summary: "Vínculo de usuário atualizado",
    });
    res.json({ access });
  }),
);

platformRouter.delete(
  "/workspaces/:workspaceId/members/:userId",
  asyncHandler(async (req, res) => {
    const result = await removeWorkspaceMember(
      req.params.workspaceId,
      req.params.userId,
    );
    await recordAuditEvent({
      actor: req.actor,
      action: "membership.removed",
      target: {
        type: "workspace-member",
        id: req.params.userId,
        label: req.params.userId,
      },
      root: {
        type: "workspace",
        id: req.params.workspaceId,
        label: req.params.workspaceId,
      },
      metadata: { workspaceId: req.params.workspaceId, platform: true },
      summary: "Usuário removido do workspace",
    });
    res.json(result);
  }),
);

platformRouter.get(
  "/workspaces/:workspaceId/audit",
  requirePlatformPermissions("platform.audit.read"),
  asyncHandler(async (req, res) => {
    res.json({
      events: await listAuditEvents("workspace", req.params.workspaceId, {
        limit: req.query.limit,
      }),
    });
  }),
);
