import type { Router, Request, Response } from "express";
import { authorizationQuery, requireAllPermissions } from "../../../../auth/authorizationMiddleware.js";
import { getEmailSanitizationConfiguration } from "../../../../repositories/issues/emailSanitization.js";
import { asyncHandler } from "../../helpers.js";

export function registerListImportsEmlSanitization(router: Router) {
  router.get(
    "/imports/eml/sanitization",
    requireAllPermissions("issues.import.eml"),
    asyncHandler(async (req: Request, res: Response) => {
      res.json(await getEmailSanitizationConfiguration(authorizationQuery(req.actor, "issues.import.eml", req.query)));
    }),
  );
}
