import { Router } from "express";
import { fromNodeHeaders } from "better-auth/node";

import { getAuth } from "../auth/auth.js";
import { requireAllPermissions } from "../auth/authorizationMiddleware.js";
import {
  getUserAccess,
  getUsersAccess,
} from "../repositories/accessRepository.js";

export const identityRouter = Router();

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

async function requireWorkspaceUser(req, res, next) {
  try {
    const access = await getUserAccess(req.params.userId, {
      workspaceId: req.actor.workspaceId,
    });
    if (!access.groupIds.length) {
      res.status(404).json({
        error: { code: "USER_NOT_FOUND", message: "User not found" },
      });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}

identityRouter.get(
  "/users",
  requireAllPermissions("users.read"),
  asyncHandler(async (req, res) => {
    const auth = await getAuth();
    const payload = await auth.api.listUsers({
      headers: fromNodeHeaders(req.headers),
      query: { limit: 100 },
    });
    const users = payload.users || [];
    const accessItems = await getUsersAccess(
      users.map(({ id }) => id),
      {
        workspaceId: req.actor.workspaceId,
      },
    );
    const groupIdsByUser = new Map(
      accessItems.map(({ userId, groupIds }) => [userId, groupIds]),
    );

    res.json({
      ...payload,
      users: users
        .filter((user) => groupIdsByUser.has(String(user.id)))
        .map((user) => ({
          ...user,
          groupIds: groupIdsByUser.get(String(user.id)) || [],
        })),
    });
  }),
);

identityRouter.post(
  "/users",
  requireAllPermissions("users.create"),
  asyncHandler(async (req, res) => {
    const auth = await getAuth();
    res.status(201).json(
      await auth.api.createUser({
        headers: fromNodeHeaders(req.headers),
        body: {
          name: req.body.name,
          email: req.body.email,
          password: req.body.password,
          role: "user",
        },
      }),
    );
  }),
);

identityRouter.patch(
  "/users/:userId/disabled",
  requireAllPermissions("users.disable"),
  requireWorkspaceUser,
  asyncHandler(async (req, res) => {
    const auth = await getAuth();
    const result = req.body.disabled
      ? await auth.api.banUser({
          headers: fromNodeHeaders(req.headers),
          body: {
            userId: req.params.userId,
            banReason: "Desativado administrativamente",
          },
        })
      : await auth.api.unbanUser({
          headers: fromNodeHeaders(req.headers),
          body: { userId: req.params.userId },
        });
    res.json(result);
  }),
);

identityRouter.put(
  "/users/:userId/password",
  requireAllPermissions("users.password.reset"),
  requireWorkspaceUser,
  asyncHandler(async (req, res) => {
    const auth = await getAuth();
    const result = await auth.api.setUserPassword({
      headers: fromNodeHeaders(req.headers),
      body: {
        userId: req.params.userId,
        newPassword: req.body.newPassword,
      },
    });
    await auth.api.revokeUserSessions({
      headers: fromNodeHeaders(req.headers),
      body: { userId: req.params.userId },
    });
    res.json(result);
  }),
);

identityRouter.delete(
  "/users/:userId/sessions",
  requireAllPermissions("users.update"),
  requireWorkspaceUser,
  asyncHandler(async (req, res) => {
    const auth = await getAuth();
    res.json(
      await auth.api.revokeUserSessions({
        headers: fromNodeHeaders(req.headers),
        body: { userId: req.params.userId },
      }),
    );
  }),
);
