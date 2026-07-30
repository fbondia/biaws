import { Router } from "express";

import { PERMISSION_CATALOG } from "../../../shared/index.js";
import {
  createPermissionGroup,
  getPermissionGroup,
  getUserAccess,
  listPermissionGroups,
  setPermissionGroupActive,
  setUserGroups,
  updatePermissionGroup,
} from "../repositories/accessRepository.js";
import { requireAllPermissions } from "../auth/authorizationMiddleware.js";

export const accessRouter = Router();

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

accessRouter.get(
  "/permissions",
  requireAllPermissions("roles.read"),
  (req, res) => {
    res.json({ permissions: PERMISSION_CATALOG });
  },
);

accessRouter.get(
  "/groups",
  requireAllPermissions("roles.read"),
  asyncHandler(async (req, res) => {
    const includeInactive = req.query.includeInactive !== "false";
    res.json({
      groups: await listPermissionGroups({
        includeInactive,
        workspaceId: req.actor.workspaceId,
      }),
    });
  }),
);

accessRouter.get(
  "/groups/:groupId",
  requireAllPermissions("roles.read"),
  asyncHandler(async (req, res) => {
    const group = await getPermissionGroup(req.params.groupId, {
      workspaceId: req.actor.workspaceId,
    });
    if (!group) {
      res.status(404).json({
        error: {
          code: "GROUP_NOT_FOUND",
          message: `Group not found: ${req.params.groupId}`,
        },
      });
      return;
    }
    res.json({ group });
  }),
);

accessRouter.post(
  "/groups",
  requireAllPermissions("roles.manage"),
  asyncHandler(async (req, res) => {
    res.status(201).json({
      group: await createPermissionGroup(req.body, req.actor),
    });
  }),
);

accessRouter.put(
  "/groups/:groupId",
  requireAllPermissions("roles.manage"),
  asyncHandler(async (req, res) => {
    res.json({
      group: await updatePermissionGroup(
        req.params.groupId,
        req.body,
        req.actor,
      ),
    });
  }),
);

accessRouter.patch(
  "/groups/:groupId/status",
  requireAllPermissions("roles.manage"),
  asyncHandler(async (req, res) => {
    res.json({
      group: await setPermissionGroupActive(
        req.params.groupId,
        req.body.active,
        req.actor,
      ),
    });
  }),
);

accessRouter.get(
  "/users/:userId",
  requireAllPermissions("users.read"),
  asyncHandler(async (req, res) => {
    res.json({
      access: await getUserAccess(req.params.userId, {
        workspaceId: req.actor.workspaceId,
      }),
    });
  }),
);

accessRouter.put(
  "/users/:userId/groups",
  requireAllPermissions("users.update", "roles.manage"),
  asyncHandler(async (req, res) => {
    res.json({
      access: await setUserGroups(
        req.params.userId,
        req.body.groupIds,
        req.actor,
        { workspaceId: req.actor.workspaceId },
      ),
    });
  }),
);
