import { fromNodeHeaders } from "better-auth/node";
import { getAuth } from "../../auth/auth.js";
import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { getUsersAccess } from "../../repositories/access/index.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export function registerListUsers(router) {
  router.get(
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
}
