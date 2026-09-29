import { listSkills } from "../../repositories/skills/index.js";
import {
  authorizationQuery,
  requireAllPermissions,
} from "../../auth/authorizationMiddleware.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export function registerListSkills(router) {
  router.get(
    "/",
    requireAllPermissions("skills.read"),
    asyncHandler(async (req, res) => {
      res.json(
        await listSkills(
          authorizationQuery(req.actor, "skills.read", req.query),
        ),
      );
    }),
  );
}
