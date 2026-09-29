import { getSkill } from "../../../repositories/skills/index.js";
import {
  authorizationQuery,
  requireAllPermissions,
} from "../../../auth/authorizationMiddleware.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { sendNotFound } from "../helpers.js";

export function registerListDownload(router) {
  router.get(
    "/:skillId/:version/download",
    requireAllPermissions("skills.read"),
    asyncHandler(async (req, res) => {
      const result = await getSkill(
        req.params.skillId,
        req.params.version,
        authorizationQuery(req.actor, "skills.read", req.query),
        {
          includeContents: true,
        },
      );
      if (!result.skill)
        return sendNotFound(res, req.params.skillId, req.params.version);
      res.setHeader("Content-Type", "application/vnd.biaws.skill+json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.skill.skillId}-${result.skill.version}.skill.json"`,
      );
      res.json({
        format: "biaws-skill-package/v1",
        skill: result.skill,
      });
    }),
  );
}
