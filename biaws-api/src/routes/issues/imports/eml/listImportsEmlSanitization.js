import {
  authorizationQuery,
  requireAllPermissions,
} from "../../../../auth/authorizationMiddleware.js";
import { getEmailSanitizationConfiguration } from "../../../../repositories/issues/emailSanitization.js";
import { asyncHandler } from "../../helpers.js";

export function registerListImportsEmlSanitization(router) {
  router.get(
    "/imports/eml/sanitization",
    requireAllPermissions("issues.import.eml"),
    asyncHandler(async (req, res) => {
      res.json(
        await getEmailSanitizationConfiguration(
          authorizationQuery(req.actor, "issues.import.eml", req.query),
        ),
      );
    }),
  );
}
